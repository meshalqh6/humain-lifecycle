import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { auditRenderedText } from "./text-contrast.mjs";
import { PNG } from "pngjs";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve("..");
const password = readFileSync(resolve(root, ".env"), "utf8")
  .split(/\r?\n/)
  .find((x) => x.startsWith("ADMIN_PASSWORD="))
  .slice(15);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const report = {
  scope:
    "Rendered typography and automated text contrast on every route. Gradient/manual-review cases are reported separately; this is not a full WCAG assessment.",
  pages: [],
  errors: [],
};
async function inspect(page, name, path) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() =>
    Promise.all(
      [400, 500, 600, 700].map((w) =>
        document.fonts.load(`${w} 12px "Inter Variable"`),
      ),
    ),
  );
  const fonts = await page.evaluate(() => ({
    family: getComputedStyle(document.body).fontFamily,
    weights: [400, 500, 600, 700].map((w) =>
      document.fonts.check(`${w} 12px "Inter Variable"`),
    ),
    loadedFaces: [...document.fonts].filter(
      (f) => f.family.includes("Inter") && f.status === "loaded",
    ).length,
    sources: performance
      .getEntriesByType("resource")
      .filter((e) => e.name.includes("inter-") && e.name.includes(".woff2"))
      .map((e) => ({
        file: new URL(e.name).pathname.split("/").pop(),
        sameOrigin: new URL(e.name).origin === location.origin,
      })),
  }));
  const results = await new AxeBuilder({ page })
    .withRules(["color-contrast"])
    .analyze();
  const issues = results.violations.flatMap((v) =>
    v.nodes.map((n) => ({
      targets: n.target,
      summary: n.failureSummary,
      data: n.any.map((x) => x.data),
    })),
  );
  const manual = results.incomplete.flatMap((v) =>
    v.nodes.map((n) => ({ targets: n.target, summary: n.failureSummary })),
  );
  const contrast = await page.evaluate(auditRenderedText);
  const sampled = [];
  for (const finding of contrast.findings) {
    const locator = page.locator(finding.selector);
    await locator.scrollIntoViewIfNeeded();
    const geometry = await locator.evaluate((el) => {
      const box = el.getBoundingClientRect(),
        style = getComputedStyle(el);
      const areas = [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim())
        .flatMap((n) => {
          const range = document.createRange();
          range.selectNodeContents(n);
          return [...range.getClientRects()].map((r) => ({
            x: r.x - box.x,
            y: r.y - box.y,
            width: r.width,
            height: r.height,
          }));
        });
      return {
        areas,
        color: style.color,
        colors:
          style.webkitBackgroundClip === "text"
            ? style.backgroundImage.match(/rgba?\([^)]+\)/g) || [style.color]
            : [style.color],
        gradient: style.webkitBackgroundClip === "text",
      };
    });
    const hide = await page.addStyleTag({
      content:
        "body * { -webkit-text-fill-color: transparent !important; text-decoration-color: transparent !important; }" +
        (geometry.gradient
          ? finding.selector + " { background-image: none !important; }"
          : ""),
    });
    let pixels;
    try {
      pixels = PNG.sync.read(
        await locator.screenshot({ animations: "disabled", scale: "css" }),
      );
    } finally {
      await hide.evaluate((el) => el.remove());
    }
    const luminance = (c) =>
      c
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const lights = geometry.colors.map((color) =>
      luminance(
        color
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number),
      ),
    );
    let minimum = 100;
    for (const area of geometry.areas)
      for (
        let y = Math.max(0, Math.ceil(area.y));
        y < Math.min(pixels.height, Math.floor(area.y + area.height));
        y++
      )
        for (
          let x = Math.max(0, Math.ceil(area.x));
          x < Math.min(pixels.width, Math.floor(area.x + area.width));
          x++
        ) {
          const index = (y * pixels.width + x) * 4;
          const background = luminance([
            pixels.data[index],
            pixels.data[index + 1],
            pixels.data[index + 2],
          ]);
          for (const light of lights)
            minimum = Math.min(
              minimum,
              (Math.max(light, background) + 0.05) /
                (Math.min(light, background) + 0.05),
            );
        }
    sampled.push({
      ...finding,
      actualBackgroundRatio: Math.round(minimum * 100) / 100,
      passes: minimum >= finding.required,
      method:
        "Rendered gradient background sampled under actual text ranges with glyph paint temporarily suppressed; no layout or background changed.",
    });
  }
  contrast.sampledGradientCases = sampled;
  contrast.findings = sampled.filter((x) => !x.passes);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  report.pages.push({ name, path, fonts, overflow, issues, manual, contrast });
  console.log(
    `${name}: ${issues.length} axe findings, ${contrast.findings.length} gradient-stop findings, ${manual.length} axe incomplete, overflow=${overflow}`,
  );
  await page.screenshot({
    path: resolve(root, "docs/screenshots/development-" + name + ".png"),
    fullPage: true,
    animations: "disabled",
  });
}
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const login = await context.request.post(
    "http://127.0.0.1:5173/api/auth/login",
    {
      headers: { "X-Humain-Request": "1" },
      data: { username: "admin", password },
    },
  );
  if (!login.ok()) throw Error("Local sign-in failed");
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  for (const [route, selector, name] of [
    ["/", ".metric", "overview"],
    ["/employees", "table", "employees"],
    ["/onboarding", ".workflow-card", "onboarding"],
    ["/contracts", ".upload-zone", "contracts"],
    ["/compliance", ".info-strip", "compliance"],
    ["/communications", ".template-card", "communications"],
    ["/analytics", ".recharts-surface", "analytics"],
    ["/audit", "table", "audit"],
    ["/settings", ".integration-card", "settings"],
    ["/integrations", ".integration-card", "integrations"],
    ["/chat", ".composer", "wasl"],
    ["/journeys", ".journey-tabs", "journeys"],
  ]) {
    await page.goto("http://127.0.0.1:5173" + route);
    await page.locator(selector).first().waitFor();
    if (route === "/settings")
      await page
        .getByRole("button", { name: "Save email settings", exact: true })
        .waitFor();
    if (route === "/settings" || route === "/integrations")
      await page.locator('.integration-grid[aria-busy="false"]').waitFor();
    if (route === "/journeys") {
      const first = page.locator(".journey-list button").first();
      if (await first.count()) {
        await first.click();
        await page
          .getByRole("heading", { name: "Verified evidence", exact: true })
          .waitFor();
      }
    }
    await inspect(page, name, route);
  }
  for (const [tab, name] of [
    ["Exceptions", "exceptions"],
    ["Tasks", "tasks"],
    ["Company policies", "policies"],
  ]) {
    await page
      .getByRole("tab", { name: tab, exact: tab !== "Exceptions" })
      .click();
    await inspect(page, name, "/journeys / " + tab);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [route, selector, name] of [
    ["/", ".metric", "overview"],
    ["/employees", "table", "employees"],
    ["/onboarding", ".workflow-card", "onboarding"],
    ["/contracts", ".upload-zone", "contracts"],
    ["/compliance", ".info-strip", "compliance"],
    ["/communications", ".template-card", "communications"],
    ["/analytics", ".recharts-surface", "analytics"],
    ["/audit", "table", "audit"],
    ["/settings", ".integration-card", "settings"],
    ["/integrations", ".integration-card", "integrations"],
    ["/chat", ".composer", "wasl"],
    ["/journeys", ".journey-tabs", "journeys"],
  ]) {
    await page.goto("http://127.0.0.1:5173" + route);
    await page.locator(selector).first().waitFor();
    if (route === "/settings")
      await page
        .getByRole("button", { name: "Save email settings", exact: true })
        .waitFor();
    if (route === "/settings" || route === "/integrations")
      await page.locator('.integration-grid[aria-busy="false"]').waitFor();
    await inspect(page, "mobile-" + name, route + " (390px)");
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://127.0.0.1:5173/employees");
  await page.getByRole("button", { name: "Add employee", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await inspect(page, "employee-dialog", "/employees (Add employee dialog)");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const guest = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const loginPage = await guest.newPage();
  await loginPage.goto("http://127.0.0.1:5173/");
  await loginPage
    .getByRole("heading", { name: "Welcome back.", exact: true })
    .waitFor();
  await inspect(loginPage, "login", "/ (signed out)");
  await loginPage.setViewportSize({ width: 390, height: 844 });
  await inspect(loginPage, "mobile-login", "/ (signed out, 390px)");
  writeFileSync(
    resolve(root, "docs/TYPOGRAPHY_REPORT.json"),
    JSON.stringify(report, null, 2),
  );
  console.log("Typography report and all-page captures saved.");
  if (
    report.errors.length ||
    report.pages.some(
      (p) =>
        p.overflow ||
        p.fonts.weights.some((x) => !x) ||
        !p.fonts.loadedFaces ||
        p.fonts.sources.some((x) => !x.sameOrigin) ||
        p.issues.length ||
        p.contrast.findings.length ||
        p.contrast.faded.length,
    )
  )
    process.exitCode = 1;
} finally {
  await browser.close();
}
