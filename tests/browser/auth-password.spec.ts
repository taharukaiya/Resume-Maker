import { expect, test } from "@playwright/test";

for (const [mode, url, autoComplete] of [
  ["login", "/login", "current-password"],
  ["setup", "/setup?token=browser-test-bootstrap-only", "new-password"],
  ["account activation", "/accept?token=visibility-test-only", "new-password"],
]) {
  test(`${mode} password can be shown and hidden using the keyboard`, async ({
    page,
  }) => {
    let submissions = 0;
    page.on("request", (request) => {
      if (request.method() === "POST") submissions += 1;
    });
    await page.goto(url);
    const password = page.getByLabel("Password", { exact: true });
    const value = "Private example passphrase 2026!";
    await password.fill(value);
    await expect(password).toHaveAttribute("type", "password");
    await expect(password).toHaveAttribute("autocomplete", autoComplete);
    await password.press("Tab");
    const show = page.getByRole("button", {
      name: "Show password",
      exact: true,
    });
    await expect(show).toBeFocused();
    await expect(show).toHaveAttribute(
      "aria-controls",
      (await password.getAttribute("id"))!,
    );
    await show.press("Enter");
    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue(value);
    const hide = page.getByRole("button", {
      name: "Hide password",
      exact: true,
    });
    await expect(hide).toBeFocused();
    await hide.press("Space");
    await expect(password).toHaveAttribute("type", "password");
    await expect(password).toHaveValue(value);
    expect(submissions).toBe(0);
  });
}
