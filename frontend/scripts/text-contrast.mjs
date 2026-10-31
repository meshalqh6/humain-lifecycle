// Conservative lower-bound check for text over solid colors and CSS gradient stops.
// Geometry-specific gradient cases remain identifiable for visual review.
export function auditRenderedText() {
  const parse = (text) => {
    if (text === "transparent") return [0, 0, 0, 0];
    const m = text?.match(/^rgba?\(([^)]+)\)$/);
    if (!m) return null;
    const values = m[1]
      .split(/[,\s/]+/)
      .filter(Boolean)
      .map(Number);
    return [values[0], values[1], values[2], values[3] ?? 1];
  };
  const blend = (f, b) =>
    [0, 1, 2].map((i) => f[i] * (f[3] ?? 1) + b[i] * (1 - (f[3] ?? 1)));
  const lum = (c) =>
    c
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => {
    const x = lum(a),
      y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const unique = (list) => [
    ...new Map(
      list.map((c) => [c.map((x) => Math.round(x)).join(","), c]),
    ).values(),
  ];
  const layers = (value) => {
    let depth = 0,
      start = 0,
      out = [];
    for (let i = 0; i < value.length; i++) {
      if (value[i] === "(") depth++;
      if (value[i] === ")") depth--;
      if (value[i] === "," && !depth) {
        out.push(value.slice(start, i));
        start = i + 1;
      }
    }
    out.push(value.slice(start));
    return out;
  };
  const stops = (value) =>
    (value.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
  const backgrounds = new Map();
  const background = (el) => {
    if (!el) return [[255, 255, 255]];
    if (backgrounds.has(el)) return backgrounds.get(el);
    const s = getComputedStyle(el);
    let base = background(el.parentElement);
    const color = parse(s.backgroundColor);
    if (color) base = unique(base.map((b) => blend(color, b)));
    if (s.backgroundClip !== "text" && s.webkitBackgroundClip !== "text") {
      for (const layer of layers(s.backgroundImage).reverse()) {
        const colors = stops(layer);
        if (colors.length)
          base = unique(base.flatMap((b) => colors.map((c) => blend(c, b))));
      }
    }
    backgrounds.set(el, base);
    return base;
  };
  const describe = (el) =>
    el.tagName.toLowerCase() +
    (el.id ? "#" + el.id : "") +
    (typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\s+/).join(".")
      : "");
  const selector = (el) => {
    const path = [];
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const index = [...n.parentElement.children].indexOf(n) + 1;
      path.unshift(n.tagName.toLowerCase() + ":nth-child(" + index + ")");
    }
    return "body > " + path.join(" > ");
  };
  const findings = [];
  let checked = 0;
  const faded = [];
  let minRatio = 100;
  for (const el of document.querySelectorAll("body *")) {
    if (
      el.closest('[aria-hidden="true"], [inert]') ||
      ["STYLE", "SCRIPT", "NOSCRIPT", "OPTION"].includes(el.tagName)
    )
      continue;
    const s = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (
      !rect.width ||
      !rect.height ||
      s.visibility !== "visible" ||
      s.display === "none"
    )
      continue;
    let hasText = [...el.childNodes].some(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim(),
    );
    let fg = parse(el instanceof SVGElement ? s.fill : s.color);
    if (
      el.matches(
        'input:not([type="password"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]),textarea',
      )
    ) {
      hasText = !!(el.value || el.placeholder);
      if (!el.value && el.placeholder)
        fg = parse(getComputedStyle(el, "::placeholder").color);
    }
    if (!hasText || !fg) continue;
    const foregrounds =
      (s.webkitTextFillColor === "rgba(0, 0, 0, 0)" ||
        s.color === "rgba(0, 0, 0, 0)") &&
      stops(s.backgroundImage).length
        ? stops(s.backgroundImage)
        : [fg];
    let opacity = 1;
    for (let n = el; n; n = n.parentElement)
      opacity *= Number(getComputedStyle(n).opacity);
    if (opacity < 0.99) faded.push({ target: describe(el), opacity });
    const backgroundsHere = background(el);
    let worst = 100;
    for (const b of backgroundsHere)
      for (const f of foregrounds)
        worst = Math.min(
          worst,
          ratio(blend([f[0], f[1], f[2], (f[3] ?? 1) * opacity], b), b),
        );
    const size = parseFloat(s.fontSize),
      weight = Number(s.fontWeight);
    const required = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
    checked++;
    minRatio = Math.min(minRatio, worst);
    if (worst + 0.01 < required)
      findings.push({
        target: describe(el),
        selector: selector(el),
        ratio: Math.round(worst * 100) / 100,
        required,
        size,
        weight,
        color: el instanceof SVGElement ? s.fill : s.color,
        backgroundRange: backgroundsHere.map((c) => c.map(Math.round)),
        gradientText: foregrounds.length > 1,
      });
  }
  return {
    method:
      "Conservative foreground/background compositing across every CSS gradient stop; excludes hidden/decorative nodes and password values.",
    checked,
    minRatio: Math.round(minRatio * 100) / 100,
    findings,
    faded,
  };
}
