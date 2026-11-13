import "server-only";

import { smtpTransport } from "@/lib/notifications/drain";

export async function sendReportEmail({
  to,
  reporterEmail,
  reason,
  details,
  rideUrl,
}: {
  to: string;
  reporterEmail: string;
  reason: string;
  details: string;
  rideUrl: string;
}) {
  const transport = smtpTransport();
  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject: "GT Carpool ride report",
      text: [
        `Reason: ${reason}`,
        `Details: ${details || "(none)"}`,
        `Ride: ${rideUrl}`,
        `Reporter: ${reporterEmail}`,
      ].join("\n"),
    });
  } finally {
    transport.close();
  }
}
