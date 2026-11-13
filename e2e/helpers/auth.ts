import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { clearMailbox, getLatestOtp } from "./mailpit";

export function uniqueGatechEmail(): string {
  return `m2-${randomUUID()}@gatech.edu`;
}

export async function sendSignInCode(
  page: Page,
  email: string,
  next = "/",
): Promise<string> {
  await clearMailbox();
  await page.goto(`/signin?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Georgia Tech email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("status")).toContainText(email);
  return getLatestOtp(email);
}

export async function verifySignInCode(page: Page, code: string) {
  await page.getByLabel("Code").fill(code);
  await page.waitForURL((url) => url.pathname !== "/signin");
}

export async function signInAs(
  page: Page,
  email: string,
  next = "/",
): Promise<void> {
  const code = await sendSignInCode(page, email, next);
  await verifySignInCode(page, code);
}

type ProfileOptions = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  venmo?: string;
  gender?: "man" | "woman" | "unspecified";
};

export async function completeProfile(
  page: Page,
  options: ProfileOptions = {},
): Promise<void> {
  await page.getByLabel("First name").fill(options.firstName ?? "Alex");
  await page.getByLabel("Last name").fill(options.lastName ?? "Parker");
  await page
    .getByLabel("Phone", { exact: true })
    .fill(options.phone ?? "(404) 555-0123");
  if (options.venmo) {
    await page.getByLabel("Venmo").fill(options.venmo);
  }
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL((url) => url.pathname !== "/welcome");
  const destination = new URL(page.url());
  if (options.gender) {
    await page.goto("/profile");
    const genderLabel =
      options.gender === "woman"
        ? "Woman"
        : options.gender === "unspecified"
          ? "Prefer not to say"
          : "Man";
    await page.getByText(genderLabel, { exact: true }).click();
    await expect(
      page.getByRole("radio", { name: genderLabel, exact: true }),
    ).toBeChecked();
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.goto(`${destination.pathname}${destination.search}`);
  }
}
