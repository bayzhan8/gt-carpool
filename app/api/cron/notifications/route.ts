import { timingSafeEqual } from "node:crypto";
import { drainOutbox } from "@/lib/notifications/drain";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  const provided = Buffer.from(request.headers.get("authorization") ?? "");

  if (
    secret &&
    provided.length === expected.length &&
    timingSafeEqual(provided, expected)
  ) {
    return Response.json(await drainOutbox({ limit: 100 }));
  }

  const bearerToken = /^Bearer\s+(.+)$/i.exec(
    request.headers.get("authorization") ?? "",
  )?.[1];
  if (!bearerToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data, error } = await createAdminClient().rpc(
      "verify_drain_token",
      {
        p_token: bearerToken,
      },
    );
    if (error) throw error;
    if (data !== true) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch (error) {
    console.error("verify_drain_token failed", error);
    return Response.json({ error: "Token check failed" }, { status: 503 });
  }

  return Response.json(await drainOutbox({ limit: 100 }));
}
