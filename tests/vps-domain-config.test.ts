import { describe, expect, it } from "vitest";
import { vpsDomainConfig } from "../src/lib/vps-domain-config";
import {
  documentSchema,
  emptyDocument,
} from "../src/modules/portfolios/schema";

describe("researcher proxy configuration", () => {
  it("reserves the sign-in address instead of publishing an unreachable page", () => {
    const doc = emptyDocument("Researcher");
    doc.pages = [
      {
        id: crypto.randomUUID(),
        title: "Login",
        slug: "biography",
        description: "",
        sections: [],
      },
    ];
    expect(documentSchema.safeParse(doc).success).toBe(true);
    doc.pages[0].slug = "login";
    expect(documentSchema.safeParse(doc).success).toBe(false);
  });
  it("uses internal HTTP behind an existing TLS proxy, while preserving route isolation", () => {
    const config = vpsDomainConfig("researcher.example.com", true);
    expect(config).toMatch(/^http:\/\/researcher.example.com:8080 \{/);
    expect(config).toContain("rewrite * /website/researcher.example.com{uri}");
    expect(config).toContain("header_up -Cookie");
    expect(config).toContain('respond "Method not allowed." 405');
  });
  it("retains automatic HTTPS addresses for empty-server deployments", () => {
    expect(vpsDomainConfig("researcher.example.com", false)).toMatch(
      /^researcher.example.com \{/,
    );
  });
  it.each([
    "example.com\n}",
    "example.com:443",
    "../example.com",
    "example.com/path",
    "*.example.com",
  ])("rejects configuration injection: %s", (hostname) => {
    expect(() => vpsDomainConfig(hostname, true)).toThrow(
      "Invalid researcher hostname",
    );
  });
});
