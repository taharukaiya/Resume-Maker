import { signInAdmin } from "./admin-session";
import { expect, test } from "@playwright/test";
import { emptyDocument, emptyEntry } from "../../src/modules/portfolios/schema";
import { signatureLooks } from "../../src/modules/portfolios/design";
import { textPdf } from "../pdf-fixture";
import sharp from "sharp";

test("signature portfolios, custom confirmations, and contextual tab titles", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(180000);
  await signInAdmin(page);
  const headers = { origin: "http://localhost:3100" };
  const created = await page.request.post("/api/sites", {
    headers,
    data: { name: "Dr. Maya Rahman", slug: `appearance-${Date.now()}` },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  const doc = emptyDocument("Dr. Maya Rahman");
  doc.navigation.layout = "single";
  doc.profile.headline =
    "Research at the intersection of climate, cities, and collective possibility.";
  doc.profile.affiliation = "Environmental Systems Research";
  doc.profile.bio =
    "I bring together field research and open data to understand how communities adapt to environmental change. My work connects scientific evidence with the decisions that shape everyday life.";
  doc.profile.location = "Dhaka, Bangladesh";
  doc.profile.email = "maya@example.org";
  const fullDescription =
    "We investigate how neighborhood-scale evidence can shape inclusive urban policy. Our approach combines participatory fieldwork, spatial analysis, and open research practices. ".repeat(
      3,
    ) + "The complete description remains accessible without JavaScript.";
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
      intro: "Ideas developed through evidence and collaboration.",
      visible: true,
      entries: [
        {
          ...emptyEntry(),
          title: "Resilient cities, shared futures",
          subtitle: "Urban climate adaptation",
          start: "2024",
          current: true,
          tags: "Climate, Open data",
          body: fullDescription,
        },
        {
          ...emptyEntry(),
          title: "Community-led environmental evidence",
          subtitle: "Participatory research",
          start: "2023",
          end: "2025",
          tags: "Fieldwork, Policy",
          body: "Connecting local knowledge with environmental evidence to support more equitable decisions.",
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      type: "education",
      title: "Academic journey",
      intro: "",
      visible: true,
      entries: [
        {
          ...emptyEntry(),
          title: "MSc in Environmental Science",
          subtitle: "Academic workflow test fixture",
          start: "2021",
          end: "2023",
        },
        {
          ...emptyEntry(),
          title: "BSc in Geography",
          subtitle: "Academic workflow test fixture",
          start: "2017",
          end: "2021",
        },
      ],
    },
  ];
  let revision = 1;
  const publicContext = await browser.newContext({
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
    viewport: { width: 1440, height: 1000 },
  });
  const publicPage = await publicContext.newPage();
  try {
    for (const look of signatureLooks) {
      doc.theme = { ...doc.theme, ...look.theme };
      const saved = await page.request.put(`/api/sites/${id}`, {
        headers,
        data: { document: doc, revision },
      });
      expect(saved.ok()).toBeTruthy();
      revision = (await saved.json()).revision;
      await publicPage.setViewportSize({ width: 1440, height: 1000 });
      const response = await publicPage.goto(`/api/sites/${id}/preview`);
      expect(response?.headers()["content-security-policy"]).toContain(
        "default-src 'none'",
      );
      await expect(publicPage).toHaveTitle(
        `${doc.profile.name} — ${doc.profile.headline}`,
      );
      await expect(publicPage.locator("body")).toHaveClass(look.theme.style);
      const index = publicPage.getByRole("navigation", {
        name: "Explore the portfolio",
      });
      if (look.theme.researchIndex) await expect(index).toBeVisible();
      else await expect(index).toHaveCount(0);
      const details = publicPage.locator(".entry-details").first();
      await details.locator("summary").click();
      await expect(details).toHaveAttribute("open", "");
      await expect(details.locator(".expanded-copy")).toContainText(
        "The complete description remains accessible without JavaScript.",
      );
      await details.locator("summary").press("Enter");
      await expect(details).not.toHaveAttribute("open");
      await publicPage.emulateMedia({ reducedMotion: "reduce" });
      expect(
        await publicPage
          .locator(".hero-copy")
          .evaluate((element) => getComputedStyle(element).animationName),
      ).toBe("none");
      await publicPage.evaluate(() => {
        (document.activeElement as HTMLElement | null)?.blur();
        window.scrollTo(0, 0);
      });
      await publicPage.screenshot({
        path: `.test-data/signature-${look.theme.style}-desktop.png`,
        fullPage: true,
        animations: "disabled",
      });
      await publicPage.setViewportSize({ width: 390, height: 844 });
      expect(
        await publicPage.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await publicPage.screenshot({
        path: `.test-data/signature-${look.theme.style}-mobile.png`,
        fullPage: true,
        animations: "disabled",
      });
      await publicPage.emulateMedia({ reducedMotion: "no-preference" });
    }
  } finally {
    await publicContext.close();
  }

  const nativeDialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    nativeDialogs.push(dialog.type());
    await dialog.dismiss();
  });
  await page.goto(`/studio/portfolios/${id}`);
  await expect(page).toHaveTitle(
    "Dr. Maya Rahman · Profile | Brilliancy Research",
  );
  await page.getByRole("tab", { name: "Design", exact: true }).click();
  await expect(page).toHaveTitle(
    "Dr. Maya Rahman · Design | Brilliancy Research",
  );
  await page.getByRole("button", { name: "Atlas · Cobalt" }).click();
  await expect(
    page.getByRole("button", { name: "Atlas · Cobalt" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Portfolios", exact: true })
    .click();
  const leave = page.getByRole("alertdialog", {
    name: "Leave unsaved changes?",
  });
  await expect(leave).toBeVisible();
  await expect(leave.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(leave).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/studio/portfolios/${id}$`));
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();

  // Real uploaded media: Cancel must keep it; Confirm must call deletion once.
  const upload = await page.request.post(`/api/sites/${id}/media`, {
    headers,
    multipart: {
      purpose: "cv",
      file: {
        name: "dialog-example.pdf",
        mimeType: "application/pdf",
        buffer: textPdf([
          "Sample document for deletion confirmation testing only.",
        ]),
      },
    },
  });
  expect(upload.status()).toBe(201);
  const file = await upload.json();
  await page.reload();
  await page.getByRole("tab", { name: "File library" }).click();
  const deleteButton = page.getByRole("button", {
    name: "Delete dialog-example.pdf",
  });
  await deleteButton.click();
  const dialog = page.getByRole("alertdialog", { name: "Delete this file?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("dialog-example.pdf");
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.screenshot({
    path: ".test-data/custom-confirmation.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(deleteButton).toBeFocused();
  expect((await page.request.get(`/api/media/${file.id}`)).ok()).toBeTruthy();
  await deleteButton.click();
  await dialog
    .getByRole("button", { name: "Delete file", exact: true })
    .click();
  await expect(deleteButton).toHaveCount(0);
  expect((await page.request.get(`/api/media/${file.id}`)).status()).toBe(404);
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  const portrait = await sharp({
    create: { width: 600, height: 800, channels: 3, background: "#2448b8" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Biography", { exact: true })
    .fill("This unsaved biography must survive the photo upload.");
  await page
    .getByRole("checkbox", {
      name: /Automatically remove the portrait background/,
    })
    .uncheck();
  await page.getByLabel("Upload profile photo", { exact: true }).setInputFiles({
    name: "profile-test.png",
    mimeType: "image/png",
    buffer: portrait,
  });
  await expect(
    page.getByText("Photo uploaded and selected. Save the draft when ready."),
  ).toBeVisible();
  await expect(page.getByLabel("Biography", { exact: true })).toHaveValue(
    "This unsaved biography must survive the photo upload.",
  );
  const portraitId = await page
    .getByLabel("Profile photo", { exact: true })
    .inputValue();
  expect(portraitId).toMatch(/^[a-f0-9-]{36}$/);
  await expect(page.getByAltText("Selected profile photo")).toBeVisible();
  const imageResponse = await page.request.get(`/api/media/${portraitId}`);
  expect(imageResponse.headers()["content-type"]).toBe("image/webp");
  await page
    .getByLabel("Full name *", { exact: true })
    .fill("Dr. Maya Rahman Khan");
  await expect(page).toHaveTitle(
    "Dr. Maya Rahman Khan · Profile | Brilliancy Research",
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
  const savedProfile = (
    await (await page.request.get(`/api/sites/${id}`)).json()
  ).site.draft.profile;
  expect(savedProfile.portraitId).toBe(portraitId);
  expect(savedProfile.bio).toBe(
    "This unsaved biography must survive the photo upload.",
  );
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Inbox", exact: true })
    .click();
  await expect(page).toHaveTitle("Inbox | Brilliancy Research");
  expect(nativeDialogs).toEqual([]);
});
