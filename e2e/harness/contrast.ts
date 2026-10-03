/**
 * Shared in-page contrast oracle (GitHub #55 / #56).
 *
 * Extracted UNCHANGED from `e2e/gate-export-ux.spec.ts` so multiple browser
 * oracles share the exact same, falsifiable measurement. The helper deliberately
 * carries its own falsifiable self-test in `gate-export-ux.spec.ts`: a planted
 * low-contrast normal-text pair is flagged, the same grey at a genuinely large
 * size is accepted, and alpha compositing is verified.
 */
import { expect, type Locator } from "@playwright/test";

export type ContrastResult = {
  readonly ratio: number;
  readonly fontSize: number;
  readonly fontWeight: number;
  readonly largeText: boolean;
  readonly threshold: number;
  readonly pass: boolean;
  readonly foreground: string;
  readonly background: string;
};

/**
 * Measured in the page: composite the effective background by walking up the
 * DOM (alpha-blending rgba layers over a white page base), compute the WCAG
 * relative luminance of the foreground and effective background, and apply the
 * correct large-text threshold from the RENDERED font size/weight.
 */
export function measureContrast(element: HTMLElement): ContrastResult {
  type Rgba = { r: number; g: number; b: number; a: number };
  const parseColor = (value: string): Rgba | null => {
    const match = /^rgba?\(([^)]+)\)$/.exec(value.trim());
    if (match === null) return null;
    const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
    if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  // Source-over compositing of `top` over opaque/translucent `bottom`.
  const over = (top: Rgba, bottom: Rgba): Rgba => {
    const alpha = top.a + bottom.a * (1 - top.a);
    if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const channel = (t: number, b: number) => (t * top.a + b * bottom.a * (1 - top.a)) / alpha;
    return {
      r: channel(top.r, bottom.r),
      g: channel(top.g, bottom.g),
      b: channel(top.b, bottom.b),
      a: alpha,
    };
  };
  const luminance = (color: Rgba): number => {
    const linear = (value: number): number => {
      const s = value / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
  };

  const style = getComputedStyle(element);
  const foreground = parseColor(style.color) ?? { r: 0, g: 0, b: 0, a: 1 };

  const layers: Rgba[] = [];
  let node: HTMLElement | null = element;
  while (node !== null) {
    const background = parseColor(getComputedStyle(node).backgroundColor);
    if (background !== null && background.a > 0) layers.push(background);
    node = node.parentElement;
  }
  // White page base, then every ancestor background from root down to element.
  let composited: Rgba = { r: 255, g: 255, b: 255, a: 1 };
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    composited = over(layers[index], composited);
  }

  const light = Math.max(luminance(foreground), luminance(composited));
  const dark = Math.min(luminance(foreground), luminance(composited));
  const ratio = (light + 0.05) / (dark + 0.05);

  const fontSize = Number.parseFloat(style.fontSize);
  const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
  // WCAG large text: >= 18pt (24px), or >= 14pt (18.6667px) and bold.
  const largeText = fontSize >= 24 || (fontSize >= 18.6667 && fontWeight >= 700);
  const threshold = largeText ? 3 : 4.5;

  return {
    ratio,
    fontSize,
    fontWeight,
    largeText,
    threshold,
    pass: ratio >= threshold,
    foreground: style.color,
    background: `rgb(${Math.round(composited.r)}, ${Math.round(composited.g)}, ${Math.round(
      composited.b
    )})`,
  };
}

export async function contrastOf(locator: Locator): Promise<ContrastResult> {
  return locator.evaluate(measureContrast);
}

export async function expectContrast(locator: Locator, label: string): Promise<ContrastResult> {
  const result = await contrastOf(locator);
  if (process.env.UX_CONTRAST_REPORT === "1") {
    // Deterministic evidence when explicitly requested; silent otherwise.
    console.log(
      `[contrast] ${label}: ${result.foreground} on ${result.background} = ${result.ratio.toFixed(
        2
      )}:1 (${result.largeText ? "large" : "normal"} text ${result.fontSize}px/${
        result.fontWeight
      }, threshold ${result.threshold})`
    );
  }
  expect(
    result.pass,
    `${label}: ${result.foreground} on ${result.background} = ${result.ratio.toFixed(
      2
    )}:1 (threshold ${result.threshold}, ${result.largeText ? "large" : "normal"} text ${
      result.fontSize
    }px/${result.fontWeight})`
  ).toBe(true);
  // Real measured value, not a placeholder: a finite ratio inside the possible range.
  expect(result.ratio).toBeGreaterThan(1);
  expect(result.ratio).toBeLessThanOrEqual(21);
  return result;
}
