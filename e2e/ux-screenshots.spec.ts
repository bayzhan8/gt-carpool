import { pickTime } from "./helpers/time";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { nextDays } from "../lib/time";
import {
  completeProfile,
  sendSignInCode,
  signInAs,
  uniqueGatechEmail,
} from "./helpers/auth";

const outputDirectory = process.env.UX_SCREENSHOT_DIR;

test("captures browse and sign-in UX states", async ({
  page,
  browser,
}, testInfo) => {
  test.skip(
    !outputDirectory,
    "Set UX_SCREENSHOT_DIR to capture UX screenshots.",
  );
  test.setTimeout(90_000);
  const mobile = testInfo.project.name === "mobile";
  const size = mobile
    ? { width: 390, height: 844 }
    : { width: 1280, height: 800 };
  await page.setViewportSize(size);
  await mkdir(outputDirectory!, { recursive: true });
  const capture = (name: string) =>
    page.screenshot({
      path: join(outputDirectory!, `${name}-${testInfo.project.name}.png`),
      scale: "css",
      fullPage: false,
    });

  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, {
    firstName: "Alex",
    lastName: "Parker",
    phone: "(404) 555-0141",
  });
  const date = nextDays(28)[20]!;
  await page.goto(`/rides/new?dir=airport&date=${date}`);
  await pickTime(page, "08:30");
  await page.getByRole("button", { name: "Post ride" }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+$/);

  await page.goto(`/?dir=airport&day=${date}&time=morning&seats=1`);
  await expect(
    page.getByText("8:30 AM", { exact: true }).first(),
  ).toBeVisible();
  await capture("browse-filters");

  await page.goto(`/?dir=airport&day=${date}&time=night`);
  await expect(page.getByText("No rides match these filters.")).toBeVisible();
  await capture("browse-empty-filters");

  if (!browser) throw new Error("Browser is unavailable");
  const anonymous = await browser.newContext({
    baseURL: "http://127.0.0.1:3000",
    viewport: size,
    timezoneId: "America/Los_Angeles",
  });
  const signInPage = await anonymous.newPage();
  await signInPage.goto("/signin");
  await signInPage.screenshot({
    path: join(outputDirectory!, `signin-${testInfo.project.name}.png`),
    scale: "css",
    fullPage: false,
  });
  await sendSignInCode(signInPage, uniqueGatechEmail());
  await expect(signInPage.getByLabel("Code")).toBeVisible();
  await signInPage.screenshot({
    path: join(outputDirectory!, `signin-code-${testInfo.project.name}.png`),
    scale: "css",
    fullPage: false,
  });
  await anonymous.close();
});
