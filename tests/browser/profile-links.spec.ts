import { signInAdmin } from "./admin-session";
import { expect, test } from "@playwright/test";

test("saving from Design normalizes profile URLs and reveals invalid links", async ({
  page,
}) => {
  test.setTimeout(120000);
  const headers = { origin: "http://localhost:3100" };
  await signInAdmin(page);
  const created = await page.request.post("/api/sites", {
    headers,
    data: {
      name: "Link validation researcher",
      slug: `link-validation-${Date.now()}`,
    },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  try {
    await page.goto(`/studio/portfolios/${id}`);
    await page.getByRole("button", { name: "Add link", exact: true }).click();
    const url = page.locator('[data-profile-link="0"]');
    await url.fill("  linkedin.com/in/researcher  ");
    await page.getByRole("tab", { name: "Design", exact: true }).click();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
    let saved = await (await page.request.get(`/api/sites/${id}`)).json();
    expect(saved.site.draft.profile.links[0].url).toBe(
      "https://linkedin.com/in/researcher",
    );
    await page.getByRole("tab", { name: "Profile", exact: true }).click();
    await expect(url).toHaveValue("https://linkedin.com/in/researcher");
    await url.fill("not a valid address");
    await page.getByRole("tab", { name: "Design", exact: true }).click();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(url).toBeFocused();
    await expect(url).toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByRole("alert").filter({ hasText: "Profile link 1" }),
    ).toBeVisible();
    saved = await (await page.request.get(`/api/sites/${id}`)).json();
    expect(saved.site.draft.profile.links[0].url).toBe(
      "https://linkedin.com/in/researcher",
    );
    await url.fill("");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(url).toHaveValue("");
  } finally {
    await page.request.delete(`/api/sites/${id}`, { headers });
  }
});
