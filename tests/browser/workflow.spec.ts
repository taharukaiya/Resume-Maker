import { test, expect } from "@playwright/test";
const email = "browser-admin@integration.test",
  password = "Browser testing passphrase 2026!";
test("administrator setup, editor, permissions, publishing, and mobile layout", async ({
  page,
  request,
}) => {
  const status = await (await request.get("/api/status")).json();
  if (!status.initialized) {
    await page.goto("/setup?token=browser-test-bootstrap-only");
    await page.getByLabel("Your full name").fill("Browser Administrator");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create your workspace" }).click();
    await expect(page.getByText("Your account is ready.")).toBeVisible();
  }
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Good to see you, Browser." }),
  ).toBeVisible();
  await expect(
    page.getByText("Loading your workspace…", { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: ".test-data/dashboard-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Create a portfolio", exact: true })
    .click();
  const name = "Academic Workflow Test";
  await page.getByLabel("Researcher’s name").fill(name);
  await page
    .getByLabel("Portfolio address", { exact: true })
    .fill(`workflow-${Date.now()}`);
  await page
    .getByRole("button", { name: "Create portfolio", exact: true })
    .click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page
    .getByLabel("Academic headline")
    .fill("Investigating equitable and reliable scientific systems.");
  await page
    .getByLabel("Biography", { exact: true })
    .fill(
      "My research explores how evidence can improve decisions across scientific communities.",
    );
  await page.getByRole("tab", { name: "Academic sections" }).click();
  await page.getByLabel("Add section", { exact: true }).selectOption("about");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Draft portfolio preview"]');
  await expect(
    preview.getByRole("heading", { name, exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByText("My research explores how evidence"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close preview" }).click();
  await page.getByRole("tab", { name: "Permissions", exact: true }).click();
  await page.getByLabel("Biography", { exact: true }).check();
  await page.getByRole("button", { name: "Save permissions" }).click();
  await expect(page.getByText("Client permissions updated.")).toBeVisible();
  await page.getByRole("tab", { name: "Review & publish" }).click();
  await page.getByRole("button", { name: "Publish approved draft" }).click();
  await expect(
    page.getByRole("link", { name: "View published portfolio" }),
  ).toBeVisible({ timeout: 30000 });
  const publicUrl = await page
    .getByRole("link", { name: "View published portfolio" })
    .getAttribute("href");
  await page.screenshot({
    path: ".test-data/editor-desktop.png",
    fullPage: true,
  });
  await page.goto(publicUrl!);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `http://localhost:3100${publicUrl}`,
  );
  await page.screenshot({
    path: ".test-data/portfolio-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".test-data/portfolio-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/studio");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("link", { name: "People & access" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close navigation" }).click();
  await page.screenshot({
    path: ".test-data/dashboard-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
