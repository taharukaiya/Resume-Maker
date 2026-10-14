/** A naming suggestion only; registration and DNS ownership are separate. */
export function suggestedPortfolioDomain(name: string, slug: string) {
  const withoutTitle = name
    .trim()
    .replace(/^(?:(?:dr|prof|professor|mr|mrs|ms|mx)\.?\s+)+/i, "");
  const ascii = withoutTitle.normalize("NFKD").replace(/\p{Mark}/gu, "");
  const firstName = ascii.match(/^[a-z0-9]+/i)?.[0] || slug.split("-")[0];
  const label = firstName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 53);
  return label ? `researchby${label}.com` : "";
}
