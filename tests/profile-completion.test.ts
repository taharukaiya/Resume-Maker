import { expect, it } from "vitest";
import { emptyDocument } from "../src/modules/portfolios/schema";
import { profileCompletion } from "../src/modules/portfolios/profile-completion";

it("counts five clear profile basics without requiring optional content", () => {
  const profile = emptyDocument("Researcher").profile;
  expect(profileCompletion(profile).percentage).toBe(20);
  Object.assign(profile, {
    headline: "Educator",
    bio: "My biography",
    portraitId: "photo-id",
  });
  expect(profileCompletion(profile).percentage).toBe(80);
  profile.email = "researcher@example.com";
  expect(profileCompletion(profile).percentage).toBe(100);
  profile.email = "";
  profile.links = [{ label: "Profile", url: "https://example.com/researcher" }];
  expect(profileCompletion(profile).percentage).toBe(100);
  profile.bio = "  ";
  expect(profileCompletion(profile).percentage).toBe(80);
});

it("does not count whitespace or invalid contact links", () => {
  const profile = emptyDocument(" ").profile;
  profile.email = "bad email";
  profile.links = [{ label: "Bad link", url: "javascript:alert(1)" }];
  expect(profileCompletion(profile).percentage).toBe(0);
});
