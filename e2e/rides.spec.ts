import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { next14Days } from "../lib/time";
import { completeProfile, signInAs, uniqueGatechEmail } from "./helpers/auth";

async function setupMember(page: Page, firstName: string, lastName: string) {
  await signInAs(page, uniqueGatechEmail());
  await completeProfile(page, {
    firstName,
    lastName,
    phone: "(404) 555-0123",
    venmo: "carpool5",
  });
}

async function createRide(
  page: Page,
  {
    date = next14Days(new Date())[1],
    time = "06:30",
    seats = 4,
    notes = "",
  }: { date?: string; time?: string; seats?: number; notes?: string } = {},
) {
  await page.goto("/rides/new");
  await page.getByLabel("Date").fill(date ?? "");
  await page.getByLabel("Time").fill(time);
  for (let count = 4; count > seats; count -= 1) {
    await page.getByRole("button", { name: "Decrease seats" }).click();
  }
  for (let count = 4; count < seats; count += 1) {
    await page.getByRole("button", { name: "Increase seats" }).click();
  }
  await page.getByLabel("Notes").fill(notes);
  await page.getByRole("button", { name: "Post ride" }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+$/);
}

async function expectAccessible(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
}

test("R-RIDE-5 posts and displays Atlanta time under the right day", async ({
  page,
}) => {
  await setupMember(page, "Alex", "Parker");
  const date = next14Days(new Date())[1];
  await createRide(page, { date, time: "06:30", notes: "Flight at 9 AM" });
  await expect(
    page.getByText("6:30 AM", { exact: true }).first(),
  ).toBeVisible();
  await page.goto(`/?day=${date}`);
  await expect(
    page.getByText("6:30 AM", { exact: true }).first(),
  ).toBeVisible();
  await expectAccessible(page);
  await page.goto(`/?dir=campus&day=${date}`);
  await expect(page.getByText("6:30 AM", { exact: true })).toHaveCount(0);
  await page.goto(`/?dir=airport&day=${date}`);
  await expect(
    page.getByText("6:30 AM", { exact: true }).first(),
  ).toBeVisible();
  await page.goto("/?dir=airport&day=2099-01-01");
  await expect(
    page.getByText("No rides yet. Post one and others can join."),
  ).toBeVisible();
  await page.goto("/rides/new");
  await expectAccessible(page);
});

test("R-RIDE-1 returns 404 for invalid and unknown ride IDs", async ({
  page,
}) => {
  for (const id of ["not-a-uuid", "00000000-0000-4000-8000-000000000000"]) {
    const response = await page.goto(`/rides/${id}`);
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "This ride isn't here." }),
    ).toBeVisible();
    await expect(
      page.getByText("It may have been cancelled, or the link is wrong."),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to rides" }),
    ).toHaveAttribute("href", "/");
  }
});

test("R-VIS-1/2/3 and R-JOIN-1 show contacts only to ride members", async ({
  page,
}) => {
  await setupMember(page, "Alice", "Owner");
  await createRide(page, { seats: 2, notes: "Meet at Tech Square" });
  const rideUrl = page.url();
  const ownerEmail = await page
    .locator('a[href^="mailto:"]')
    .first()
    .getAttribute("href");
  expect(ownerEmail).toContain("@gatech.edu");
  const ownerEmailAddress = ownerEmail?.replace(/^mailto:/, "") ?? "";

  const browser = page.context().browser();
  if (!browser) throw new Error("Browser context is unavailable");
  const anonymous = await browser.newContext();
  const anonPage = await anonymous.newPage();
  await anonPage.goto(rideUrl);
  await expect(anonPage.getByText("Meet at Tech Square")).toHaveCount(0);
  await expect(anonPage.getByText("Alice O.")).toHaveCount(0);
  const anonymousHtml = await anonPage.content();
  expect(anonymousHtml).not.toContain("+14045550123");
  expect(anonymousHtml).not.toContain(ownerEmailAddress);
  await expect(
    anonPage.getByRole("link", { name: "Sign in with your GT email to join" }),
  ).toBeVisible();

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await setupMember(memberPage, "Casey", "Member");
  await memberPage.goto(rideUrl);
  await expect(memberPage.getByText("Meet at Tech Square")).toBeVisible();
  await expect(memberPage.getByText("Alice O.")).toBeVisible();
  await expect(memberPage.locator('a[href^="tel:"]')).toHaveCount(0);
  const nonmemberHtml = await memberPage.content();
  expect(nonmemberHtml).not.toContain("+14045550123");
  expect(nonmemberHtml).not.toContain(ownerEmailAddress);
  await memberPage.getByRole("button", { name: "Join ride" }).click();
  const dialog = memberPage.getByRole("dialog");
  await expect(dialog).toContainText(
    "You'll text each other and order one Uber/Lyft on the day.",
  );
  await dialog.getByRole("button", { name: "Join" }).click();
  await expect(
    memberPage.locator('a[href="tel:+14045550123"]').first(),
  ).toBeVisible();
  await expect(
    memberPage.getByRole("link", { name: "@carpool5" }).first(),
  ).toHaveAttribute("href", "https://venmo.com/u/carpool5");
  await expectAccessible(memberPage);

  await page.reload();
  await expect(page.getByText("Casey Member", { exact: true })).toBeVisible();
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(2);
  await expectAccessible(page);

  const fullViewerContext = await browser.newContext();
  const fullViewer = await fullViewerContext.newPage();
  await setupMember(fullViewer, "Jordan", "Viewer");
  await fullViewer.goto(rideUrl);
  await expect(fullViewer.getByRole("button", { name: "Full" })).toBeDisabled();

  await anonymous.close();
  await memberContext.close();
  await fullViewerContext.close();
});

