import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  sendMail: vi.fn(),
  close: vi.fn(),
  createTransport: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("nodemailer", () => ({
  default: { createTransport: mocks.createTransport },
}));
vi.mock("../../lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));

import { drainOutbox } from "../../lib/notifications/drain";

describe("notification drain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "claim_notifications") {
        return {
          data: [
            {
              id: 42,
              kind: "member_joined",
              actor_name: "Casey M.",
              payload: {},
              attempts: 1,
              recipient_email: "Demo1@CARPOOL-DEMO.GATECH.EDU",
              recipient_first_name: "Demo",
              ride: {
                id: "ride-id",
                departs_at: "2026-11-09T14:30:00.000Z",
                origin_short_name: "Campus",
                destination_short_name: "ATL Domestic",
              },
            },
          ],
          error: null,
        };
      }

      return { data: null, error: null };
    });
    mocks.createTransport.mockReturnValue({
      sendMail: mocks.sendMail,
      close: mocks.close,
    });
  });

  it("completes demo notifications without sending mail", async () => {
    await expect(drainOutbox()).resolves.toEqual({
      sent: 0,
      failed: 0,
      skipped: 1,
    });

    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.createTransport).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("complete_notification", {
      p_id: 42,
      p_ok: true,
    });
  });

  it("skips reminder email for demo accounts", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "claim_notifications") {
        return {
          data: [
            {
              id: 42,
              kind: "ride_reminder",
              actor_name: "",
              payload: {},
              attempts: 1,
              recipient_email: "Demo1@CARPOOL-DEMO.GATECH.EDU",
              recipient_first_name: "Demo",
              ride: {
                id: "ride-id",
                departs_at: "2026-11-09T14:30:00.000Z",
                origin_short_name: "Campus",
                destination_short_name: "ATL Domestic",
              },
            },
          ],
          error: null,
        };
      }

      return { data: null, error: null };
    });

    await expect(drainOutbox()).resolves.toEqual({
      sent: 0,
      failed: 0,
      skipped: 1,
    });

    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.createTransport).not.toHaveBeenCalled();
  });
});
