import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { clearMailbox } from "./helpers/mailpit";
import {
  completeProfile,
  sendSignInCode,
  signInAs,
  uniqueGatechEmail,
  verifySignInCode,
} from "./helpers/auth";

const mailpitUrl = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
}

test("R-AUTH-2 rejects a non-GT address without Mailpit mail", async ({
  page,
}) => {
  await clearMailbox();
  await page.goto("/signin");
  await page.getByLabel("Email").fill("someone@gmail.com");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText(
    "Use your @gatech.edu email.",
  );

  const response = await fetch(`${mailpitUrl}/api/v1/messages?limit=100`);
  expect(response.ok).toBe(true);
  const payload = (await response.json()) as { messages: unknown[] };
  expect(payload.messages).toHaveLength(0);
});

test("R-AUTH-1/4/5 returns through onboarding and stores an E.164 phone", async ({
  page,
}) => {
  const email = uniqueGatechEmail();
  await page.goto("/rides/new");
  await expect(page).toHaveURL(/\/signin\?next=%2Frides%2Fnew$/);

  await signInAs(page, email, "/rides/new");
  await expect(page).toHaveURL(/\/welcome\?next=%2Frides%2Fnew$/);
  await completeProfile(page);
  await expect(page).toHaveURL(/\/rides\/new$/);
  await expect(page.getByRole("link", { name: "Your profile" })).toBeVisible();

  await page.goto("/me");
  await expect(page.getByText("(404) 555-0123", { exact: true })).toBeVisible();
});

test("R-AUTH-1 rejects an incorrect OTP and shows the resend countdown", async ({
  page,
}) => {
  await sendSignInCode(page, uniqueGatechEmail());
  await page.getByLabel("Code").fill("000000");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText(
    "That code is wrong or expired.",
  );
  const resendButton = page.getByRole("button", {
    name: /^Resend in \d+s$/,
  });
  await expect(resendButton).toBeDisabled();
  await expect(resendButton).toBeVisible();
});

test("R-AUTH-4 sends a returning user directly to the requested page", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const email = uniqueGatechEmail();
  await signInAs(page, email);
  await completeProfile(page);
  await page.goto("/me");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");

  await page.waitForTimeout(31_000);
  await signInAs(page, email, "/me");
  await expect(page).toHaveURL(/\/me$/);
  await expect(
    page.getByRole("heading", { name: "Your profile" }),
  ).toBeVisible();
});

test("R-AUTH-5 rejects an open redirect after onboarding", async ({ page }) => {
  const email = uniqueGatechEmail();
  await signInAs(page, email, "//evil.com");
  await expect(page).toHaveURL(/\/welcome\?next=%2F$/);
  await completeProfile(page);

  const finalUrl = new URL(page.url());
  expect(finalUrl.origin).toBe("http://127.0.0.1:3000");
  expect(finalUrl.pathname).toBe("/");
});

test("R-AUTH-6 signs out and protects the profile page", async ({ page }) => {
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page);
  await page.goto("/me");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  await page.goto("/me");
  await expect(page).toHaveURL(/\/signin\?next=%2Fme$/);
});

test("R-PROF-1 keeps the user on welcome when the phone is invalid", async ({
  page,
}) => {
  await signInAs(page, uniqueGatechEmail());
  await page.getByLabel("First name").fill("Alex");
  await page.getByLabel("Last name").fill("Parker");
  await page.getByLabel("Phone").fill("12345");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.locator('p[role="alert"]')).toHaveText(
    "Enter a US phone number",
  );
  await expect(page).toHaveURL(/\/welcome/);
});

test("R-AUTH-1/4 has no serious or critical accessibility issues", async ({
  page,
}) => {
  await page.goto("/signin");
  await expectAccessible(page);

  const code = await sendSignInCode(page, uniqueGatechEmail());
  await expectAccessible(page);

  await verifySignInCode(page, code);
  await expect(page).toHaveURL(/\/welcome/);
  await expectAccessible(page);
});
