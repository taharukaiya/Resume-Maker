import type { PortfolioDocument } from "./schema";

/** Basic profile completeness, independent of optional content and publishing. */
export function profileCompletion(profile: PortfolioDocument["profile"]) {
  const filled = (value?: string) => !!value?.trim();
  const checks = [
    { label: "Full name", complete: filled(profile.name) },
    { label: "Professional headline", complete: filled(profile.headline) },
    { label: "Biography", complete: filled(profile.bio) },
    { label: "Profile photo", complete: filled(profile.portraitId) },
    {
      label: "Contact email or profile link",
      complete:
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim()) ||
        profile.links.some((link) => {
          try {
            const url = new URL(link.url);
            return ["https:", "http:"].includes(url.protocol) && !!url.hostname;
          } catch {
            return false;
          }
        }),
    },
  ];
  const completed = checks.filter((check) => check.complete).length;
  return {
    checks,
    completed,
    percentage: Math.round((completed / checks.length) * 100),
  };
}
