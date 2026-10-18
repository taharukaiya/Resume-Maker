import { expect, test } from "@playwright/test";
import { signInAdmin } from "./admin-session";

const headers = { origin: "http://localhost:3100" };

test("admin can add a root domain while preserving an unsaved portfolio draft", async ({
  page,
}) => {
  await signInAdmin(page);
  const created = await page.request.post("/api/sites", {
    headers,
    data: { name: "Raisa Akter", slug: `domain-setup-${Date.now()}` },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  await page.goto(`/studio/portfolios/${id}`);
  await page
    .getByLabel("Biography", { exact: true })
    .fill("Keep these unsaved edits.");
  await page.getByRole("tab", { name: "Website address", exact: true }).click();
  await expect(
    page.getByText("Suggested domain: researchbyraisa.com", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Use suggested name", exact: true })
    .click();
  await expect(page.getByLabel("Domain name", { exact: true })).toHaveValue(
    "researchbyraisa.com",
  );
  const hostname = `researcher-${Date.now()}.example.com`;
  await page
    .getByLabel("Domain name", { exact: true })
    .fill(`https://${hostname}/`);
  await page.getByRole("button", { name: "Add domain", exact: true }).click();
  await expect(
    page.getByText(`_brilliancy.${hostname}`, { exact: true }).first(),
  ).toBeVisible();
  const choice = page.getByLabel("Public website address", { exact: true });
  await expect(choice.locator("option", { hasText: hostname })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save website address" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Unsaved changes", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Remove domain", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove domain", exact: true })
    .click();
  await expect(
    page.getByText("Domain removed from setup.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Editing", { exact: true }).selectOption("profile");
  await expect(page.getByLabel("Biography", { exact: true })).toHaveValue(
    "Keep these unsaved edits.",
  );
});

test("selecting a connected domain keeps the live address until republishing", async ({
  page,
}) => {
  await signInAdmin(page);
  const created = await page.request.post("/api/sites", {
    headers,
    data: { name: "Rukaiya Taha", slug: `domain-switch-${Date.now()}` },
  });
  const { id } = await created.json();
  const domain = {
    id: "dc02ba25-002c-43d7-9e79-d9c4edab5350",
    hostname: "researchbyrukaiya.com",
    verification_token: "example-verification-token",
    verified_at: "2026-01-01T00:00:00Z",
    activated_at: "2026-01-01T00:00:00Z",
    cdn_hostname: null,
    distribution_id: null,
    is_primary: false,
  };
  const liveUrl = "https://studio.example.com/portfolio/rukaiya-taha";
  await page.route(`**/api/sites/${id}`, async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ response, json: { ...data, publishedUrl: liveUrl } });
  });
  await page.route(`**/api/sites/${id}/domains`, async (route) => {
    if (route.request().method() === "PUT") {
      expect(route.request().postDataJSON()).toEqual({ domainId: domain.id });
      domain.is_primary = true;
      await route.fulfill({ json: { ok: true } });
    } else {
      await route.fulfill({ json: { domains: [domain], hostingMode: "vps" } });
    }
  });
  await page.goto(`/studio/portfolios/${id}`);
  await page.getByRole("tab", { name: "Website address", exact: true }).click();
  await page
    .getByLabel("Public website address", { exact: true })
    .selectOption(domain.id);
  await expect(
    page.getByRole("button", { name: "Review & publish", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("tab", { name: "Review & publish", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "Leave the unsaved address selection?",
  );
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    page.getByLabel("Public website address", { exact: true }),
  ).toHaveValue(domain.id);
  await page
    .getByRole("button", { name: "Save website address", exact: true })
    .click();
  await expect(
    page.getByText(
      "Address saved. Review and publish the portfolio to apply it.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator(".address-current a")).toHaveAttribute(
    "href",
    liveUrl,
  );
  await expect(page.locator(".domain-next-url")).toHaveText(
    "https://researchbyrukaiya.com",
  );
  await expect(
    page.getByText(
      "The live address above stays in use until you publish the selected address.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.screenshot({
    path: ".test-data/website-address-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".test-data/website-address-mobile.png",
    fullPage: true,
  });
});

test("paired domain instructions are clear on desktop and mobile", async ({
  page,
}) => {
  await signInAdmin(page);
  const created = await page.request.post("/api/sites", {
    headers,
    data: { name: "Rukaiya Taha", slug: `domain-dns-${Date.now()}` },
  });
  const { id } = await created.json();
  await page.route(`**/api/sites/${id}/domains`, (route) =>
    route.fulfill({
      json: {
        hostingMode: "vps",
        dnsTarget: "187.127.210.231",
        studioUrl: "https://studio.example.com",
        domains: [
          {
            id: "dc02ba25-002c-43d7-9e79-d9c4edab5350",
            hostname: "www.researchbyrukaiya.com",
            verification_hostname: "researchbyrukaiya.com",
            verification_token: "example-ownership-token",
            verified_at: null,
            activated_at: null,
            is_primary: false,
          },
        ],
      },
    }),
  );
  await page.goto(`/studio/portfolios/${id}`);
  await page.getByRole("tab", { name: "Website address", exact: true }).click();
  await expect(page.getByLabel("Domain name", { exact: true })).toHaveValue(
    "researchbyrukaiya.com",
  );
  await expect(
    page.getByRole("cell", { name: "187.127.210.231", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check DNS & connect", exact: true }),
  ).toBeVisible();
  await page.locator(".domain-record").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/domain-dns-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/domain-dns-mobile.png",
    fullPage: true,
  });
});
