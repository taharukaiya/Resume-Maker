/** Shared, allowlisted design choices for the editor and static publisher. */
export const fontIds = [
  "serif",
  "sans",
  "fraunces",
  "cormorant-garamond",
  "playfair-display",
  "dm-sans",
  "manrope",
  "space-grotesk",
] as const;
export type FontId = (typeof fontIds)[number];
export const fonts: Record<
  FontId,
  { label: string; family: string; file?: string }
> = {
  serif: { label: "Georgia · classic serif", family: "Georgia,serif" },
  sans: { label: "System · native sans", family: "system-ui,sans-serif" },
  fraunces: {
    label: "Fraunces · expressive editorial",
    family: "'Portfolio Fraunces',Georgia,serif",
    file: "fraunces.woff2",
  },
  "cormorant-garamond": {
    label: "Cormorant Garamond · refined literary",
    family: "'Portfolio Cormorant Garamond',Georgia,serif",
    file: "cormorant-garamond.woff2",
  },
  "playfair-display": {
    label: "Playfair Display · elegant contrast",
    family: "'Portfolio Playfair Display',Georgia,serif",
    file: "playfair-display.woff2",
  },
  "dm-sans": {
    label: "DM Sans · warm and clear",
    family: "'Portfolio DM Sans',system-ui,sans-serif",
    file: "dm-sans.woff2",
  },
  manrope: {
    label: "Manrope · precise and contemporary",
    family: "'Portfolio Manrope',system-ui,sans-serif",
    file: "manrope.woff2",
  },
  "space-grotesk": {
    label: "Space Grotesk · distinctive geometric",
    family: "'Portfolio Space Grotesk',system-ui,sans-serif",
    file: "space-grotesk.woff2",
  },
};
export const styles = [
  {
    id: "editorial",
    name: "Editorial",
    description:
      "A journal-like composition with generous margins and a strong typographic hierarchy.",
  },
  {
    id: "modern",
    name: "Studio",
    description:
      "Architectural lines, numbered sections, and confident research cards.",
  },
  {
    id: "classic",
    name: "Archive",
    description:
      "A centered scholarly introduction with an understated, timeless rhythm.",
  },
  {
    id: "aurora",
    name: "Aurora",
    description:
      "Soft color fields, luminous surfaces, and a statement introduction.",
  },
  {
    id: "folio",
    name: "Folio",
    description:
      "An oversized editorial opening, framed portrait, and intimate reading column.",
  },
] as const;
export const palettes = [
  {
    name: "Iris & Pearl",
    accent: "#5941a9",
    background: "#faf8ff",
    secondary: "#efac8e",
    text: "#252136",
  },
  {
    name: "Cobalt & Ice",
    accent: "#204ed8",
    background: "#f5f8ff",
    secondary: "#72d5dd",
    text: "#17243d",
  },
  {
    name: "Forest & Linen",
    accent: "#195b45",
    background: "#faf8f2",
    secondary: "#d8ad65",
    text: "#24372e",
  },
  {
    name: "Crimson & Porcelain",
    accent: "#ad2439",
    background: "#fff8f6",
    secondary: "#ecab6f",
    text: "#3b252c",
  },
  {
    name: "Ocean & Sand",
    accent: "#096474",
    background: "#f6fbfa",
    secondary: "#e6ba8e",
    text: "#203b40",
  },
  {
    name: "Plum & Rose",
    accent: "#783c80",
    background: "#fff8fd",
    secondary: "#dd97a9",
    text: "#36283d",
  },
  {
    name: "Midnight & Lilac",
    accent: "#c1b3ff",
    background: "#141522",
    secondary: "#5ba5b9",
    text: "#eeeef7",
  },
  {
    name: "Ink & Amber",
    accent: "#f0c175",
    background: "#1b201e",
    secondary: "#719990",
    text: "#f4f3e9",
  },
] as const;
export const fontPairs: { name: string; font: FontId; bodyFont: FontId }[] = [
  { name: "The editorial", font: "fraunces", bodyFont: "dm-sans" },
  { name: "The scholar", font: "cormorant-garamond", bodyFont: "manrope" },
  { name: "The contemporary", font: "space-grotesk", bodyFont: "dm-sans" },
  { name: "The distinguished", font: "playfair-display", bodyFont: "manrope" },
];
export function selectedFonts(theme: { font: FontId; bodyFont?: FontId }) {
  return [...new Set([theme.font, theme.bodyFont || "sans"])].filter(
    (id) => fonts[id].file,
  );
}
export function fontFaceCss(
  theme: { font: FontId; bodyFont?: FontId },
  url: (file: string) => string,
) {
  return selectedFonts(theme)
    .map((id) => {
      const font = fonts[id];
      return `@font-face{font-family:${font.family.split(",")[0]};src:url("${url(font.file!)}") format("woff2");font-style:normal;font-weight:100 900;font-display:swap;}`;
    })
    .join("");
}
