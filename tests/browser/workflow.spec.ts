import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { emptyDocument, emptyEntry } from "../../src/modules/portfolios/schema";
import { textPdf } from "../pdf-fixture";
const email = "browser-admin@integration.test",
  password = "Browser testing passphrase 2026!";
test("free browser AI explains unsupported hardware without changing the draft", async ({
  page,
  request,
}) => {
  const status = await (await request.get("/api/status")).json();
  if (!status.initialized) {
    const setup = await request.post("/api/setup", {
      headers: { origin: "http://localhost:3100" },
      data: {
        token: "browser-test-bootstrap-only",
        name: "Browser Administrator",
        email,
        password,
        agencyName: "Brilliancy Research",
      },
    });
    expect(setup.status()).toBe(200);
  }
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "gpu", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.route("**/api/integrations", (route) =>
    route.fulfill({ json: { ai: true, aiProvider: "huggingface-browser" } }),
  );
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(
    page.getByRole("button", { name: "Create a portfolio", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create a portfolio", exact: true })
    .click();
  await page.getByLabel("Researcher’s name").fill("Free AI browser fixture");
  await page
    .getByLabel("Portfolio address", { exact: true })
    .fill(`free-ai-${Date.now()}`);
  await page
    .getByRole("button", { name: "Create portfolio", exact: true })
    .click();
  await page.getByLabel("Upload a CV", { exact: true }).setInputFiles({
    name: "sample-cv.pdf",
    mimeType: "application/pdf",
    buffer: textPdf([
      "Sample academic CV for testing only. Education: Master of Science, 2022.",
      "Research interests include environmental modelling and scientific communication.",
    ]),
  });
  await expect(
    page.getByRole("button", { name: "Extract details", exact: true }),
  ).toBeEnabled();
  await page.route("**/api/media/*/browser-ai", (route) =>
    route.fulfill({
      json: {
        text: "Sample CV text for a browser capability test. ".repeat(5),
      },
    }),
  );
  await page
    .getByRole("button", { name: "Extract details", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Free AI requires WebGPU" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Extract details", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Review extracted details" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: ".test-data/free-browser-ai.png",
    fullPage: true,
  });
});
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
  await page.screenshot({
    path: ".test-data/login-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
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
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await page
    .getByLabel("Profession or headline")
    .fill("Investigating equitable and reliable scientific systems.");
  await page
    .getByLabel("Biography", { exact: true })
    .fill(
      "My research explores how evidence can improve decisions across scientific communities.",
    );
  await page.getByRole("tab", { name: "Academic sections" }).click();
  await page
    .getByLabel("Add section", { exact: true })
    .selectOption("education");
  await page.getByRole("button", { name: "Add entry", exact: true }).click();
  await page
    .getByLabel("Degree or qualification *", { exact: true })
    .fill("MSc");
  await page
    .getByLabel("Institution *", { exact: true })
    .fill("Test University");
  await page.getByLabel("Start date *", { exact: true }).fill("2020");
  await page.getByLabel("End date *", { exact: true }).fill("2022");
  await page.getByLabel("Add section", { exact: true }).selectOption("about");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Draft portfolio preview"]');
  await expect(
    preview.getByRole("heading", {
      name: "Investigating equitable and reliable scientific systems.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    preview.getByText("My research explores how evidence"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close preview" }).click();
  await page.getByRole("tab", { name: "Permissions", exact: true }).click();
  await page.getByRole("checkbox", { name: "Biography", exact: true }).check();
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
  await expect(
    page.getByRole("heading", {
      name: "Investigating equitable and reliable scientific systems.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new URL(publicUrl!, "http://localhost:3100").href,
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
  await page.screenshot({
    path: ".test-data/navigation-mobile.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Close navigation" }).click();
  await page.screenshot({
    path: ".test-data/dashboard-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("client invitation, permitted submission, files, private pages, and public inquiry", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  const stamp = Date.now();
  const clientEmail = `client-${stamp}@integration.test`;
  await page.goto("/studio/clients");
  await page.getByRole("button", { name: "Invite a person" }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Browser Client");
  await page.getByLabel("Email address", { exact: true }).fill(clientEmail);
  await page.getByRole("button", { name: "Create invitation" }).click();
  const invitation = page.getByRole("dialog").locator(".code-box");
  await expect(invitation).toContainText("/accept?token=");
  const inviteUrl = (await invitation.textContent())!;
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const accounts = await (await page.request.get("/api/users")).json();
  const client = accounts.users.find(
    (u: { email: string }) => u.email === clientEmail,
  );
  const headers = { origin: "http://localhost:3100" };
  const created = await page.request.post("/api/sites", {
    headers,
    data: {
      name: "Client Workflow",
      slug: `client-${stamp}`,
      clientId: client.id,
    },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  expect(
    (
      await page.request.put(`/api/sites/${id}/permissions`, {
        headers,
        data: { clientId: client.id, editableFields: ["profile.bio"] },
      })
    ).ok(),
  ).toBe(true);

  const clientContext = await browser.newContext();
  try {
    const clientPage = await clientContext.newPage();
    await clientPage.goto(inviteUrl);
    await clientPage.getByLabel("Password", { exact: true }).fill(password);
    await clientPage
      .getByRole("button", { name: "Set password", exact: true })
      .click();
    await expect(clientPage.getByText("Your account is ready.")).toBeVisible();
    await clientPage.goto("/login");
    await clientPage
      .getByLabel("Email address", { exact: true })
      .fill(clientEmail);
    await clientPage.getByLabel("Password", { exact: true }).fill(password);
    await clientPage
      .getByRole("button", { name: "Sign in to workspace" })
      .click();
    await expect(clientPage).toHaveURL(/\/studio$/);
    await clientPage.goto(`/studio/portfolios/${id}`);
    await expect(
      clientPage.getByLabel("Profession or headline"),
    ).toBeDisabled();
    await expect(
      clientPage.getByRole("tab", { name: "Permissions", exact: true }),
    ).toHaveCount(0);
    await clientPage
      .getByLabel("Biography", { exact: true })
      .fill("A biography submitted by the invited researcher.");
    await clientPage.getByRole("button", { name: "Submit changes" }).click();
    await expect(
      clientPage.getByText("Changes submitted for administrator review.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(
      (await clientPage.request.get(`/portfolio/client-${stamp}`)).status(),
    ).toBe(404);
  } finally {
    await clientContext.close();
  }

  await page.goto(`/studio/portfolios/${id}`);
  await expect(page.getByLabel("Biography", { exact: true })).toHaveValue(
    "A biography submitted by the invited researcher.",
  );
  const image = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "#234d3e" },
  })
    .png()
    .toBuffer();
  await page.getByLabel("Upload website logo").setInputFiles({
    name: "research-image.png",
    mimeType: "image/png",
    buffer: image,
  });
  await expect(
    page.getByLabel("Website logo", { exact: true }),
  ).not.toHaveValue("");
  const data = await (await page.request.get(`/api/sites/${id}`)).json();
  const section = {
    id: crypto.randomUUID(),
    type: "about",
    title: "About",
    intro: "",
    visible: true,
    entries: [],
  };
  data.site.draft.sections = [
    {
      ...section,
      id: crypto.randomUUID(),
      type: "education",
      title: "Education",
      entries: [
        {
          id: crypto.randomUUID(),
          title: "MSc",
          subtitle: "Test University",
          start: "2020",
          end: "2022",
          current: false,
          body: "",
          url: "",
          mediaId: "",
          tags: "",
          authors: "",
          doi: "",
          status: "",
          abstractSource: "",
        },
      ],
    },
    section,
    { ...section, id: crypto.randomUUID(), type: "contact", title: "Contact" },
  ];
  data.site.draft.navigation.layout = "single";
  data.site.draft.profile.portraitId = data.media[0].id;
  data.site.draft.pages = [
    {
      id: crypto.randomUUID(),
      slug: "research",
      title: "Research",
      description: "Research details in a private draft.",
      sections: [],
    },
  ];
  expect(
    (
      await page.request.put(`/api/sites/${id}`, {
        headers,
        data: { document: data.site.draft, revision: data.site.revision },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Draft portfolio preview"]');
  await preview.getByRole("link", { name: "Research", exact: true }).click();
  await expect(
    preview.getByRole("heading", { name: "Research", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close preview" }).click();
  await page.getByRole("tab", { name: "Review & publish" }).click();
  await page.getByRole("button", { name: "Publish approved draft" }).click();
  await expect(
    page.getByRole("link", { name: "View published portfolio" }),
  ).toBeVisible({ timeout: 30000 });
  await page.goto(`/portfolio/client-${stamp}`);
  await expect(
    page.getByText("A biography submitted by the invited researcher."),
  ).toBeVisible();
  await expect(page.locator("img.hero-portrait")).toBeVisible();
  expect(
    await page
      .locator("img.hero-portrait")
      .evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
  ).toBe(true);
  await page.getByLabel("Your name *", { exact: true }).fill("Browser Visitor");
  await page
    .getByLabel("Email address *", { exact: true })
    .fill("visitor@integration.test");
  const message = `Collaboration inquiry ${stamp} from the public portfolio.`;
  await page.getByLabel("Message *", { exact: true }).fill(message);
  await page.getByRole("button", { name: "Send inquiry" }).click();
  await expect(
    page.getByRole("heading", { name: "Thank you for reaching out." }),
  ).toBeVisible();
  await page.goto("/studio/inbox");
  await expect(page.getByText(message, { exact: true })).toBeVisible();
});

test("fixed design, mobile layouts and selective CV review", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Good to see you, Browser." }),
  ).toBeVisible();
  const stamp = Date.now();
  const created = await page.request.post("/api/sites", {
    headers: { origin: "http://localhost:3100" },
    data: { name: "Dr. Amara Rahman", slug: `design-${stamp}` },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  const doc = emptyDocument("Dr. Amara Rahman");
  doc.navigation.layout = "single";
  doc.profile.headline =
    "Exploring the connections between climate, cities, and human possibility.";
  doc.profile.affiliation = "Environmental Systems Research";
  doc.profile.bio =
    "I study how communities adapt to a changing climate. My work brings together urban field research, open data, and participatory design to create more equitable and resilient places.";
  doc.profile.location = "Dhaka, Bangladesh";
  doc.profile.email = "amara@example.org";
  const entry = {
    ...emptyEntry(),
    title: "Resilient cities, shared futures",
    subtitle: "Urban climate adaptation research",
    body: "Investigating how neighborhood-scale evidence can shape inclusive urban policy and support communities facing environmental change.",
    start: "2024",
    current: true,
    tags: "Climate adaptation, Open data, Urban systems",
  };
  doc.sections = [
    {
      id: crypto.randomUUID(),
      type: "about",
      title: "A question worth pursuing",
      intro: "",
      visible: true,
      entries: [],
    },
    {
      id: crypto.randomUUID(),
      type: "projects",
      title: "Selected research",
      intro: "",
      visible: true,
      entries: [
        entry,
        {
          ...entry,
          id: crypto.randomUUID(),
          title: "Community-led environmental evidence",
          current: false,
          end: "2025",
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      type: "contact",
      title: "Let's exchange ideas",
      intro: "Open to thoughtful research collaborations.",
      visible: true,
      entries: [],
    },
  ];
  doc.theme = {
    ...doc.theme,
    font: "fraunces",
    bodyFont: "dm-sans",
    scale: "expressive",
    portrait: "arch",
    decoration: "glow",
  };
  const saved = await page.request.put(`/api/sites/${id}`, {
    headers: { origin: "http://localhost:3100" },
    data: { document: doc, revision: 1 },
  });
  expect(saved.status()).toBe(200);
  {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/api/sites/${id}/preview`);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("body")).toHaveClass("shiba");
    await expect(
      page.getByRole("heading", { name: doc.profile.headline, exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: ".test-data/design-current-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".test-data/design-current-mobile.png",
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/studio/portfolios/${id}`);
  await expect(
    page.getByRole("tab", { name: "Design", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: ".test-data/design-editor.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
  // The provider response is a browser fixture; the real queue/storage path is
  // covered separately by integration tests without sending private documents.
  const result = {
    profile: {
      name: "Imported researcher",
      headline: "",
      affiliation: "",
      bio: "",
      location: "",
      email: "",
      links: [],
    },
    sections: [
      {
        type: "education",
        title: "Education",
        entries: [
          {
            title: "MSc in Environmental Science",
            subtitle: "Example University",
            body: "Studied environmental systems.",
            url: "",
            tags: "",
            authors: "",
            doi: "",
            status: "",
            start: "2020",
            end: "2022",
            current: false,
          },
        ],
      },
    ],
    warnings: ["Review extracted dates."],
  };
  await page.route(`**/api/sites/${id}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const body = await response.json();
    body.media.push({
      id: crypto.randomUUID(),
      filename: "review-fixture.pdf",
      mime: "application/pdf",
      cv_import: result,
    });
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  // A page being edited must not prevent applying independently reviewed CV facts.
  await page.getByRole("tab", { name: "Pages", exact: true }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page
    .getByLabel("Description", { exact: true })
    .fill("Unfinished research page");
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page
    .getByLabel("CV or resume PDF")
    .selectOption({ label: "review-fixture.pdf" });
  await page.getByRole("button", { name: "Review extracted details" }).click();
  await expect(page.getByText("Review extracted dates.")).toBeVisible();
  await page.screenshot({ path: ".test-data/cv-review.png", fullPage: true });
  await page.getByRole("button", { name: "Apply selected details" }).click();
  await expect(
    page.getByText(
      "Selected details applied to your unsaved draft. Review, then save.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Full name *", { exact: true })).toHaveValue(
    "Dr. Amara Rahman",
  );
  await page.getByRole("tab", { name: "Academic sections" }).click();
  await page.locator("summary").filter({ hasText: "Education" }).click();
  await expect(
    page.locator('input[value="MSc in Environmental Science"]'),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Pages", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByText(
      "Page 1: enter a page title in the Pages tab, or remove this unfinished page.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "Unfinished research page",
  );
  await page.getByLabel("Page title", { exact: true }).fill("Research");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByText(
      "Page 1 (Research): enter a page address using lowercase letters, numbers, and hyphens, such as research.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByLabel("Page address", { exact: true }).fill("research");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
  const importedDraft = await (
    await page.request.get(`/api/sites/${id}`)
  ).json();
  expect(importedDraft.site.draft.pages[0].description).toBe(
    "Unfinished research page",
  );
  expect(
    importedDraft.site.draft.sections.some(
      (section: { type: string }) => section.type === "education",
    ),
  ).toBe(true);
  await page.getByRole("tab", { name: "Review & publish" }).click();
  await page
    .getByRole("button", { name: "Delete portfolio", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Permanently delete portfolio" }),
  ).toBeDisabled();
  await page
    .getByLabel(`Type design-${stamp} to confirm deletion`)
    .fill(`design-${stamp}`);
  await page
    .getByRole("button", { name: "Permanently delete portfolio" })
    .click();
  await expect(page).toHaveURL(/\/studio\/portfolios$/);
  expect((await page.request.get(`/api/sites/${id}`)).status()).toBe(404);
});
