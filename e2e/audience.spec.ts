import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { completeProfile, signInAs, uniqueGatechEmail } from "./helpers/auth";

test("R-AUDIENCE onboarding, audience rules, browse and mix", async ({
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
  await page.goto("/welcome");
  await expect(page.getByText("Gender", { exact: true })).toHaveCount(0);
  await capture("welcome-onboarding");
  const welcomeAxe = await new AxeBuilder({ page }).analyze();
  expect(
    welcomeAxe.violations.filter((item) =>
      ["critical", "serious"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);

  await completeProfile(page, { firstName: "Morgan" });
  await page.goto("/rides/new");
  await expect(
    page.locator('input[name="audience"][value="women"]'),
  ).not.toBeChecked();
  await expect(
    page.getByText("Only women can see and join this ride."),
  ).toBeVisible();
  await page.getByText("Women only", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Women-only and men-only rides" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Woman", exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
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
  await page.waitForURL(/\/rides\/[0-9a-f-]+(?:\?welcome=posted)?$/i);
  await expect(page.getByText("Your ride is up!")).toBeVisible();
  await expect(page.getByText("Women only", { exact: true })).toBeVisible();
  await expect(page).not.toHaveURL(/welcome=/);
  const womenRideId = new URL(page.url()).pathname.split("/").pop();
  expect(womenRideId).toBeTruthy();

  await page.goto("/rides/new");
  await page.getByText("Women only", { exact: true }).click();
  await page.getByRole("button", { name: "Post ride" }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+(?:\?welcome=posted)?$/i);
  await expect(page).not.toHaveURL(/welcome=/);
  const secondWomenRideId = new URL(page.url()).pathname.split("/").pop();
  expect(secondWomenRideId).toBeTruthy();

  await signOutLocally();
  await page.goto("/");
  const manEmail = uniqueGatechEmail();
  await signInAs(page, manEmail);
  await completeProfile(page, { firstName: "Morgan", gender: "man" });
  await page.goto("/");
  await expect(page.locator(`a[href="/rides/${womenRideId}"]`)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Show only women only rides" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Show only men only rides" }),
  ).toBeVisible();
  await page.goto(`/rides/${womenRideId}`);
  await expect(page.getByText("Women only", { exact: true })).toBeVisible();
  await expect(page.getByText(/This ride is for women only\./)).toBeVisible();
  await expect(
    page.getByText("You can still join any ride marked Anyone."),
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
  await completeProfile(page, { firstName: "Casey" });
  await page.goto(`/rides/${womenRideId}`);
  await page.getByRole("button", { name: "Join ride" }).click();
  await expect(
    page.getByRole("heading", { name: "Women-only and men-only rides" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Woman", exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("You're in!")).toBeVisible();
  await expect(page.getByRole("button", { name: "Leave ride" })).toBeVisible();
  await page.goto(`/rides/${secondWomenRideId}`);
  await page.getByRole("button", { name: "Join ride" }).click();
  await expect(
    page.getByRole("heading", { name: "Women-only and men-only rides" }),
  ).toHaveCount(0);
  await page.getByRole("dialog").getByRole("button", { name: "Join" }).click();
  await expect(page.getByRole("button", { name: "Leave ride" })).toBeVisible();

  await page.goto("/rides/new");
  await page.getByRole("button", { name: "Post ride" }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+(?:\?welcome=posted)?$/i);
  const anyoneRideId = new URL(page.url()).pathname.split("/").pop();

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
  const womenOnlyFilter = page.getByRole("button", {
    name: "Show only women only rides",
  });
  await womenOnlyFilter.click();
  await expect(womenOnlyFilter).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/only=women/);
  await expect(page.locator(`a[href="/rides/${womenRideId}"]`)).toBeVisible();
  await expect(page.locator(`a[href="/rides/${anyoneRideId}"]`)).toHaveCount(0);
  await capture("browse-women-only-filter");
  await womenOnlyFilter.click();
  await expect(womenOnlyFilter).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(`a[href="/rides/${anyoneRideId}"]`)).toBeVisible();

  await signOutLocally();
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, {
    firstName: "Jordan",
    gender: "unspecified",
  });
  await page.goto("/rides/new");
  await expect(page.locator('input[name="audience"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Post ride" }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+(?:\?welcome=posted)?$/i);
  await expect(page).not.toHaveURL(/welcome=/);
  await expect(page.getByText("Anyone", { exact: true })).toBeVisible();
});

test("unset-gender users browse restricted rides and join anyone rides", async ({
  page,
}) => {
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, { firstName: "Owner", gender: "woman" });
  await page.goto("/rides/new");
  await page.getByText("Women only", { exact: true }).click();
  await page.getByRole("button", { name: "Post ride" }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+(?:\?welcome=posted)?$/i);
  const restrictedId = new URL(page.url()).pathname.split("/").pop();
  await page.goto("/rides/new");
  await page.getByRole("button", { name: "Post ride" }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+(?:\?welcome=posted)?$/i);
  const anyoneId = new URL(page.url()).pathname.split("/").pop();

  await page.context().clearCookies();
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, { firstName: "Unset" });
  await page.goto("/");
  await expect(page.locator(`a[href="/rides/${restrictedId}"]`)).toBeVisible();
  await page.goto(`/rides/${anyoneId}`);
  await page.getByRole("button", { name: "Join ride" }).click();
  await expect(
    page.getByRole("heading", { name: "Women-only and men-only rides" }),
  ).toHaveCount(0);
  await page.getByRole("dialog").getByRole("button", { name: "Join" }).click();
  await expect(page.getByRole("button", { name: "Leave ride" })).toBeVisible();
});

test("unset-gender restricted join choices that do not match stay out", async ({
  page,
}) => {
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, { firstName: "Owner", gender: "woman" });
  await page.goto("/rides/new");
  await page.getByText("Women only", { exact: true }).click();
  await page.getByRole("button", { name: "Post ride" }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+(?:\?welcome=posted)?$/i);
  const rideId = new URL(page.url()).pathname.split("/").pop();

  for (const [choice, email] of [
    ["Man", uniqueGatechEmail()],
    ["Prefer not to say", uniqueGatechEmail()],
  ]) {
    await page.context().clearCookies();
    await signInAs(page, email);
    await completeProfile(page, { firstName: "Unset" });
    await page.goto(`/rides/${rideId}`);
    await page.getByRole("button", { name: "Join ride" }).click();
    await page.getByRole("radio", { name: choice, exact: true }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/This ride is for women only\./)).toBeVisible();
    await expect(page.getByRole("button", { name: "Join ride" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: "Leave ride" })).toHaveCount(
      0,
    );
  }
});

test("unset-gender post mismatch reverts to Anyone", async ({ page }) => {
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, { firstName: "Unset" });
  await page.goto("/rides/new");
  await page.getByText("Men only", { exact: true }).click();
  await page.getByRole("radio", { name: "Woman", exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByText("Men-only rides can only be posted by men."),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: "Anyone" })).toBeChecked();
});
