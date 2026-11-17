import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import { Pool } from "pg";
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

function localDatabaseUrl(): string {
  let value = process.env.DB_URL;
  if (!value) {
    const output = execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    value = output
      .split(/\r?\n/)
      .find((line) => line.startsWith("DB_URL="))
      ?.slice("DB_URL=".length);
  }
  if (!value) throw new Error("Local Supabase DB_URL is unavailable");
  value = value.replace(/^["']|["']$/g, "");
  if (!["127.0.0.1", "localhost"].includes(new URL(value).hostname)) {
    throw new Error("Auth E2E fixtures may only modify local Supabase");
  }
  return value;
}

test("sign-in verification includes the Junk folder hint", async ({ page }) => {
  await sendSignInCode(page, uniqueGatechEmail());
  await expect(
    page.getByText("Can't find the code? Check your Junk folder."),
  ).toBeVisible();
});

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
  await page.getByLabel("Georgia Tech email").fill("someone@gmail.com");
  await expect(page.locator('p[role="alert"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText(
    "Use your @gatech.edu email.",
  );

  const response = await fetch(`${mailpitUrl}/api/v1/messages?limit=100`);
  expect(response.ok).toBe(true);
  const payload = (await response.json()) as { messages: unknown[] };
  expect(payload.messages).toHaveLength(0);
});

test("R-AUTH-2 malformed email is rejected before contacting Supabase", async ({
  page,
}) => {
  let otpRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/auth/v1/otp")) otpRequests += 1;
  });
  await clearMailbox();
  await page.goto("/signin");
  await page.getByLabel("Georgia Tech email").fill("not-an-email");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText(
    "Enter a valid email.",
  );
  expect(otpRequests).toBe(0);

  const response = await fetch(`${mailpitUrl}/api/v1/messages?limit=100`);
  expect(response.ok).toBe(true);
  const payload = (await response.json()) as { messages: unknown[] };
  expect(payload.messages).toHaveLength(0);
});

test("R-AUTH-2 a database exception signs in through Mailpit to onboarding", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const email = "guest.rider@example.com";
  const pool = new Pool({ connectionString: localDatabaseUrl() });
  try {
    await pool.query("delete from auth.users where lower(btrim(email)) = $1", [
      email,
    ]);
    await pool.query("delete from app.email_exceptions where email = $1", [
      email,
    ]);
    await pool.query(
      "insert into app.email_exceptions (email, note) values ($1, $2)",
      [email, "Auth E2E exception fixture"],
    );

    await signInAs(page, email);
    await expect(page).toHaveURL(/\/welcome/);
    await expect(page.getByLabel("First name")).toBeVisible();
  } finally {
    try {
      await pool.query(
        "delete from auth.users where lower(btrim(email)) = $1",
        [email],
      );
      await pool.query("delete from app.email_exceptions where email = $1", [
        email,
      ]);
    } finally {
      await pool.end();
    }
  }
});

test("R-AUTH-1/4/5 returns through onboarding and stores an E.164 phone", async ({
  page,
}) => {
  const email = uniqueGatechEmail();
  await page.goto("/rides/new");
  await expect(page).toHaveURL(/\/signin\?next=%2Frides%2Fnew$/);

  await signInAs(page, email, "/rides/new");
  await expect(page).toHaveURL(/\/welcome\?next=%2Frides%2Fnew$/);
  await expect(
    page.getByLabel("Show my phone number to my ride group"),
  ).toBeChecked();
  await completeProfile(page);
  await expect(page).toHaveURL(/\/rides\/new$/);
  await expect(page.getByRole("link", { name: "Your profile" })).toBeVisible();

  await page.goto("/profile");
  await expect(page.getByLabel("Phone", { exact: true })).toHaveValue(
    "(404) 555-0123",
  );
});

test("R-AUTH-1 rejects an incorrect OTP and shows the resend countdown", async ({
  page,
}) => {
  await sendSignInCode(page, uniqueGatechEmail());
  await page.getByLabel("Code").fill("000000");
  await expect(page.locator('p[role="alert"]')).toHaveText(
    "That code is wrong or expired.",
  );
  const resendButton = page.getByRole("button", {
    name: /^Resend in \d+s$/,
  });
  await expect(resendButton).toBeDisabled();
  await expect(resendButton).toBeVisible();
});

test("R-AUTH-1 auto-submits a pasted OTP and accepts trimmed 40-character names", async ({
  page,
}) => {
  const email = uniqueGatechEmail();
  const code = await sendSignInCode(page, email);
  await page.getByLabel("Code").fill(`${code.slice(0, 3)} ${code.slice(3)}`);
  await page.waitForURL(/\/welcome/);
  await page.getByLabel("First name").fill(` ${"A".repeat(40)} `);
  await page.getByLabel("Last name").fill(" Parker ");
  await page.getByLabel("Phone", { exact: true }).fill("(404) 555-0123");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("/");
  await page.goto("/profile");
  await expect(page.getByLabel("First name")).toHaveValue("A".repeat(40));
  await expect(page.getByLabel("Last name")).toHaveValue("Parker");
});

