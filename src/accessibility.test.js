import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");
function luminance(hex) {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
function ratio(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
for (const [name, selector] of [
  ["light", /:root\s*\{([^}]+)\}/],
  ["dark", /:root\[data-theme=["']?dark["']?\]\s*\{([^}]+)\}/],
])
  test(`${name} semantic text pairs meet WCAG AA normal text contrast`, () => {
    const rules = css.match(selector)[1],
      tokens = Object.fromEntries(
        [...rules.matchAll(/--([a-z-]+):\s*(#[a-fA-F0-9]{6})/g)].map((m) => [
          m[1],
          m[2],
        ]),
      );
    for (const [fg, bg] of [
      ["text", "surface"],
      ["text", "bg"],
      ["muted", "surface"],
      ["muted", "surface-alt"],
      ["accent", "surface"],
      ["accent", "accent-bg"],
      ["accent-ink", "accent"],
      ["warning", "warning-bg"],
      ["error", "error-bg"],
      ["success", "success-bg"],
    ]) {
      const value = ratio(tokens[fg], tokens[bg]);
      assert.ok(value >= 4.5, `${name}: ${fg}/${bg}: ${value.toFixed(2)}`);
    }
  });