test("R-EDIT-1 rejects seats below passengers and then saves a new time", async ({
  page,
}) => {
  await setupMember(page, "Alex", "Parker");
  await createRide(page, { seats: 3, time: "08:30" });
  const rideUrl = page.url();
  const rideId = rideUrl.split("/").at(-1)!;
  const browser = page.context().browser();
  if (!browser) throw new Error("Browser context is unavailable");
  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  await setupMember(secondPage, "Casey", "Member");
  await secondPage.goto(rideUrl);
  await secondPage.getByRole("button", { name: "Join ride" }).click();
  await secondPage
    .getByRole("dialog")
    .getByRole("button", { name: "Join" })
    .click();

  const thirdContext = await browser.newContext();
  const thirdPage = await thirdContext.newPage();
  await setupMember(thirdPage, "Jordan", "Member");
  await thirdPage.goto(rideUrl);
  await thirdPage.getByRole("button", { name: "Join ride" }).click();
  await thirdPage
    .getByRole("dialog")
    .getByRole("button", { name: "Join" })
    .click();

  await page.goto(`/rides/${rideId}/edit`);
  await page.getByRole("button", { name: "Decrease seats" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator("p[role=alert]")).toHaveText(
    "Seats can't be fewer than the current passengers.",
  );
  await page.getByRole("button", { name: "Increase seats" }).click();
  await page.getByLabel("Time").fill("09:30");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("9:30 AM", { exact: true })).toBeVisible();
  await secondContext.close();
  await thirdContext.close();
});

test("R-DUP-1 suggests an existing ride and R-CANCEL-1 keeps it in member history", async ({
  page,
}) => {
  await setupMember(page, "Alex", "Parker");
  const date = next14Days(new Date())[1];
  await createRide(page, { date, time: "10:30", notes: "Meet at the library" });
  const rideUrl = page.url();
  const ridePath = new URL(rideUrl).pathname;

  await page.goto(`/?dir=airport&day=${date}`);
  await expect(page.getByText("10:30 AM", { exact: true })).toBeVisible();
  await page.goto(`/?dir=campus&day=invalid`);
  await expect(page.getByRole("heading", { name: "Rides" })).toBeVisible();

  const browser = page.context().browser();
  if (!browser) throw new Error("Browser context is unavailable");
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await setupMember(memberPage, "Casey", "Member");
  await memberPage.goto("/rides/new");
  await memberPage.getByLabel("Date").fill(date ?? "");
  await memberPage.getByLabel("Time").fill("10:30");
  await expect(
    memberPage.getByText("Already going around then — join instead?"),
  ).toBeVisible({ timeout: 10000 });
  await memberPage.getByRole("link", { name: /10:30 AM/ }).click();
  await expect(memberPage).toHaveURL(rideUrl);
  await memberPage.getByRole("button", { name: "Join ride" }).click();
  const joinDialog = memberPage.getByRole("dialog");
  await joinDialog.getByRole("button", { name: "Join" }).click();
  await expect(joinDialog).toBeHidden();

  const memberProfilePage = await memberContext.newPage();
  await memberProfilePage.goto("/me");
  const memberRideLink = memberProfilePage.locator(`a[href="${ridePath}"]`);
  await expect(memberRideLink).toBeVisible();

  await page.goto(rideUrl);
  await page.getByRole("button", { name: "Cancel ride" }).click();
  const cancelDialog = page.getByRole("dialog");
  await cancelDialog.getByRole("button", { name: "Cancel ride" }).click();
  await expect(cancelDialog).toBeHidden();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
  await memberPage.reload();
  await expect(
    memberPage.getByText("Cancelled", { exact: true }),
  ).toBeVisible();

  const documentNavigations: string[] = [];
  memberProfilePage.on("request", (request) => {
    if (request.isNavigationRequest()) documentNavigations.push(request.url());
  });
  await memberRideLink.click();
  await expect(memberProfilePage).toHaveURL(rideUrl);
  expect(documentNavigations).toEqual([]);
  await expect(
    memberProfilePage.getByText("Cancelled", { exact: true }),
  ).toBeVisible();

  await memberPage.goto("/me");
  await expect(
    memberPage.getByRole("heading", { name: "Past & cancelled" }),
  ).toBeVisible();
  await expectAccessible(memberPage);

  const anonymous = await browser.newContext();
  const anonymousPage = await anonymous.newPage();
  await anonymousPage.goto(rideUrl);
  await expect(
    anonymousPage.getByRole("heading", { name: "This ride isn't here." }),
  ).toBeVisible();
  await anonymous.close();
  await memberContext.close();
});

