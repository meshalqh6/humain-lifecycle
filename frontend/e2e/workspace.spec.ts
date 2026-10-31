import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("email settings save from the UI and persist without sending a message", async ({
  page,
  context,
}) => {
  const original = await (
    await context.request.get("/api/settings/email")
  ).json();
  const before = await (
    await context.request.get("/api/communications")
  ).json();
  try {
    await page.goto("/settings");
    await page
      .getByLabel("Alert recipient email", { exact: true })
      .fill("ui-settings@humain.test");
    await page.getByLabel("Alert window (days)", { exact: true }).fill("45");
    await page.getByRole("button", { name: "Save email settings" }).click();
    await expect(
      page.getByText(
        "Email settings saved. Changes apply immediately; no email was sent.",
      ),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByLabel("Alert recipient email", { exact: true }),
    ).toHaveValue("ui-settings@humain.test");
    await expect(
      page.getByLabel("Alert window (days)", { exact: true }),
    ).toHaveValue("45");
    const after = await (
      await context.request.get("/api/communications")
    ).json();
    expect(after.logs.length).toBe(before.logs.length);
  } finally {
    const { password_configured, ...values } = original;
    void password_configured;
    await context.request.put("/api/settings/email", {
      headers: { "X-Humain-Request": "1" },
      data: values,
    });
  }
});

test("workspace fills wide windows without outer gutters or a centered width cap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/onboarding");
  await expect(
    page.getByRole("heading", { name: "A thoughtful start, every time." }),
  ).toBeVisible();
  const sidebar = await page.locator(".sidebar").boundingBox();
  const main = await page.locator(".main-shell").boundingBox();
  const content = await page.locator("main.content").boundingBox();
  expect(sidebar!.x).toBe(0);
  expect(sidebar!.y).toBe(0);
  expect(sidebar!.height).toBe(1440);
  expect(main!.x).toBe(sidebar!.width);
  expect(main!.y).toBe(0);
  expect(main!.x + main!.width).toBe(2560);
  expect(main!.height).toBeGreaterThanOrEqual(1440);
  expect(content!.width).toBe(main!.width);
});

test("HUMAIN logo loads and legacy assistant links redirect", async ({
  page,
}) => {
  await page.goto("/wasl?source=legacy");
  await expect(page).toHaveURL(/\/chat\?source=legacy$/);
  const logo = page.locator(".chat-brand .humain-chat-logo");
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute("src", "/branding/humain-chat-logo.png");
  await expect
    .poll(() =>
      logo.evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
      ),
    )
    .toBeTruthy();
});
const config = readFileSync(resolve("../.env"), "utf8");
const password = config
  .split(/\r?\n/)
  .find((l) => l.startsWith("ADMIN_PASSWORD="))!
  .split("=")
  .slice(1)
  .join("=");
test.beforeEach(async ({ context }) => {
  const result = await context.request.post(
    "http://127.0.0.1:5180/api/auth/login",
    {
      headers: { "X-Humain-Request": "1" },
      data: { username: "admin", password },
    },
  );
  expect(result.ok()).toBeTruthy();
});

