import { pickTime } from "./helpers/time";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { nextDays } from "../lib/time";
import { completeProfile, signInAs, uniqueGatechEmail } from "./helpers/auth";

test("captures the requested launch screens", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  test.skip(!process.env.LAUNCH_SCREENSHOT_DIR);
  test.skip(testInfo.project.name !== "desktop");

  const outputDir = process.env.LAUNCH_SCREENSHOT_DIR!;
  mkdirSync(outputDir, { recursive: true });
  const baseURL = "http://127.0.0.1:3000";
  const anonymousContext = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 800 },
  });
  const anonymousPage = await anonymousContext.newPage();

  await anonymousPage.goto("/");
  await anonymousPage.screenshot({
    path: join(outputDir, "home-signed-out-desktop.png"),
  });
  await anonymousPage.setViewportSize({ width: 390, height: 844 });
  await anonymousPage.screenshot({
    path: join(outputDir, "home-signed-out-mobile.png"),
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, { firstName: "Launch" });
  const days = nextDays(28);
  const firstDate = days[8]!;
  const secondDate = days[9]!;

  async function postRide(date: string, time: string, dir = "airport") {
    await page.goto(`/rides/new?dir=${dir}&date=${date}`);
    await pickTime(page, time);
    await page.getByRole("button", { name: "Post ride" }).click();
    await page.waitForURL(/\/rides\/[0-9a-f-]+$/);
    return page.url();
  }

  const memberRideUrl = await postRide(firstDate, "08:15");
  await postRide(firstDate, "13:15");
  await postRide(secondDate, "10:15", "campus");

  await page.goto(`/?dir=airport&day=${firstDate}`);
  await expect(page.getByRole("button", { name: "3+ seats" })).toBeVisible();
  await page.screenshot({
    path: join(outputDir, "home-signed-in-desktop.png"),
  });
  const filterRow = page
    .getByRole("group", { name: "Filter by time" })
    .locator("xpath=..");
  await filterRow.screenshot({
    path: join(outputDir, "filters-row-desktop.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: join(outputDir, "home-signed-in-mobile.png"),
  });

  await page.goto("/me");
  await page
    .getByRole("heading", { name: "Upcoming" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: join(outputDir, "me-upcoming.png"),
  });

  const welcomeContext = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 800 },
  });
  const welcomePage = await welcomeContext.newPage();
  await signInAs(welcomePage, uniqueGatechEmail());
  await welcomePage.goto("/welcome");
  await welcomePage.screenshot({
    path: join(outputDir, "welcome-onboarding.png"),
  });

  const memberContext = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 800 },
  });
  const memberPage = await memberContext.newPage();
  await signInAs(memberPage, uniqueGatechEmail());
  await completeProfile(memberPage, { firstName: "Member" });
  await memberPage.goto(memberRideUrl);
  await memberPage.getByRole("button", { name: "Join ride" }).click();
  await memberPage
    .getByRole("dialog")
    .getByRole("button", { name: "Join" })
    .click();
  await expect(
    memberPage.getByText(
      "GT Carpool just connects you. It doesn't book rides, charge or pay anyone, or handle no-shows, so settle those within your group.",
    ),
  ).toBeVisible();
  await memberPage
    .getByRole("heading", { name: "Passengers" })
    .scrollIntoViewIfNeeded();
  await memberPage.screenshot({
    path: join(outputDir, "member-ride.png"),
  });

  const image = await page.request.get(`${baseURL}/opengraph-image`);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  writeFileSync(join(outputDir, "opengraph-image.png"), await image.body());

  await anonymousContext.close();
  await welcomeContext.close();
  await memberContext.close();
});
