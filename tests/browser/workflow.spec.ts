import { test, expect } from "@playwright/test";
import sharp from "sharp";
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
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
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
    await expect(clientPage.getByLabel("Academic headline")).toBeDisabled();
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
    expect((await clientPage.request.get(`/p/client-${stamp}`)).status()).toBe(
      404,
    );
  } finally {
    await clientContext.close();
  }

  await page.goto(`/studio/portfolios/${id}`);
  await expect(page.getByLabel("Biography", { exact: true })).toHaveValue(
    "A biography submitted by the invited researcher.",
  );
  await page.getByRole("tab", { name: "Files & articles" }).click();
  const image = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "#234d3e" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Upload a file")
    .setInputFiles({
      name: "research-image.png",
      mimeType: "image/png",
      buffer: image,
    });
  await expect(
    page.getByRole("link", { name: /Download research-image/ }),
  ).toBeVisible();
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
    section,
    { ...section, id: crypto.randomUUID(), type: "contact", title: "Contact" },
  ];
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
  await page.goto(`/p/client-${stamp}`);
  await expect(
    page.getByText("A biography submitted by the invited researcher."),
  ).toBeVisible();
  await expect(page.locator("img.portrait")).toBeVisible();
  expect(
    await page
      .locator("img.portrait")
      .evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
  ).toBe(true);
  await page.getByLabel("Your name", { exact: true }).fill("Browser Visitor");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("visitor@integration.test");
  const message = `Collaboration inquiry ${stamp} from the public portfolio.`;
  await page.getByLabel("Message", { exact: true }).fill(message);
  await page.getByRole("button", { name: "Send inquiry" }).click();
  await expect(
    page.getByRole("heading", { name: "Thank you for reaching out." }),
  ).toBeVisible();
  await page.goto("/studio/inbox");
  await expect(page.getByText(message, { exact: true })).toBeVisible();
});
