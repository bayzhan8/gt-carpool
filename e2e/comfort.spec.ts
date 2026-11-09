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
  const screenshotDirectory = process.env.M5B_SCREENSHOT_DIR;
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
  await expect(page.getByText("Are you a brother or a sister?")).toBeVisible();
  await page.getByLabel("First name").fill("Morgan");
  await page.getByLabel("Last name").fill("Sister");
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

  await completeProfile(page, { firstName: "Morgan", gender: "sister" });
  await page.goto("/rides/new");
  await expect(
    page.locator('input[name="audience"][value="sisters"]'),
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
  const sistersRideId = page.url().split("/").pop();
  expect(sistersRideId).toBeTruthy();

  await signOutLocally();
  await page.goto("/");
  const brotherEmail = uniqueGatechEmail();
  await signInAs(page, brotherEmail);
  await completeProfile(page, { firstName: "Brother", gender: "brother" });
  await page.goto("/");
  await expect(page.locator(`a[href="/rides/${sistersRideId}"]`)).toHaveCount(
    0,
  );
  await page.goto(`/rides/${sistersRideId}`);
  await expect(page.getByText("Sisters only", { exact: true })).toBeVisible();
  await expect(
    page.getByText("This ride is for sisters only.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Join ride" })).toHaveCount(0);
  await capture("nonmatching-ride");

  await signOutLocally();
  await page.goto("/");
  const secondSisterEmail = uniqueGatechEmail();
  await signInAs(page, secondSisterEmail);
  await completeProfile(page, { firstName: "Sister", gender: "sister" });
  await page.goto(`/rides/${sistersRideId}`);
  await page.getByRole("button", { name: "Join ride" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Join" }).click();
  await expect(page.getByRole("button", { name: "Leave ride" })).toBeVisible();

  await page.goto("/rides/new");
  await page.getByText("Anyone", { exact: true }).click();
  await page.getByRole("button", { name: "Post ride" }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+$/i);
  const anyoneRideId = page.url().split("/").pop();

  await signOutLocally();
  await page.goto("/");
  await signInAs(page, brotherEmail);
  await page.goto(`/rides/${anyoneRideId}`);
  await page.getByRole("button", { name: "Join ride" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Join" }).click();
  await expect(
    page.getByText("1 brother · 1 sister", { exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByText("1 brother · 1 sister", { exact: true }).first(),
  ).toBeVisible();
  await signOutLocally();
  await signInAs(page, secondSisterEmail);
  await page.goto("/");
  await expect(
    page
      .locator(`a[href="/rides/${sistersRideId}"]`)
      .getByText("Sisters only", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(`a[href="/rides/${anyoneRideId}"]`)
      .getByText("1 brother · 1 sister", { exact: true }),
  ).toBeVisible();
  await capture("browse-chips-mix");
});
