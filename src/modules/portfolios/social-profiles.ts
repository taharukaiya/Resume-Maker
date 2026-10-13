/** Shared labels for manual editing and AI imports. Stored labels remain backwards compatible. */
export const socialPlatforms = [
  "Google Scholar",
  "ORCID",
  "ResearchGate",
  "LinkedIn",
  "GitHub",
  "GitLab",
  "Academia.edu",
  "Semantic Scholar",
  "Scopus",
  "Web of Science",
  "Facebook",
  "Instagram",
  "X",
  "Bluesky",
  "Mastodon",
  "YouTube",
  "Medium",
  "Substack",
  "Website",
  "Other profile",
] as const;

const platformDomains: Record<string, string> = {
  "scholar.google.com": "Google Scholar",
  "orcid.org": "ORCID",
  "researchgate.net": "ResearchGate",
  "linkedin.com": "LinkedIn",
  "github.com": "GitHub",
  "gitlab.com": "GitLab",
  "academia.edu": "Academia.edu",
  "semanticscholar.org": "Semantic Scholar",
  "scopus.com": "Scopus",
  "webofscience.com": "Web of Science",
  "facebook.com": "Facebook",
  "fb.com": "Facebook",
  "instagram.com": "Instagram",
  "twitter.com": "X",
  "x.com": "X",
  "bsky.app": "Bluesky",
  "youtube.com": "YouTube",
  "medium.com": "Medium",
  "substack.com": "Substack",
};

export function socialPlatform(url: string): string | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return Object.entries(platformDomains).find(
      ([domain]) => host === domain || host.endsWith(`.${domain}`),
    )?.[1];
  } catch {
    return undefined;
  }
}

export function profileLinkKey(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.toLowerCase().replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}
