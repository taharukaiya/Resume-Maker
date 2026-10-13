import { readableInk } from "@/lib/colors";

export function nameInitials(name: string) {
  const parts = name
    .trim()
    .replace(/^(?:(?:dr|prof|professor)\.?\s+)+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  const chosen = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return (
    chosen
      .map((part) => Array.from(part)[0])
      .join("")
      .toLocaleUpperCase()
      .slice(0, 8) || "R"
  );
}

export function initialsFavicon(name: string, accent: string) {
  const color = /^#[\da-f]{6}$/i.test(accent) ? accent : "#164e63";
  const initials = nameInitials(name).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${color}"/><text x="32" y="42" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="${readableInk(color)}">${initials}</text></svg>`;
}
