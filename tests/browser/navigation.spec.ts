import { signInAdmin } from "./admin-session";
import { expect, test } from "@playwright/test";

test("navigation stays responsive while routes and data are slow", async ({
  page,
  request,
}) => {
  await signInAdmin(page);
  await page.goto("/studio");
  await expect(
    page.getByRole("heading", { name: "Good to see you, Browser." }),
  ).toBeVisible();
  await expect(
    page.getByText("Loading your workspace…", { exact: true }),
  ).toHaveCount(0);

  // A full document reload would remove this marker. Client-side navigation
  // must retain the shell and keep its controls usable throughout the delay.
  await page.evaluate(() => {
    document.body.dataset.navigationMarker = "same-document";
  });
  let releaseRoute!: () => void;
  let releaseData!: () => void;
  const routeGate = new Promise<void>((resolve) => {
    releaseRoute = resolve;
  });
  const dataGate = new Promise<void>((resolve) => {
    releaseData = resolve;
  });
  await page.route("**/studio/inbox?*", async (route) => {
    await routeGate;
    await route.continue();
  });
  await page.route("**/api/inquiries", async (route) => {
    await dataGate;
    await route.continue();
  });
  const navigation = page.getByRole("navigation", {
    name: "Workspace navigation",
  });
  const inboxLink = navigation.locator('a[href="/studio/inbox"]');
  try {
    await inboxLink.click();
    await expect(inboxLink.getByRole("status")).toHaveText("Opening page…", {
      timeout: 1500,
    });
    await expect(
      navigation.getByRole("link", { name: "Settings & security" }),
    ).toBeVisible();
    releaseRoute();
    await page.waitForURL("**/studio/inbox", { timeout: 60000 });
    await expect(
      page.getByRole("heading", { name: "Your inbox." }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("Loading messages…");
    await expect(page.getByText("Room for a new connection.")).toHaveCount(0);
    await expect(inboxLink).toHaveAttribute("aria-current", "page");
    await expect(inboxLink.getByRole("status")).toHaveCount(0);
    await page.screenshot({
      path: ".test-data/navigation-loading.png",
      fullPage: true,
    });
  } finally {
    releaseRoute();
    releaseData();
  }
  await expect(page.getByText("Loading messages…")).toHaveCount(0);
  await expect(page.locator("body")).toHaveAttribute(
    "data-navigation-marker",
    "same-document",
  );

  // Keyboard activation and browser history use the same client transitions.
  const portfolios = navigation.getByRole("link", {
    name: "Portfolios",
    exact: true,
  });
  await portfolios.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Your portfolios." }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Your inbox." }),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await navigation.getByRole("link", { name: "People & access" }).click();
  await expect(
    page.getByRole("heading", { name: "People & access." }),
  ).toBeVisible();
  await expect(page.locator(".sidebar")).not.toHaveClass(/\bopen\b/);
  await expect(page.locator("body")).toHaveAttribute(
    "data-navigation-marker",
    "same-document",
  );
});
