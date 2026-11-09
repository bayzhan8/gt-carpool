import { timingSafeEqual } from "node:crypto";
import { drainOutbox } from "@/lib/notifications/drain";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  const provided = Buffer.from(request.headers.get("authorization") ?? "");

  if (
    !secret ||
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(await drainOutbox({ limit: 100 }));
}
