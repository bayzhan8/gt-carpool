import "server-only";

import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { render, type NotificationEmailData } from "./render";

type DrainResult = { sent: number; failed: number };

export function smtpTransport() {
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    ...(user && pass ? { auth: { user, pass } } : {}),
  });
}

export async function drainOutbox({
  limit = 20,
}: { limit?: number } = {}): Promise<DrainResult> {
  let sent = 0;
  let failed = 0;
  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase.rpc("claim_notifications", {
      p_limit: limit,
    });
    if (error) throw error;

    const notifications = (data ?? []) as unknown as NotificationEmailData[];
    if (notifications.length === 0) return { sent, failed };
    const transport = smtpTransport();

    try {
      for (const notification of notifications) {
        try {
          const { subject, text } = render(
            notification,
            process.env.NEXT_PUBLIC_SITE_URL!,
          );
          await transport.sendMail({
            from: process.env.SMTP_FROM,
            to: notification.recipient_email,
            subject,
            text,
          });
          const completion = await supabase.rpc("complete_notification", {
            p_id: notification.id,
            p_ok: true,
          });
          if (completion.error) throw completion.error;
          sent += 1;
        } catch (error) {
          failed += 1;
          try {
            await supabase.rpc("complete_notification", {
              p_id: notification.id,
              p_ok: false,
              p_error: error instanceof Error ? error.message : String(error),
            });
          } catch {
            failed += 1;
          }
        }
      }
    } finally {
      transport.close();
    }
  } catch {
    failed += 1;
  }

  if (failed > 0) console.error(`Notification drain failed: ${failed}`);
  return { sent, failed };
}