test("all sidebar views load without browser exceptions", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A clearer view. A smarter day." }),
  ).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/overview.png",
    fullPage: true,
    animations: "disabled",
  });
  for (const [label, heading] of [
    ["Employees", "Great people. One connected team."],
    ["Onboarding", "A thoughtful start, every time."],
    ["Contracts", "From paperwork to possibility."],
    ["Compliance", "One step ahead. Always aware."],
    ["Communications", "The right message. The right moment."],
    ["Workforce Analytics", "See the people behind the numbers."],
    ["Audit Trail", "Every action has a story."],
    ["Settings", "Built for your way of working."],
    ["Integrations", "A connected foundation."],
  ]) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  await page.getByRole("link", { name: /HUMAIN Chat/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Message HUMAIN Chat" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/chat.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("delete chats with cancellation, error handling and active chat reset", async ({
  page,
  context,
}) => {
  const first = await (
    await context.request.post("/api/agent/conversations", {
      headers: { "X-Humain-Request": "1" },
    })
  ).json();
  const second = await (
    await context.request.post("/api/agent/conversations", {
      headers: { "X-Humain-Request": "1" },
    })
  ).json();
  await page.goto("/chat?conversation=" + first.id);
  const row = page
    .locator(".chat-history-row")
    .filter({ has: page.locator('[aria-current="page"]') });
  await row
    .getByRole("button", {
      name: "Chat options: New conversation",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Delete chat", exact: true }),
  ).toBeFocused();
  await page.screenshot({ path: "../tmp/chat-options-menu.png" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(
    row.getByRole("button", {
      name: "Chat options: New conversation",
      exact: true,
    }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page
    .getByRole("menuitem", { name: "Delete chat", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    (await context.request.get("/api/agent/conversations/" + first.id)).ok(),
  ).toBeTruthy();
  await row
    .getByRole("button", {
      name: "Chat options: New conversation",
      exact: true,
    })
    .click();
  await page
    .getByRole("menuitem", { name: "Delete chat", exact: true })
    .click();
  await page.route("**/api/agent/conversations/" + first.id, async (route) => {
    if (route.request().method() === "DELETE")
      await route.fulfill({
        status: 409,
        json: { detail: "Wait for this chat to finish" },
      });
    else await route.continue();
  });
  await dialog
    .getByRole("button", { name: "Confirm delete", exact: true })
    .click();
  await expect(
    page.getByText("Wait for this chat to finish", { exact: true }),
  ).toBeVisible();
  await expect(dialog).toBeVisible();
  await page.unroute("**/api/agent/conversations/" + first.id);
  await page.screenshot({ path: "../tmp/chat-delete-confirm.png" });
  await dialog
    .getByRole("button", { name: "Confirm delete", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL("/chat");
  await expect(
    page.getByRole("heading", {
      name: "A little intelligence. A lot more possibility.",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (
      await context.request.get("/api/agent/conversations/" + first.id)
    ).status(),
  ).toBe(404);
  expect(
    (await context.request.get("/api/agent/conversations/" + second.id)).ok(),
  ).toBeTruthy();
  await page.reload();
  const remaining = await (
    await context.request.get("/api/agent/conversations")
  ).json();
  expect(remaining.items.some((c: any) => c.id === first.id)).toBeFalsy();
});

test("employee Saudization shows profession counts and drills into exact workforce members", async ({
  page,
  context,
}) => {
  const profession = "UAT Profession " + Date.now();
  for (const [i, nationality] of ["Saudi", "KSA", "British"].entries()) {
    const r = await context.request.post("/api/employees", {
      headers: {
        "X-Humain-Request": "1",
        "Idempotency-Key": profession + "-" + i,
      },
      data: {
        employee_number: profession + "-" + i,
        name: "Saudization Browser " + i,
        nationality,
        profession,
        synthetic: true,
      },
    });
    expect(r.ok()).toBeTruthy();
  }
  await page.goto("/employees");
  await page.getByRole("tab", { name: "Saudization", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search professions", exact: true })
    .fill(profession);
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: profession, exact: true }) });
  await expect(row.getByRole("cell", { name: "3", exact: true })).toBeVisible();
  await expect(row.getByRole("cell", { name: "2", exact: true })).toBeVisible();
  await expect(row.getByRole("cell", { name: "1", exact: true })).toBeVisible();
  await expect(row).toContainText("66.7%");
  await page.screenshot({
    path: "../tmp/employee-saudization-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await row
    .getByRole("button", {
      name: "View employees in " + profession,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("tab", { name: "Employee directory" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("cell", { name: profession, exact: true }),
  ).toHaveCount(3);
  await page
    .getByRole("button", { name: "Open Saudization Browser 0", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Saudi");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Clear profession filter" }).click();
  await page.getByRole("tab", { name: "Saudization", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search professions", exact: true })
    .fill("No such profession xyz");
  await expect(
    page.getByText("No matching professions", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search professions", exact: true })
    .fill(profession);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "../tmp/employee-saudization-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("employee creation, search and profile", async ({ page }) => {
  const id = "BROWSER-" + Date.now();
  await page.goto("/employees");
  await page.getByRole("button", { name: "Add employee" }).click();
  await page.getByLabel("Full name").fill("Browser Synthetic");
  await page.getByLabel("Employee number", { exact: true }).fill(id);
  await page.getByLabel("Nationality", { exact: true }).fill("Saudi");
  await page.getByLabel("Email", { exact: true }).fill("welcome@humain.test");
  await page.getByRole("button", { name: "Create profile" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("textbox", { name: "Search employees", exact: true })
    .fill(id);
  await expect(page.getByRole("cell", { name: id, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open Browser Synthetic" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText(id, { exact: false }),
  ).toBeVisible();
});

test("employee deletion requires confirmation, keeps failures visible and persists archive", async ({
  page,
  context,
}) => {
  const number = "DELETE-BROWSER-" + Date.now();
  const created = await context.request.post("/api/employees", {
    headers: { "X-Humain-Request": "1", "Idempotency-Key": number },
    data: {
      employee_number: number,
      name: "Delete Browser Synthetic",
      nationality: "Saudi",
      synthetic: true,
    },
  });
  expect(created.ok()).toBeTruthy();
  const employee = await created.json();
  await page.goto("/employees?q=" + number);
  await page
    .getByRole("button", { name: "Open Delete Browser Synthetic", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Delete employee", exact: true })
    .click();
  await expect(dialog).toContainText(
    "Their contracts, tasks and audit history are preserved.",
  );
  await page.screenshot({ path: "../tmp/delete-confirm.png" });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    (await (await context.request.get("/api/employees/" + employee.id)).json())
      .deleted_at,
  ).toBeNull();
  await dialog
    .getByRole("button", { name: "Delete employee", exact: true })
    .click();
  await page.route("**/api/employees/" + employee.id, async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({
        status: 403,
        json: { detail: "Permission required: employee.write" },
      });
    } else await route.continue();
  });
  await dialog
    .getByRole("button", { name: "Confirm delete", exact: true })
    .click();
  await expect(
    page.getByText("Permission required: employee.write", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Confirm delete", exact: true }),
  ).toBeEnabled();
  await page.unroute("**/api/employees/" + employee.id);
  await dialog
    .getByRole("button", { name: "Confirm delete", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("cell", { name: number, exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText("No matching employees", { exact: true }),
  ).toBeVisible();
  const archived = await (
    await context.request.get("/api/employees/" + employee.id)
  ).json();
  expect(archived.deleted_at).toBeTruthy();
  const events = await (
    await context.request.get("/api/audit?q=employee.archived")
  ).json();
  expect(
    events.items.some((e: any) => e.object_id === employee.id),
  ).toBeTruthy();
});

test("onboarding archive confirms, handles errors and hides only the card", async ({
  page,
  context,
}) => {
  const number = "ARCHIVE-BROWSER-" + Date.now();
  const content = readFileSync(resolve("../demo/qiwa-synthetic.csv"), "utf8")
    .replace("DEMO-NEW-001", number)
    .replace("Noura Sandbox", "Archive Browser Demo");
  const uploaded = await context.request.post("/api/documents", {
    headers: { "X-Humain-Request": "1" },
    multipart: {
      file: {
        name: "archive-demo.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(content),
      },
    },
  });
  expect(uploaded.ok()).toBeTruthy();
  const document = await uploaded.json();
  const prepared = await context.request.post("/api/onboarding", {
    headers: { "X-Humain-Request": "1" },
    data: { document_id: document.id },
  });
  expect(prepared.ok()).toBeTruthy();
  const workflow = await prepared.json();
  await page.goto("/onboarding");
  const card = page.locator(".workflow-card").filter({
    has: page.getByRole("heading", {
      name: "Archive Browser Demo",
      exact: true,
    }),
  });
  await card
    .getByRole("button", { name: "Archive onboarding", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(
    "does not cancel pending tasks or scheduled emails",
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(card).toBeVisible();
  await card
    .getByRole("button", { name: "Archive onboarding", exact: true })
    .click();
  await page.route("**/api/onboarding/" + workflow.id + "/archive", (route) =>
    route.fulfill({
      status: 403,
      json: { detail: "Archive permission denied" },
    }),
  );
  await dialog
    .getByRole("button", { name: "Confirm archive", exact: true })
    .click();
  await expect(
    page.getByText("Archive permission denied", { exact: true }),
  ).toBeVisible();
  await expect(dialog).toBeVisible();
  await page.unroute("**/api/onboarding/" + workflow.id + "/archive");
  await page.screenshot({ path: "../tmp/onboarding-archive-confirm.png" });
  await dialog
    .getByRole("button", { name: "Confirm archive", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(card).toHaveCount(0);
  const employee = await context.request.get(
    "/api/employees/" + workflow.employee.id,
  );
  expect(employee.ok()).toBeTruthy();
  expect((await employee.json()).tasks.length).toBe(5);
  const events = await (
    await context.request.get("/api/audit?q=onboarding.archived")
  ).json();
  expect(
    events.items.some((e: any) => e.object_id === workflow.id),
  ).toBeTruthy();
});

test("contract upload, persisted onboarding and sandbox email", async ({
  page,
}) => {
  const id = "BROWSER-CONTRACT-" + Date.now();
  const content = readFileSync(
    resolve("../demo/qiwa-synthetic.csv"),
    "utf8",
  ).replace("DEMO-NEW-001", id);
  await page.goto("/contracts");
  await page.getByLabel("Upload contract").setInputFiles({
    name: "browser-synthetic.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(content),
  });
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start onboarding" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Start onboarding" }).click();
  await expect(page).toHaveURL(/onboarding/);
  await expect(page.getByText("Noura Sandbox").last()).toBeVisible();
  await expect(
    page.getByText("7 of 7 automation steps verified").last(),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("Noura Sandbox").last()).toBeVisible();
});

test("Arabic chat streaming, trace and copy controls", async ({ page }) => {
  await page.route("**/api/agent/chat", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: 'event: tool\ndata: {"tool":"calculate_saudization","status":"success","verified":true,"result":{"rate":50}}\n\nevent: token\ndata: {"text":"مرحباً، هذه استجابة اختبار النقل."}\n\n',
    }),
  );
  await page.goto("/chat");
  const input = page.getByRole("textbox", { name: "Message HUMAIN Chat" });
  await input.fill("احسب نسبة التوطين");
  await input.press("Shift+Enter");
  await expect(input).toHaveValue("احسب نسبة التوطين\n");
  await input.press("Enter");
  await expect(
    page.getByText("مرحباً، هذه استجابة اختبار النقل."),
  ).toBeVisible();
  await expect(page.getByText("Connection interrupted")).toBeVisible();
  await expect(page.locator('[dir="auto"]').first()).toBeVisible();
  await expect(
    page.getByText("calculate saudization", { exact: true }),
  ).toBeVisible();
});

test("mobile navigation and layout have no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: /HUMAIN Chat/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Message HUMAIN Chat" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send message" }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "../docs/screenshots/mobile-wasl.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("API outage is visible and recoverable", async ({ page }) => {
  await page.route("**/api/dashboard", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":{"message":"Database unavailable for test"}}',
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Database unavailable for test",
  );
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("journey owns intake, policy exceptions, review, task evidence and measured comparison", async ({
  page,
  context,
}) => {
  const suffix = Date.now();
  const displayName = "Journey Browser Demo " + suffix;
  const policyTitle = "Browser demonstration policy " + suffix;
  await page.goto("/journeys");
  await page
    .getByRole("tab", { name: "Company policies", exact: true })
    .click();
  await page.getByRole("button", { name: "Load fictional sample" }).click();
  await page.getByLabel("Policy title", { exact: true }).fill(policyTitle);
  await page.getByRole("button", { name: "Save policy draft" }).click();
  await expect(page.getByRole("heading", { name: policyTitle })).toBeVisible();
  const policy = page
    .locator(".policy-list article")
    .filter({ hasText: policyTitle });
  await policy
    .getByRole("button", { name: "Authorize and activate policy" })
    .click();
  await expect(policy.getByText("Active", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Journeys", exact: true }).click();
  await page
    .getByLabel("Journey company policy")
    .selectOption({ label: policyTitle });
  const number = "JOURNEY-UI-" + suffix;
  const csv =
    "employee_name,employee_number,nationality,start_date,end_date,email,synthetic\n" +
    displayName +
    "," +
    number +
    ",Saudi,2026-01-01,2027-12-31,,true\n";
  const before = (
    await (await context.request.get("/api/communications")).json()
  ).logs.length;
  await page.getByLabel("Upload journey contract").setInputFiles({
    name: "journey-browser.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page
    .getByRole("button", { name: "Start journey", exact: true })
    .click();
  await expect(page.locator(".journey-detail")).toContainText(
    "Company policy findings require",
  );
  expect(
    (await (await context.request.get("/api/communications")).json()).logs
      .length,
  ).toBe(before);
  await page.getByRole("tab", { name: /Exceptions/ }).click();
  const card = page
    .locator(".exception-list article")
    .filter({ hasText: displayName });
  await card.getByRole("button", { name: "Resolve journey" }).click();
  await page.getByRole("button", { name: "Review source facts" }).click();
  const dialog = page.getByRole("dialog", { name: "Review contract facts" });
  await dialog.getByLabel("email", { exact: true }).fill("welcome@humain.test");
  await dialog.getByLabel("work location", { exact: true }).fill("Riyadh");
  await dialog.getByLabel("probation days", { exact: true }).fill("60");
  await dialog.getByRole("button", { name: "Save facts and resume" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".journey-detail")).toContainText(
    "SMTP accepted · inbox unverified",
  );
  await expect(page.locator(".journey-evidence")).toContainText(
    "Automation setup",
  );
  await expect(page.locator(".journey-measurement")).toContainText(
    "No manual baseline recorded",
  );
  await page
    .getByRole("button", { name: "Record measured manual baseline" })
    .click();
  const measurement = page.getByRole("dialog", {
    name: "Record a measured manual baseline",
  });
  await measurement.getByLabel("Manual duration (seconds)").fill("120");
  await measurement.getByLabel("Manual actions / interventions").fill("6");
  await measurement
    .getByLabel("What you timed and observed")
    .fill(
      "Synthetic browser fixture only; not a measured real-world time-saving claim.",
    );
  await measurement
    .getByRole("button", { name: "Save measured comparison" })
    .click();
  await expect(measurement).toBeHidden();
  await page.reload();
  await page
    .locator(".journey-list button")
    .filter({ hasText: displayName })
    .click();
  await expect(page.locator(".journey-measurement")).toContainText(
    "Manual: 120s / 6 actions",
  );
  const journeys = (await (await context.request.get("/api/journeys")).json())
    .items;
  const journey = journeys.find(
    (j: any) => j.extraction?.fields.employee_number === number,
  );
  const task = journey.tasks.find((t: any) => !t.simulated);
  await page.getByRole("tab", { name: "Tasks", exact: true }).click();
  const row = page
    .getByRole("row")
    .filter({ hasText: journey.evidence.employee_id })
    .filter({ hasText: task.title });
  await row.getByRole("button", { name: "Mark completed" }).click();
  await expect(row).toContainText("completed");
  const again = await context.request.post(
    "/api/journeys/" + journey.id + "/resume",
    { headers: { "X-Humain-Request": "1" } },
  );
  expect((await again.json()).evidence.human_tasks_pending).toBe(2);
  expect(
    (await (await context.request.get("/api/communications")).json()).logs
      .length,
  ).toBe(before + 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Journeys", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("chat sidebar searches and restores conversations with a responsive drawer", async ({
  page,
}) => {
  const created = new Date().toISOString();
  const items = [
    { id: "history-one", title: "Renewal review", created_at: created },
    { id: "history-two", title: "Onboarding plan", created_at: created },
  ];
  await page.route("**/api/agent/conversations", async (route) => {
    if (route.request().method() === "GET")
      await route.fulfill({ json: { items, total: 2 } });
    else await route.continue();
  });
  await page.route("**/api/agent/conversations/history-*", async (route) => {
    const id = route.request().url().split("/").pop();
    await route.fulfill({
      json: {
        id,
        messages: [
          {
            id: "message-" + id,
            role: "assistant",
            content: "Saved conversation " + id,
            created_at: created,
          },
        ],
        tools: [],
        workflows: [],
      },
    });
  });
  await page.goto("/chat");
  const sidebar = page.getByRole("complementary", { name: "Chat sidebar" });
  await expect(sidebar).toBeVisible();
  await expect(page.locator(".agent-context")).toHaveCount(0);
  await expect(page.getByText("Local processing", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.locator(".chat-top .wasl-symbol")).toHaveCSS(
    "background-color",
    "rgb(44, 213, 197)",
  );
  await sidebar
    .getByRole("button", { name: "Onboarding plan", exact: true })
    .click();
  await expect(
    page.getByText("Saved conversation history-two", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/conversation=history-two/);
  await page.reload();
  await expect(
    page.getByText("Saved conversation history-two", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Hide chat sidebar", exact: true })
    .click();
  await expect(sidebar).toBeHidden();
  await page
    .getByRole("button", { name: "Show chat sidebar", exact: true })
    .click();
  await sidebar
    .getByRole("textbox", { name: "Search chats", exact: true })
    .fill("renewal");
  await expect(
    sidebar.getByRole("button", { name: "Renewal review", exact: true }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("button", { name: "Onboarding plan", exact: true }),
  ).toHaveCount(0);
  await sidebar
    .getByRole("textbox", { name: "Search chats", exact: true })
    .fill("");
  await sidebar.getByRole("button", { name: "New chat", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /A little intelligence/ }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await sidebar
    .getByRole("button", { name: "Close chat sidebar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Show chat sidebar", exact: true })
    .click();
  await sidebar
    .getByRole("button", { name: "Renewal review", exact: true })
    .click();
  await expect(sidebar).toBeHidden();
  await expect(
    page.getByText("Saved conversation history-one", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("shared HUMAIN workspace card opens settings on desktop and mobile", async ({
  page,
}) => {
  for (const route of ["/", "/chat", "/journeys"]) {
    await page.goto(route);
    const card = page.getByRole("link", {
      name: "Workspace settings",
      exact: true,
    });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Workspace");
    await expect(card.locator("img")).toBeVisible();
    await expect(card.locator("img")).toHaveAttribute(
      "src",
      "/branding/humain-logo.png",
    );
    await expect
      .poll(() =>
        card
          .locator("img")
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect(card).toContainText("People operations");
    await expect(card).not.toContainText("Synthetic Enterprise");
  }
  await page
    .getByRole("link", { name: "Workspace settings", exact: true })
    .click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/chat");
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Workspace settings", exact: true })
    .click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.locator("aside.sidebar")).not.toHaveClass(/\bopen\b/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("Inter loads locally throughout the app with clear text and the marked metric footers removed", async ({
  page,
}) => {
  const routes = [
    "/",
    "/employees",
    "/onboarding",
    "/contracts",
    "/compliance",
    "/communications",
    "/analytics",
    "/audit",
    "/settings",
    "/integrations",
    "/chat",
    "/journeys",
  ];
  for (const route of routes) {
    await page.goto(route);
    await page.locator("main.content").waitFor();
    await page.evaluate(() => document.fonts.ready);
    const faces = await page.evaluate(async () => {
      const loaded = await document.fonts.load('600 13px "Inter Variable"');
      return {
        count: loaded.length,
        family: getComputedStyle(document.body).fontFamily,
        shadow: getComputedStyle(document.body).textShadow,
      };
    });
    expect(faces.count).toBeGreaterThan(0);
    expect(faces.family).toContain("Inter Variable");
    expect(faces.shadow).toBe("none");
    await expect(page.locator(".workspace-card strong")).toHaveCSS(
      "font-weight",
      "600",
    );
    if (route === "/settings" || route === "/integrations") {
      await expect(page.locator(".integration-grid")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      await expect(
        page.locator(".integration-card p, .integration-card small"),
      ).toHaveCount(0);
      await expect(page.locator(".integration-card .badge")).toHaveCount(4);
    }
    if (route === "/settings")
      await expect(page.getByText(/just like Sadiah/)).toHaveCount(0);
    if (route === "/chat") {
      await expect(
        page.getByText(/your local AI operations partner/),
      ).toHaveCount(0);
      await expect(page.locator(".composer-note > span")).toHaveCount(0);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.goto("/");
  await expect(page.locator(".metric")).toHaveCount(4);
  for (let i = 0; i < 3; i++)
    await expect(
      page.locator(".metric").nth(i).locator(".metric-bottom"),
    ).toHaveCount(0);
  await expect(
    page.locator(".metric").nth(3).locator(".metric-bottom"),
  ).toHaveCount(0);
  await expect(page.locator(".metric").nth(3)).toContainText(
    "Saudization ratio",
  );
  await expect(page.locator(".metric").nth(3)).toContainText("%");
  await page.goto("/analytics");
  await expect(
    page.getByText("Baseline needed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Only measured database counts and recorded latency/),
  ).toHaveCount(0);
  await page.goto("/employees");
  await page.getByRole("button", { name: "Add employee", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.locator(".modal-overlay")).toHaveCSS(
    "backdrop-filter",
    "none",
  );
  await expect(dialog.locator("h2")).toHaveCSS("font-weight", "600");
  await expect(dialog.locator("input").first()).toHaveCSS(
    "font-family",
    /Inter Variable/,
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/chat");
  await expect(page.locator(".composer-note")).toHaveCSS("font-size", "10px");
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
