import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { next14Days } from "../lib/time";
import {
  render,
  type NotificationEmailData,
  type NotificationKind,
} from "../lib/notifications/render";
import { completeProfile, signInAs, uniqueGatechEmail } from "./helpers/auth";
import { getLatestEmailBody } from "./helpers/mailpit";

const artifactDirectory = process.env.M5_ARTIFACT_DIR;

async function setupMember(
  page: Page,
  email: string,
  firstName: string,
  lastName: string,
) {
  await signInAs(page, email);
  await completeProfile(page, {
    firstName,
    lastName,
    phone: "(404) 555-0123",
    venmo: "carpool5",
  });
}

async function createRide(page: Page) {
  await page.goto("/rides/new");
  await page.getByLabel("Date").fill(next14Days(new Date())[1]);
  await page.getByLabel("Time").fill("06:30");
  await page.getByLabel("Notes").fill("");
  await page.getByRole("button", { name: "Post ride" }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+$/);
}

function saveRenderedBodies(rideId: string) {
  if (!artifactDirectory) return;
  mkdirSync(artifactDirectory, { recursive: true });
  const kinds: NotificationKind[] = [
    "member_joined",
    "member_left",
    "ownership_transferred",
    "ride_cancelled",
    "time_changed",
  ];
  for (const kind of kinds) {
    const notification: NotificationEmailData = {
      id: 1,
      kind,
      actor_name: "Casey M.",
      payload: {
        old_departs_at: "2026-11-09T14:30:00.000Z",
        new_departs_at: "2026-11-09T15:30:00.000Z",
      },
      attempts: 1,
      recipient_email: "alex@gatech.edu",
      recipient_first_name: "Alex",
      ride: {
        id: rideId,
        departs_at: "2026-11-09T14:30:00.000Z",
        origin_short_name: "Campus",
        destination_short_name: "ATL Domestic",
      },
    };
    writeFileSync(
      join(artifactDirectory, `email-${kind}.txt`),
      `${render(notification, process.env.NEXT_PUBLIC_SITE_URL!).text}\n`,
    );
  }
}

test("R-NOTIF-1 sends ride notifications and protects the cron endpoint", async ({
  page,
}) => {
  const ownerEmail = uniqueGatechEmail();
  const memberEmail = uniqueGatechEmail();
  await setupMember(page, ownerEmail, "Alex", "Owner");
  await createRide(page);
  const rideUrl = page.url();
  const rideId = rideUrl.split("/").at(-1)!;
  const browser = page.context().browser();
  if (!browser) throw new Error("Browser context is unavailable");
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await setupMember(memberPage, memberEmail, "Casey", "Member");
  await memberPage.goto(rideUrl);
  await memberPage.getByRole("button", { name: "Join ride" }).click();
  await memberPage
    .getByRole("dialog")
    .getByRole("button", { name: "Join" })
    .click();

  const joined = await getLatestEmailBody(ownerEmail, {
    subject: "Casey M. joined your ride",
    timeoutMs: 10_000,
  });
  expect(joined).toContain(rideUrl);

  await page.goto(`${rideUrl}/edit`);
  await page.getByLabel("Time").fill("07:30");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(rideUrl);
  const changed = await getLatestEmailBody(memberEmail, {
    subject: "Alex O. changed your ride time",
    timeoutMs: 10_000,
  });
  expect(changed).toContain(rideUrl);

  await page.goto(rideUrl);
  await page.getByRole("button", { name: "Cancel ride" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Cancel ride" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
  const cancelled = await getLatestEmailBody(memberEmail, {
    subject: "Alex O. cancelled your ride",
    timeoutMs: 10_000,
  });
  expect(cancelled).toContain(rideUrl);

  expect((await page.request.get("/api/cron/notifications")).status()).toBe(
    401,
  );
  const authorized = await page.request.get("/api/cron/notifications", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(authorized.status()).toBe(200);

  if (artifactDirectory) {
    saveRenderedBodies(rideId);
    await page.goto(process.env.MAILPIT_URL ?? "http://127.0.0.1:54324");
    await page.screenshot({
      path: join(artifactDirectory, "mailpit-messages.png"),
      fullPage: true,
    });
  }
  await memberContext.close();
});
