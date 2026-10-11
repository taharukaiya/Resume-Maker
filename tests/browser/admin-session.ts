import { expect, type BrowserContext, type Page } from "@playwright/test";

let cookies: Awaited<ReturnType<BrowserContext["cookies"]>> = [];

// Reuse a real authenticated session between independent browser contexts.
// Login-screen tests still exercise authentication; production rate limits stay intact.
export async function signInAdmin(page: Page) {
  if (cookies.length) {
    await page.context().addCookies(cookies);
    const response = await page.request.get("/api/auth/me");
    if (response.ok() && (await response.json()).user?.role === "admin") return;
  }
  const headers = { origin: "http://localhost:3100" };
  const credentials = {
    email: "browser-admin@integration.test",
    password: "Browser testing passphrase 2026!",
  };
  if (!(await (await page.request.get("/api/status")).json()).initialized) {
    expect(
      (
        await page.request.post("/api/setup", {
          headers,
          data: {
            ...credentials,
            token: "browser-test-bootstrap-only",
            name: "Browser Administrator",
            agencyName: "Brilliancy Research",
          },
        })
      ).ok(),
    ).toBeTruthy();
  }
  expect(
    (
      await page.request.post("/api/auth/login", { headers, data: credentials })
    ).ok(),
  ).toBeTruthy();
  cookies = await page.context().cookies();
}
