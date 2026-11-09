import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { clearMailbox, getLatestOtp } from "./helpers/mailpit";

const mailpitUrl = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

test("before-user-created hook rejects non-GT addresses and accepts a subdomain", async ({
  browserName,
}) => {
  expect(browserName).toBe("chromium");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  await clearMailbox();

  const gmailResult = await supabase.auth.signInWithOtp({
    email: "someone@gmail.com",
  });
  expect(gmailResult.error).not.toBeNull();

  const evilDomainResult = await supabase.auth.signInWithOtp({
    email: "x@gatech.edu.evil.com",
  });
  expect(evilDomainResult.error).not.toBeNull();

  const rejectedMessagesResponse = await fetch(
    `${mailpitUrl}/api/v1/messages?limit=100`,
  );
  expect(rejectedMessagesResponse.ok).toBe(true);
  const rejectedMessages = (await rejectedMessagesResponse.json()) as {
    messages: unknown[];
  };
  expect(rejectedMessages.messages).toHaveLength(0);

  const acceptedEmail = `hook-${randomUUID()}@cc.gatech.edu`;
  const acceptedResult = await supabase.auth.signInWithOtp({
    email: acceptedEmail,
  });
  expect(acceptedResult.error).toBeNull();
  expect(await getLatestOtp(acceptedEmail)).toMatch(/^\d{6}$/);
});
