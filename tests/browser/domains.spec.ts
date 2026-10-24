import { expect, test } from "@playwright/test";
import { signInAdmin } from "./admin-session";

const headers = { origin: "http://localhost:3100" };

test("profile progress updates and domain purchase guidance keeps launch disabled", async ({
  page,
}) => {
  await signInAdmin(page);
  const created = await page.request.post("/api/sites", {
    headers,
    data: { name: "Completion Test", slug: `completion-${Date.now()}` },
  });
  const { id } = await created.json();
  let preparation = {
    status: "purchase_required",
    message: "This domain needs to be purchased before setup.",
  };
  await page.route(`**/api/sites/${id}/domains`, (route) =>
    route.fulfill({
      json: {
        hostingMode: "vps",
        automation: {
          configured: true,
          available: true,
          goLiveEnabled: false,
          allowedDomains: [],
        },
        domains: [
          {
            id: "dc02ba25-002c-43d7-9e79-d9c4edab5350",
            hostname: "www.researchbytaha.com",
            verification_hostname: "researchbytaha.com",
            verified_at: null,
            activated_at: null,
            verification_token: "test-proof",
            is_primary: false,
            preparation,
          },
        ],
      },
    }),
  );
  await page.goto(`/studio/portfolios/${id}`);
  const progress = page.getByRole("progressbar", {
    name: "Profile completion",
  });
  await expect(progress).toHaveAttribute("value", "20");
  await page
    .getByLabel("Biography", { exact: true })
    .fill("A biography added without saving.");
  await expect(progress).toHaveAttribute("value", "40");
  await page.getByText("See what’s left to add", { exact: true }).click();
  await expect(
    page.getByText("Biography — Added", { exact: false }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Website address", exact: true }).click();
  await expect(
    page.getByText("Purchase this domain first", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check again after purchase" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Go live", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: ".test-data/purchase-guidance-desktop.png",
    fullPage: true,
  });
  preparation = {
    status: "dns_setup_required",
    message: "The DNS zone needs to be added to your Hostinger account.",
  };
  await page
    .getByRole("button", { name: "Refresh status", exact: true })
    .click();
  await expect(
    page.getByText("Add the domain to Hostinger DNS Manager once", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Go live", exact: true }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".test-data/profile-domain-mobile.png",
    fullPage: true,
  });
});

test("a stale initial editor response cannot replace a newer edit", async ({
  page,
}) => {
  test.setTimeout(120000);
  await signInAdmin(page);
  const created = await page.request.post("/api/sites", {
    headers,
    data: { name: "Delayed editor", slug: `delayed-editor-${Date.now()}` },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  let oldFinished!: () => void;
  const finished = new Promise<void>((resolve) => {
    oldFinished = resolve;
  });
  await page.route(`**/api/sites/${id}`, async (route) => {
    if (route.request().method() !== "GET" || ++requests !== 1) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
    oldFinished();
  });
  try {
    await page.goto(`/studio/portfolios/${id}`);
    // Strict Mode starts a second initial load; let it finish before the old one.
    const biography = page.getByLabel("Biography", { exact: true });
    await biography.fill("Keep my latest biography.");
    await expect(
      page.getByText("Unsaved changes", { exact: true }),
    ).toBeVisible();
    release();
    await finished;
    await page
      .getByRole("tab", { name: "Website address", exact: true })
      .click();
    await expect(page.getByLabel("Domain name", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Profile", exact: true }).click();
    await expect(biography).toHaveValue("Keep my latest biography.");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
    const saved = await (await page.request.get(`/api/sites/${id}`)).json();
    expect(saved.site.draft.profile.bio).toBe("Keep my latest biography.");
  } finally {
    release();
  }
});

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
  await page.getByText("Manual DNS instructions", { exact: true }).click();
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

test("preparation is separate from go live on desktop and mobile", async ({
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
        automation: {
          available: true,
          configured: true,
          goLiveEnabled: false,
          allowedDomains: [],
        },
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
  const calls: string[] = [];
  await page.route(`**/api/sites/${id}/prepare-domain`, async (route) => {
    calls.push(route.request().url());
    expect(route.request().postDataJSON()).toEqual({
      domainId: "dc02ba25-002c-43d7-9e79-d9c4edab5350",
    });
    await route.fulfill({ status: 202, json: { ok: true } });
  });
  await page.route(`**/api/sites/${id}/go-live-domain`, async (route) => {
    calls.push(route.request().url());
    await route.fulfill({ status: 409, json: { error: "Launch paused" } });
  });
  await expect(
    page.getByRole("button", { name: "Go live", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Prepare domain", exact: true })
    .click();
  await expect(
    page.getByText(
      "Preparation requested. Your existing website stays unchanged.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain("/prepare-domain");
  await expect(
    page.getByRole("button", { name: "Go live", exact: true }),
  ).toBeDisabled();
  await page.getByText("Manual DNS instructions", { exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "187.127.210.231", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Verify manual TXT record", exact: true }),
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
