import { readFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { next14Days } from "../lib/time";
import { completeProfile, signInAs, uniqueGatechEmail } from "./helpers/auth";
import { getLatestEmailBody } from "./helpers/mailpit";

const screenshotDirectory = process.env.M7_SCREENSHOT_DIR;

async function setupMember(
  page: Page,
  email: string,
  firstName: string,
  phone: string,
) {
  await signInAs(page, email);
  await completeProfile(page, {
    firstName,
    lastName: "Parker",
    phone,
    gender: "man",
  });
}

async function createRide(page: Page) {
  await page.goto("/rides/new");
  await page.getByLabel("Date").fill(next14Days(new Date())[1]);
  await page.getByLabel("Time").fill("09:30");
  await page.getByLabel("Notes").fill("");
  await page.getByRole("button", { name: "Post ride" }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+$/);
}

test("calendar, share fallback and group text are available to ride members", async ({
  page,
  browser,
}, testInfo) => {
  if (testInfo.project.name === "desktop") {
    await page.setViewportSize({ width: 1280, height: 800 });
  }
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          window.localStorage.setItem("copied-text", text);
        },
      },
    });
  });
  await setupMember(page, uniqueGatechEmail(), "Alex", "(404) 555-0101");
  await createRide(page);
  const rideUrl = page.url();
  const rideId = rideUrl.split("/").at(-1)!;

  for (const [firstName, phone] of [
    ["Casey", "(404) 555-0102"],
    ["Jordan", "(404) 555-0103"],
  ]) {
    const context = await browser.newContext();
    const memberPage = await context.newPage();
    await setupMember(memberPage, uniqueGatechEmail(), firstName, phone);
    await memberPage.goto(rideUrl);
    await memberPage.getByRole("button", { name: "Join ride" }).click();
    await memberPage
      .getByRole("dialog")
      .getByRole("button", { name: "Join" })
      .click();
    await context.close();
  }

  await page.goto(rideUrl);
  await expect(
    page.getByRole("link", { name: "Add to calendar" }),
  ).toHaveAttribute("href", `/rides/${rideId}/calendar.ics`);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Add to calendar" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("ride.ics");
  const calendar = await readFile((await download.path())!, "utf8");
  expect(calendar).toContain(`UID:${rideId}@gt-carpool`);
  expect(calendar).toContain("SUMMARY:Carpool: Campus → ATL Domestic");

  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByText("Link copied", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => window.localStorage.getItem("copied-text")),
  ).toBe(rideUrl);

  const textLink = page.getByRole("link", { name: "Text everyone" });
  await expect(textLink).toBeVisible();
  const smsHref = (await textLink.getAttribute("href")) ?? "";
  expect(smsHref.startsWith("sms:")).toBe(true);
  expect(smsHref).toContain("+14045550102");
  expect(smsHref).toContain("+14045550103");
  expect(smsHref).toContain("Hey!%20Carpool%20for");
  expect(smsHref).toContain(
    encodeURIComponent(
      `<Campus → ATL Domestic>: http://127.0.0.1:3000/rides/${rideId}`,
    ),
  );

  if (screenshotDirectory) {
    mkdirSync(screenshotDirectory, { recursive: true });
    await page.screenshot({
      path: join(
        screenshotDirectory,
        `member-ride-actions-${testInfo.project.name}.png`,
      ),
      scale: "css",
    });
  }
});

test("ride reports are emailed and duplicate reports are rejected", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "desktop") {
    await page.setViewportSize({ width: 1280, height: 800 });
  }
  const email = uniqueGatechEmail();
  await setupMember(page, email, "Taylor", "(404) 555-0104");
  await createRide(page);
  const rideUrl = page.url();
  await page.getByRole("button", { name: "Report a problem" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  if (screenshotDirectory) {
    mkdirSync(screenshotDirectory, { recursive: true });
    await page.screenshot({
      path: join(
        screenshotDirectory,
        `report-dialog-${testInfo.project.name}.png`,
      ),
      scale: "css",
    });
  }

  await dialog.getByLabel("Felt unsafe").check();
  await dialog
    .locator("#report-details")
    .fill("The ride information was concerning.");
  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(
    dialog.getByText("Thanks — we'll look into it.", { exact: true }),
  ).toBeVisible();

  if (testInfo.project.name === "desktop") {
    const reportsEmail = process.env.REPORTS_EMAIL;
    if (!reportsEmail) {
      throw new Error(
        "REPORTS_EMAIL must be set for the Mailpit e2e assertion",
      );
    }
    const body = await getLatestEmailBody(reportsEmail, {
      subject: "GT Carpool ride report",
      timeoutMs: 10_000,
    });
    expect(body).toContain("Reason: unsafe");
    expect(body).toContain("Details: The ride information was concerning.");
    expect(body).toContain(`Ride: ${rideUrl}`);
    expect(body).toContain(`Reporter: ${email}`);
  }

  await page.goto(rideUrl);
  await page.getByRole("button", { name: "Report a problem" }).click();
  const duplicateDialog = page.getByRole("dialog");
  await duplicateDialog.getByLabel("Felt unsafe").check();
  await duplicateDialog.getByRole("button", { name: "Send" }).click();
  await expect(duplicateDialog.getByRole("alert")).toHaveText(
    "You already reported this ride.",
  );
});
