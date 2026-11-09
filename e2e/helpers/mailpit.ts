type MailpitOptions = {
  baseUrl?: string;
  intervalMs?: number;
  subject?: string;
  timeoutMs?: number;
};

type MailpitSummary = {
  ID: string;
  Created: string;
  Subject: string;
  To: Array<{ Address: string }>;
};

type MailpitMessage = {
  Text?: string;
  HTML?: string;
};

const defaultBaseUrl = "http://127.0.0.1:54324";

async function pollForLatestMessage(
  email: string,
  {
    baseUrl = process.env.MAILPIT_URL ?? defaultBaseUrl,
    intervalMs = 500,
    subject,
    timeoutMs = 30_000,
  }: MailpitOptions = {},
): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs;
  const address = email.toLowerCase();

  while (Date.now() <= deadline) {
    const listResponse = await fetch(`${baseUrl}/api/v1/messages?limit=100`);

    if (!listResponse.ok) {
      throw new Error(
        `Mailpit returned ${listResponse.status} while listing messages`,
      );
    }

    const payload = (await listResponse.json()) as {
      messages: MailpitSummary[];
    };
    const latest = payload.messages
      .filter(
        (message) =>
          (!subject || message.Subject === subject) &&
          message.To.some(
            (recipient) => recipient.Address.toLowerCase() === address,
          ),
      )
      .sort(
        (left, right) => Date.parse(right.Created) - Date.parse(left.Created),
      )[0];

    if (latest) {
      const messageResponse = await fetch(
        `${baseUrl}/api/v1/message/${encodeURIComponent(latest.ID)}`,
      );

      if (!messageResponse.ok) {
        throw new Error(
          `Mailpit returned ${messageResponse.status} while reading a message`,
        );
      }

      return (await messageResponse.json()) as MailpitMessage;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `No email for ${email} arrived in Mailpit within ${timeoutMs}ms`,
  );
}

export async function getLatestOtp(
  email: string,
  options?: MailpitOptions,
): Promise<string> {
  const message = await pollForLatestMessage(email, options);
  const body = `${message.Text ?? ""}\n${message.HTML ?? ""}`;
  const otp = body.match(/\b\d{6}\b/)?.[0];

  if (!otp) {
    throw new Error(
      `The latest email for ${email} did not contain a 6-digit code`,
    );
  }

  return otp;
}

export async function getLatestEmailBody(
  email: string,
  options?: MailpitOptions,
): Promise<string> {
  const message = await pollForLatestMessage(email, options);
  return message.Text ?? message.HTML ?? "";
}

export async function clearMailbox(
  options: Pick<MailpitOptions, "baseUrl"> = {},
) {
  const baseUrl = options.baseUrl ?? process.env.MAILPIT_URL ?? defaultBaseUrl;
  const response = await fetch(`${baseUrl}/api/v1/messages`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(
      `Mailpit returned ${response.status} while clearing messages`,
    );
  }
}
