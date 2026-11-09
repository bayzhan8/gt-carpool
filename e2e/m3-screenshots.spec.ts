import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { next14Days } from "../lib/time";
import { completeProfile, signInAs, uniqueGatechEmail } from "./helpers/auth";

test.skip(!process.env.M3_CAPTURE_SCREENSHOTS, "manual M3 screenshot capture");

test("captures requested M3 screen states", async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === "mobile";
  const size = mobile ? "390x844" : "1280x800";
  await page.setViewportSize(
    mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
  );
  const directory = "/home/ubuntu/artifacts/m3";
  await mkdir(directory, { recursive: true });
  const capture = (target: typeof page, name: string) =>
    target.screenshot({
      path: join(directory, `${name}-${size}.png`),
      fullPage: false,
      scale: "css",
    });
  const days = next14Days(new Date());
  const firstDate = days[1];
  const secondDate = days[2];

  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, {
    firstName: "Alex",
    lastName: "Parker",
    phone: "(404) 555-0123",
    venmo: "carpool5",
  });
  await page.goto("/rides/new");
  await page.getByLabel("Date").fill(firstDate ?? "");
  await page.getByLabel("Time").fill("06:30");
  await page.getByRole("button", { name: "Decrease seats" }).click();
  await page.getByRole("button", { name: "Decrease seats" }).click();
  await page.getByLabel("Notes").fill("Meet at Tech Square");
  await page.getByRole("button", { name: "Post ride" }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+$/);
  const firstRide = page.url();

  await page.goto("/rides/new");
  await page.getByLabel("Date").fill(secondDate ?? "");
  await page.getByLabel("Time").fill("08:00");
  await page.getByRole("button", { name: "Decrease seats" }).click();
  await page.getByLabel("Notes").fill("One bag each");
  await page.getByRole("button", { name: "Post ride" }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+$/);
  const secondRide = page.url();

  const browser = page.context().browser();
  if (!browser) throw new Error("Browser context is unavailable");
  const anonymous = await browser.newContext();
  const anonPage = await anonymous.newPage();
  await anonPage.setViewportSize(
    mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
  );
  await anonPage.goto(firstRide);
  await anonPage.screenshot({
    path: join(directory, `ride-signed-out-${size}.png`),
    fullPage: false,
    scale: "css",
  });

  const memberContext = await browser.newContext();
  const member = await memberContext.newPage();
  await member.setViewportSize(
    mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
  );
  await signInAs(member, uniqueGatechEmail());
  await completeProfile(member, {
    firstName: "Casey",
    lastName: "Member",
    phone: "(404) 555-0124",
    venmo: "casey5",
  });
  await member.goto(firstRide);
  await member.screenshot({
    path: join(directory, `ride-nonmember-${size}.png`),
    fullPage: false,
    scale: "css",
  });
  await member.goto("/rides/new");
  await member.getByLabel("Date").fill(firstDate ?? "");
  await member.getByLabel("Time").fill("06:30");
  await expect(
    member.getByText("Already going around then — join instead?"),
  ).toBeVisible({ timeout: 10000 });
  await capture(member, "ride-new-similar");
  await member.goto(firstRide);
  await member.getByRole("button", { name: "Join ride" }).click();
  await member.screenshot({
    path: join(directory, `join-confirm-${size}.png`),
    fullPage: false,
    scale: "css",
  });
  await member
    .getByRole("dialog")
    .getByRole("button", { name: "Join" })
    .click();
  await member.locator('a[href^="tel:"]').first().waitFor();
  await member.screenshot({
    path: join(directory, `ride-member-${size}.png`),
    fullPage: false,
    scale: "css",
  });

  await page.goto("/");
  await page.screenshot({
    path: join(directory, `browse-rides-${size}.png`),
    fullPage: false,
    scale: "css",
  });
  await page.goto(`/?dir=campus&day=${firstDate}`);
  await page.screenshot({
    path: join(directory, `browse-empty-${size}.png`),
    fullPage: false,
    scale: "css",
  });

  await member.goto(secondRide);
  await member.getByRole("button", { name: "Join ride" }).click();
  await member
    .getByRole("dialog")
    .getByRole("button", { name: "Join" })
    .click();
  const thirdContext = await browser.newContext();
  const third = await thirdContext.newPage();
  await signInAs(third, uniqueGatechEmail());
  await completeProfile(third, {
    firstName: "Jordan",
    lastName: "Member",
    phone: "(404) 555-0125",
    venmo: "jordan5",
  });
  await third.goto(secondRide);
  await third.getByRole("button", { name: "Join ride" }).click();
  await third.getByRole("dialog").getByRole("button", { name: "Join" }).click();

  const secondRideId = secondRide.split("/").at(-1)!;
  await page.goto(`/rides/${secondRideId}/edit`);
  await page.getByRole("button", { name: "Decrease seats" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator("p[role=alert]")).toBeVisible();
  await page.screenshot({
    path: join(directory, `ride-edit-seats-error-${size}.png`),
    fullPage: false,
    scale: "css",
  });

  await page.goto(firstRide);
  await page.getByRole("button", { name: "Cancel ride" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel ride" })
    .click();
  await expect(page.getByText("Cancelled")).toBeVisible();
  await member.goto(firstRide);
  await member.reload();
  await expect(member.getByText("Cancelled")).toBeVisible();
  await member.screenshot({
    path: join(directory, `ride-cancelled-member-${size}.png`),
    fullPage: false,
    scale: "css",
  });
  await page.goto("/me");
  await page.screenshot({
    path: join(directory, `me-upcoming-past-${size}.png`),
    fullPage: false,
    scale: "css",
  });
  await anonymous.close();
  await memberContext.close();
  await thirdContext.close();
});
