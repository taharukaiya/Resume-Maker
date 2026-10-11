import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: ["/studio/", "/api/", "/setup", "/accept", "/login", "/forgot"],
      allow: "/portfolio/",
    },
  };
}
