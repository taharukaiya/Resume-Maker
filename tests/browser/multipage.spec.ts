import { signInAdmin } from "./admin-session";
import { expect, test } from "@playwright/test";
import {
  emptyDocument,
  emptyEntry,
  type Section,
} from "../../src/modules/portfolios/schema";
import { signatureLooks } from "../../src/modules/portfolios/design";

test("academic order, editable pages, refined layouts and accessible mobile menus", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const headers = { origin: "http://localhost:3100" };
  await signInAdmin(page);
  const slug = `multipage-${Date.now()}`;
  const created = await page.request.post("/api/sites", {
    headers,
    data: { name: "Dr. Samira Rahman", slug },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  const doc = emptyDocument("Dr. Samira Rahman");
  doc.theme = { ...doc.theme, ...signatureLooks[0].theme };
  doc.profile.headline =
    "Understanding a changing world, one question at a time.";
  doc.profile.affiliation = "Environmental Systems Research";
  doc.profile.bio =
    "I study the connections between climate, communities, and the places we call home. My research brings together field evidence and computational methods to understand how cities can adapt to environmental change.\n\nI am interested in collaborative work that connects scientific insight with thoughtful public decisions.";
  doc.profile.location = "Dhaka, Bangladesh";
  doc.profile.email = "researcher@example.org";
  const section = (
    type: Section["type"],
    title: string,
    entry: string,
    subtitle: string,
  ): Section => ({
    id: crypto.randomUUID(),
    type,
    title,
    visible: true,
    intro: "",
    entries: [
      {
        ...emptyEntry(),
        title: entry,
        subtitle,
        start: "2024",
        current: true,
        body: "Research shaped by careful observation, open methods, and collaboration across disciplines.",
      },
    ],
  });
  doc.sections = [
    section(
      "custom",
      "Beyond research",
      "Photography & field journals",
      "Observing the everyday",
    ),
    section(
      "publications",
      "Selected publications",
      "How coastal communities adapt to a changing climate",
      "Environmental research · 2025",
    ),
    section(
      "experience",
      "Research experience",
      "Research associate",
      "Environmental Systems Laboratory",
    ),
    section(
      "education",
      "Education",
      "MSc in Environmental Science",
      "University research programme",
    ),
  ];
  let revision = 1;
  const save = async () => {
    const response = await page.request.put(`/api/sites/${id}`, {
      headers,
      data: { document: doc, revision },
    });
    expect(response.ok()).toBeTruthy();
    revision = (await response.json()).revision;
  };
  const reader = await browser.newContext({
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
    viewport: { width: 1440, height: 1000 },
  });
  const publicPage = await reader.newPage();
  try {
    for (const look of signatureLooks.slice(0, 2)) {
      doc.theme = { ...doc.theme, ...look.theme };
      await save();
      await publicPage.setViewportSize({ width: 1440, height: 1000 });
      await publicPage.goto(`/api/sites/${id}/preview`);
      await expect(
        publicPage.getByRole("heading", {
          name: doc.profile.name,
          exact: true,
        }),
      ).toBeVisible();
      await publicPage.screenshot({
        animations: "disabled",
        path: `.test-data/multipage-${look.theme.style}-desktop.png`,
        fullPage: true,
      });
      await publicPage
        .getByRole("navigation", { name: "Main navigation", exact: true })
        .getByRole("link", { name: "About", exact: true })
        .click();
      await expect(publicPage.locator(".section-head h2")).toHaveText([
        "About",
        "Education",
        "Research experience",
        "Beyond research",
      ]);
      await publicPage.setViewportSize({ width: 390, height: 844 });
      await publicPage
        .getByRole("button", { name: "Menu", exact: true })
        .click();
      await expect(
        publicPage.getByRole("navigation", {
          name: "Mobile navigation",
          exact: true,
        }),
      ).toBeVisible();
      await publicPage.screenshot({
        animations: "disabled",
        path: `.test-data/multipage-${look.theme.style}-menu.png`,
      });
      await publicPage
        .getByRole("navigation", { name: "Mobile navigation", exact: true })
        .getByRole("link", { name: "Contact", exact: true })
        .click();
      await expect(publicPage).toHaveTitle(`Contact — ${doc.profile.name}`);
      await expect(
        publicPage.getByLabel("Your name", { exact: true }),
      ).toBeVisible();
      await expect(
        publicPage.getByRole("navigation", {
          name: "Mobile navigation",
          exact: true,
        }),
      ).toBeHidden();
      await publicPage.screenshot({
        animations: "disabled",
        path: `.test-data/multipage-${look.theme.style}-contact-mobile.png`,
        fullPage: true,
      });
      expect(
        await publicPage.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.goto(`/studio/portfolios/${id}`);
    await page
      .getByRole("tab", { name: "Academic sections", exact: true })
      .click();
    const headings = page.locator(".section-editor > summary > strong");
    await expect(headings.first()).toHaveText("Education");
    await page
      .getByRole("button", { name: "Move Education down", exact: true })
      .click();
    await expect(headings.first()).toHaveText("Research experience");
    await page
      .getByRole("button", { name: "Use academic order", exact: true })
      .click();
    await expect(headings.first()).toHaveText("Education");
    await page
      .getByLabel("Add section", { exact: true })
      .selectOption("awards");
    await expect(headings).toHaveText([
      "Education",
      "Research experience",
      "Awards",
      "Beyond research",
    ]);
    await page.getByRole("tab", { name: "Pages", exact: true }).click();
    await page
      .getByLabel("Contact page title", { exact: true })
      .fill("Get in touch");
    await page
      .getByLabel("Contact page address", { exact: true })
      .fill("connect");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      path: ".test-data/page-planner-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel("Editing", { exact: true }).selectOption("sections");
    await expect(headings.first()).toBeVisible();
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    const drawer = page.getByRole("dialog", {
      name: "Workspace navigation",
      exact: true,
    });
    await expect(drawer).toBeVisible();
    await expect(
      drawer.getByRole("button", { name: "Close navigation", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Open navigation", exact: true }),
    ).toBeFocused();
    await page.screenshot({
      animations: "disabled",
      path: ".test-data/editor-refined-mobile.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const state = await (await page.request.get(`/api/sites/${id}`)).json();
    expect(
      (
        await page.request.post(`/api/sites/${id}/publish`, {
          headers,
          data: { revision: state.site.revision },
        })
      ).status(),
    ).toBe(202);
    await expect
      .poll(
        async () =>
          (await page.request.get(`/portfolio/${slug}/connect`)).status(),
        { timeout: 30000 },
      )
      .toBe(200);
    await publicPage.goto(`/portfolio/${slug}/connect`);
    await expect(publicPage).toHaveTitle(`Get in touch — ${doc.profile.name}`);
    await publicPage
      .getByLabel("Your name", { exact: true })
      .fill("Research Visitor");
    await publicPage
      .getByLabel("Email address", { exact: true })
      .fill("visitor@example.org");
    await publicPage
      .getByLabel("Message", { exact: true })
      .fill("I would like to discuss a research collaboration.");
    await publicPage
      .getByRole("button", { name: "Send inquiry", exact: true })
      .click();
    await expect(
      publicPage.getByRole("heading", {
        name: "Thank you for reaching out.",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await reader.close();
    await page.request.post(`/api/sites/${id}/unpublish`, { headers });
    await page.request.delete(`/api/sites/${id}`, { headers });
  }
});
