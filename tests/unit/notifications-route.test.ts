import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  drainOutbox: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/notifications/drain", () => ({
  drainOutbox: mocks.drainOutbox,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));

import { GET } from "../../app/api/cron/notifications/route";

function request(authorization?: string): Request {
  return new Request("https://gtcarpool.test/api/cron/notifications", {
    headers: authorization ? { authorization } : undefined,
  });
}

describe("notifications drain route", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.clearAllMocks();
    mocks.drainOutbox.mockResolvedValue({
      sent: 1,
      failed: 0,
      skipped: 0,
    });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the CRON_SECRET without calling the token RPC", async () => {
    const response = await GET(request("Bearer cron-secret"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sent: 1,
      failed: 0,
      skipped: 0,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.drainOutbox).toHaveBeenCalledWith({ limit: 100 });
  });

  it("accepts a valid Vault drain token after CRON_SECRET fails", async () => {
    const response = await GET(request("Bearer vault-token"));

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("verify_drain_token", {
      p_token: "vault-token",
    });
    expect(mocks.drainOutbox).toHaveBeenCalledWith({ limit: 100 });
  });

  it("rejects an invalid drain token", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });

    const response = await GET(request("Bearer invalid-token"));

    expect(response.status).toBe(401);
    expect(mocks.drainOutbox).not.toHaveBeenCalled();
  });

  it("rejects missing credentials without calling the token RPC", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.drainOutbox).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when token verification errors", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "RPC unavailable" },
    });

    const response = await GET(request("Bearer vault-token"));

    expect(response.status).toBe(503);
    expect(mocks.drainOutbox).not.toHaveBeenCalled();
  });
});
