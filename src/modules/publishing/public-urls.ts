// Releases are immutable. Update legacy URLs when serving their text so existing
// portfolios get the new canonical address without rebuilding a release.
export function migratePublicUrls(text: string, slug: string, bases: string[]) {
  for (const base of new Set(bases)) {
    const escaped = `${base.replace(/\/$/, "")}/p/${slug}`.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    text = text.replace(
      new RegExp(`${escaped}(?=[/\\?#"'\\s<]|$)`, "g"),
      `${base.replace(/\/$/, "")}/portfolio/${slug}`,
    );
  }
  return text;
}
