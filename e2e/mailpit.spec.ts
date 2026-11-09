import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import {
  clearMailbox,
  getLatestEmailBody,
  getLatestOtp,
} from "./helpers/mailpit";

test("local Supabase sends an OTP to Mailpit without a link", async ({
  browserName,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  expect(browserName).toBe("chromium");
  const email = "smoke@gatech.edu";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  await clearMailbox();
  const { error } = await supabase.auth.signInWithOtp({ email });
  expect(error).toBeNull();

  const otp = await getLatestOtp(email);
  const body = await getLatestEmailBody(email);

  expect(otp).toMatch(/^\d{6}$/);
  expect(body).not.toMatch(/https?:\/\//i);
});