test("onboarding omits gender and profile gender tiles save", async ({
  page,
}) => {
  await signInAs(page, uniqueGatechEmail());
  await page.goto("/welcome");
  await expect(page.getByText("Gender", { exact: true })).toHaveCount(0);
  await completeProfile(page, { firstName: "Taylor", gender: "woman" });
  await page.goto("/profile");
  const manRadio = page.getByRole("radio", { name: "Man", exact: true });
  const manLabel = manRadio.locator("xpath=..");
  const unselectedBorder = await manLabel.evaluate(
    (element) => getComputedStyle(element).borderColor,
  );
  await manLabel.click();
  await expect(manRadio).toBeChecked();
  const selectedBorder = await manLabel.evaluate(
    (element) => getComputedStyle(element).borderColor,
  );
  expect(selectedBorder).not.toBe(unselectedBorder);
  await expect(
    page.getByText(
      "Only used to match you with women-only or men-only rides. Never shown on your profile or to other riders.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(manRadio).toBeChecked();
});

test("demo accounts do not receive sign-in email", async ({ page }) => {
  await clearMailbox();
  await page.goto("/signin");
  await page
    .getByLabel("Georgia Tech email")
    .fill("demo1@carpool-demo.gatech.edu");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText(
    "Demo accounts cannot receive sign-in codes.",
  );

  const response = await fetch(`${mailpitUrl}/api/v1/messages?limit=100`);
  expect(response.ok).toBe(true);
  const payload = (await response.json()) as { messages: unknown[] };
  expect(payload.messages).toHaveLength(0);
});

test("R-AUTH-4 sends a returning user directly to the requested page", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const email = uniqueGatechEmail();
  await signInAs(page, email);
  await completeProfile(page);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");

  await page.waitForTimeout(31_000);
  await signInAs(page, email, "/me");
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByRole("heading", { name: "My rides" })).toBeVisible();
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
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Sign in" }),
  ).toBeVisible();

  await page.goto("/profile");
  await expect(page).toHaveURL(/\/signin\?next=%2Fprofile$/);
});

test("R-PROF-1 profile tabs, incomplete-profile redirect, and saved phone settings", async ({
  page,
}) => {
  const email = uniqueGatechEmail();
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/signin\?next=%2Fprofile$/);
  await signInAs(page, email, "/profile");
  await expect(page).toHaveURL(/\/welcome\?next=%2Fprofile$/);
  await completeProfile(page);
  await expect(page).toHaveURL(/\/profile$/);

  const accountNavigation = page.getByRole("navigation", { name: "Account" });
  await expect(
    accountNavigation.getByRole("link", { name: "Profile" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByLabel("Show my phone number to my ride group"),
  ).toBeChecked();
  await accountNavigation.getByRole("link", { name: "My rides" }).click();
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByRole("heading", { name: "My rides" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Account" }).getByRole("link", {
      name: "My rides",
    }),
  ).toHaveAttribute("aria-current", "page");
  await page
    .getByRole("navigation", { name: "Account" })
    .getByRole("link", { name: "Profile" })
    .click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.getByLabel("First name").fill("José");
  await page.getByLabel("Last name").fill("O'Brien-Mary-Kate");
  await page.getByLabel("Phone", { exact: true }).fill("12345");
  await page.getByLabel("Show my phone number to my ride group").uncheck();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Enter a US phone number")).toBeVisible();
  await expect(page.getByLabel("First name")).toHaveValue("José");
  await expect(page.getByLabel("Last name")).toHaveValue("O'Brien-Mary-Kate");
  await expect(page.getByLabel("Phone", { exact: true })).toHaveValue("12345");
  await expect(
    page.getByLabel("Show my phone number to my ride group"),
  ).not.toBeChecked();

  await page.getByLabel("Phone", { exact: true }).fill("(404) 555-0123");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await expect(page.getByLabel("First name")).toHaveValue("José");
  await expect(page.getByLabel("Last name")).toHaveValue("O'Brien-Mary-Kate");
});

test("R-PROF-1 keeps the user on welcome when the phone is invalid", async ({
  page,
}) => {
  await signInAs(page, uniqueGatechEmail());
  await expect(
    page.getByRole("link", {
      name: "How your contact details are shared.",
    }),
  ).toHaveAttribute("href", "/privacy");
  await page.getByLabel("First name").fill("Alex");
  await page.getByLabel("Last name").fill("Parker");
  await page.getByLabel("Phone", { exact: true }).fill("12345");
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
