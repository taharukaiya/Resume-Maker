import { signInAdmin } from "./admin-session";
import { expect, test } from "@playwright/test";

test("admin can add, edit, remove links and icons without changing design", async ({
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
    await page.getByLabel("Button label", { exact: true }).fill("LinkedIn");
    await page.getByLabel("Icon", { exact: true }).selectOption("linkedin");
    const url = page.locator('[data-profile-link="0"]');
    await url.fill("  linkedin.com/in/researcher  ");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
    let saved = await (await page.request.get(`/api/sites/${id}`)).json();
    expect(saved.site.draft.profile.links[0].label).toBe("LinkedIn");
    expect(saved.site.draft.profile.links[0].url).toBe(
      "https://linkedin.com/in/researcher",
    );
    await expect(url).toHaveValue("https://linkedin.com/in/researcher");
    await url.fill("not a valid address");
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
    await page
      .getByLabel("Button label", { exact: true })
      .fill("Personal Website");
    await page.getByLabel("Icon", { exact: true }).selectOption("website");
    await url.fill("https://example.github.io/");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Icon", { exact: true })).toHaveValue(
      "website",
    );
    await expect(page.getByLabel("Button label", { exact: true })).toHaveValue(
      "Personal Website",
    );
    await page
      .getByRole("button", { name: "Remove link", exact: true })
      .click();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator("[data-profile-link]")).toHaveCount(0);
    await expect(
      page
        .getByRole("combobox", { name: "Editing" })
        .locator('option[value="design"]'),
    ).toHaveCount(0);
  } finally {
    await page.request.delete(`/api/sites/${id}`, { headers });
  }
});
