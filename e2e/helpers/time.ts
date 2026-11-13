import { expect, type Page } from "@playwright/test";

export async function pickTime(page: Page, value: string): Promise<void> {
  const [hour24 = 0, minute = 0] = value.split(":").map(Number);
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  await page.getByLabel("Time", { exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Departure time" });
  await expect(dialog).toBeVisible();
  const choose = async (wheel: string, option: string) => {
    const target = dialog
      .getByRole("listbox", { name: wheel })
      .getByRole("option", { name: option, exact: true });
    await target.evaluate((element) =>
      element.scrollIntoView({ block: "center" }),
    );
    await expect(target).toHaveAttribute("aria-selected", "true");
  };
  await choose("Hour", String(hour));
  await choose("Minute", String(minute).padStart(2, "0"));
  await choose("AM or PM", hour24 >= 12 ? "PM" : "AM");
  await expect(page.locator('input[name="time"]')).toHaveValue(value);
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
}