test("R-PROF-2 deletes an account and transfers its ride to the member", async ({
  page,
}) => {
  const ownerEmail = uniqueGatechEmail();
  await signInAs(page, ownerEmail);
  await completeProfile(page, {
    firstName: "Alex",
    lastName: "Owner",
    phone: "(404) 555-0123",
  });
  await createRide(page, { seats: 2 });
  const rideUrl = page.url();

  const browser = page.context().browser();
  if (!browser) throw new Error("Browser context is unavailable");
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await setupMember(memberPage, "Casey", "Member");
  await memberPage.goto(rideUrl);
  await memberPage.getByRole("button", { name: "Join ride" }).click();
  const joinDialog = memberPage.getByRole("dialog");
  await joinDialog.getByRole("button", { name: "Join" }).click();
  await expect(joinDialog).toBeHidden();

  await page.goto("/me");
  await page.getByRole("button", { name: "Delete account" }).click();
  const deleteDialog = page.getByRole("dialog");
  await expect(deleteDialog).toContainText(
    "This removes you from your upcoming rides and deletes your profile. Type DELETE to confirm.",
  );
  const deleteButton = deleteDialog.getByRole("button", {
    name: "Delete",
    exact: true,
  });
  await expect(deleteButton).toBeDisabled();
  await deleteDialog.getByLabel("Type DELETE to confirm").fill("DELETE");
  await expect(deleteButton).toBeEnabled();
  await deleteButton.click();
  await expect(page).toHaveURL("/");

  await memberPage.reload();
  await expect(memberPage.getByText("Owner", { exact: true })).toBeVisible();

  await signInAs(page, ownerEmail);
  await expect(page).toHaveURL(/\/welcome(?:\?|$)/);
  await memberContext.close();
});

test("R-LEAVE-2 transfers ride ownership to the remaining member", async ({
  page,
}) => {
  await setupMember(page, "Alex", "Parker");
  await createRide(page, { seats: 2, time: "12:30" });
  const rideUrl = page.url();
  const browser = page.context().browser();
  if (!browser) throw new Error("Browser context is unavailable");
  const memberContext = await browser.newContext();
  const member = await memberContext.newPage();
  await setupMember(member, "Casey", "Member");
  await member.goto(rideUrl);
  await member.getByRole("button", { name: "Join ride" }).click();
  await member
    .getByRole("dialog")
    .getByRole("button", { name: "Join" })
    .click();

  await page.goto(rideUrl);
  await page.getByRole("button", { name: "Leave ride" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Leave" }).click();
  await expect(dialog).toBeHidden();
  await member.goto(rideUrl);
  await expect(member.getByText("Owner", { exact: true })).toBeVisible();
  await expect(member.getByRole("link", { name: "Edit" })).toBeVisible();
  await expectAccessible(member);
  await memberContext.close();
});

test("R-RIDE-4 rejects a sixth upcoming ride", async ({ page }) => {
  await setupMember(page, "Alex", "Parker");
  const dates = next14Days(new Date());
  for (let index = 1; index <= 5; index += 1) {
    await page.goto("/rides/new");
    await page.getByLabel("Date").fill(dates[index] ?? "");
    await page.getByLabel("Time").fill("14:30");
    await page.getByRole("button", { name: "Post ride" }).click();
    await page.waitForURL(/\/rides\/[0-9a-f-]+$/);
  }
  await page.goto("/rides/new");
  await page.getByLabel("Date").fill(dates[6] ?? "");
  await page.getByLabel("Time").fill("14:30");
  await page.getByRole("button", { name: "Post ride" }).click();
  await expect(page.locator("p[role=alert]")).toHaveText(
    "You can have at most 5 upcoming rides.",
  );
});
