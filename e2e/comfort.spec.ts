import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { completeProfile, signInAs, uniqueGatechEmail } from "./helpers/auth";

test("R-COMFORT onboarding, audience rules, browse and mix", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "desktop") {
    await page.setViewportSize({ width: 1280, height: 800 });
  }
  const screenshotDirectory = process.env.M7_SCREENSHOT_DIR;
  if (screenshotDirectory) mkdirSync(screenshotDirectory, { recursive: true });
  async function capture(name: string) {
    if (!screenshotDirectory) return;
    await page.screenshot({
      path: join(screenshotDirectory, `${name}-${testInfo.project.name}.png`),
      scale: "css",
    });
  }
  async function signOutLocally() {
    await page.context().clearCookies();
  }

  await signInAs(page, uniqueGatechEmail());
  await expect(page.getByText("Which describes you?")).toBeVisible();
  await page.getByLabel("First name").fill("Morgan");
  await page.getByLabel("Last name").fill("Parker");
  await page.getByLabel("Phone").fill("(404) 555-0123");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/welcome/);
  await capture("welcome-gender-choice");
  const welcomeAxe = await new AxeBuilder({ page }).analyze();
  expect(
    welcomeAxe.violations.filter((item) =>
      ["critical", "serious"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);

  await completeProfile(page, { firstName: "Morgan", gender: "woman" });
  await page.goto("/rides/new");
  await expect(
    page.locator('input[name="audience"][value="women"]'),
  ).not.toBeChecked();
  await page.getByText("Women only", { exact: true }).click();
  await expect(
    page.locator('input[name="audience"][value="women"]'),
  ).toBeChecked();
  await capture("ride-form-audience");
  const formAxe = await new AxeBuilder({ page }).analyze();
  expect(
    formAxe.violations.filter((item) =>
      ["critical", "serious"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: "Post ride" }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+$/i);
  const womenRideId = page.url().split("/").pop();
  expect(womenRideId).toBeTruthy();

  await signOutLocally();
  await page.goto("/");
  const manEmail = uniqueGatechEmail();
  await signInAs(page, manEmail);
  await completeProfile(page, { firstName: "Morgan", gender: "man" });
  await page.goto("/");
  await expect(page.locator(`a[href="/rides/${womenRideId}"]`)).toHaveCount(0);
  await page.goto(`/rides/${womenRideId}`);
  await expect(page.getByText("Women only", { exact: true })).toBeVisible();
  await expect(
    page.getByText("This ride is for women only.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Join ride" })).toHaveCount(0);
  await capture("nonmatching-ride");
  const restrictedCalendar = await page.request.get(
    `/rides/${womenRideId}/calendar.ics`,
  );
  expect(restrictedCalendar.status()).toBe(200);
  const missingCalendar = await page.request.get(
    "/rides/00000000-0000-4000-8000-000000000000/calendar.ics",
  );
  expect(missingCalendar.status()).toBe(404);

  await signOutLocally();
  await page.goto(`/rides/${womenRideId}`);
  await expect(
    page.getByRole("link", { name: "Add to calendar" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Share" })).toBeVisible();

  await signOutLocally();
  await page.goto("/");
  const secondWomanEmail = uniqueGatechEmail();
  await signInAs(page, secondWomanEmail);
  await completeProfile(page, { firstName: "Casey", gender: "woman" });
  await page.goto(`/rides/${womenRideId}`);
  await page.getByRole("button", { name: "Join ride" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Join" }).click();
  await expect(page.getByRole("button", { name: "Leave ride" })).toBeVisible();

  await page.goto("/rides/new");
  await page.getByRole("button", { name: "Post ride" }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+$/i);
  const anyoneRideId = page.url().split("/").pop();

  await signOutLocally();
  await page.goto("/");
  await signInAs(page, manEmail);
  await page.goto(`/rides/${anyoneRideId}`);
  await page.getByRole("button", { name: "Join ride" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Join" }).click();
  await expect(
    page.getByText("1 woman · 1 man", { exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByText("1 woman · 1 man", { exact: true }).first(),
  ).toBeVisible();
  await signOutLocally();
  await signInAs(page, secondWomanEmail);
  await page.goto("/");
  await expect(
    page
      .locator(`a[href="/rides/${womenRideId}"]`)
      .getByText("Women only", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(`a[href="/rides/${anyoneRideId}"]`)
      .getByText("1 woman · 1 man", { exact: true }),
  ).toBeVisible();
  await capture("browse-chips-mix");

  await signOutLocally();
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, {
    firstName: "Jordan",
    gender: "unspecified",
  });
  await page.goto("/rides/new");
  await expect(page.locator('input[name="audience"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Post ride" }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+$/i);
  await expect(page.getByText("Anyone", { exact: true })).toBeVisible();
});
