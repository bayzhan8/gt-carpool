import { describe, expect, it, vi } from "vitest";
import {
  assertAuthConfig,
  deploy,
  ensureResendDomain,
  ensureSupabaseProject,
  ensureVercelProject,
  planResendDomain,
  planSupabaseProject,
  planVercelEnvironment,
  planVercelProject,
  redact,
  requireDeploymentTokens,
  selectOrganization,
} from "../../scripts/deploy";

const organizations = [
  { id: "org-1", slug: "gt", name: "Georgia Tech" },
  { id: "org-2", slug: "other", name: "Other" },
];

describe("deployment planning", () => {
  it("reuses an existing Supabase project or plans project creation", () => {
    expect(
      planSupabaseProject([{ name: "gt-carpool", ref: "existing-ref" }], [], {
        dbPassword: "safe-password",
        region: "us-east-1",
      }),
    ).toEqual({
      action: "reuse",
      project: { name: "gt-carpool", ref: "existing-ref" },
    });

    expect(
      planSupabaseProject([], organizations, {
        dbPassword: "safe-password",
        organizationId: "org-1",
        region: "us-east-1",
      }),
    ).toEqual({
      action: "create",
      body: {
        name: "gt-carpool",
        db_pass: "safe-password",
        organization_slug: "gt",
        region: "us-east-1",
      },
    });
  });

  it("auto-picks the only organization and requires an id when there are several", () => {
    expect(selectOrganization([organizations[0]])).toEqual(organizations[0]);
    expect(() => selectOrganization(organizations)).toThrow(
      "SUPABASE_ORG_ID is required",
    );
    expect(selectOrganization(organizations, "org-2")).toEqual(
      organizations[1],
    );
  });

  it("creates, verifies, or skips an already-verified Resend domain", () => {
    expect(planResendDomain([], "gt.example")).toEqual({ action: "create" });
    expect(
      planResendDomain(
        [{ id: "d1", name: "gt.example", status: "not_started" }],
        "gt.example",
      ),
    ).toMatchObject({ action: "verify", domain: { id: "d1" } });
    expect(
      planResendDomain(
        [{ id: "d1", name: "gt.example", status: "verified" }],
        "GT.EXAMPLE",
      ),
    ).toMatchObject({ action: "verified", domain: { id: "d1" } });
  });

  it("reuses a healthy Supabase project through the mocked Management API", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ name: "gt-carpool", ref: "existing-ref" }]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ healthy: true }]), { status: 200 }),
      );
    const result = await ensureSupabaseProject(
      {
        SUPABASE_ACCESS_TOKEN: "fake-token",
        SUPABASE_DB_PASSWORD: "saved-password",
      },
      fetcher as unknown as typeof fetch,
      vi.fn(),
      async () => {},
    );

    expect(result).toEqual({
      ref: "existing-ref",
      dbPassword: "saved-password",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://api.supabase.com/v1/projects",
    );
  });

  it("creates a Supabase project using the only visible organization", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: "org-1", slug: "gt", name: "Georgia Tech" }]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: "gt-carpool", ref: "new-ref" }), {
          status: 201,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ healthy: true }]), { status: 200 }),
      );
    const result = await ensureSupabaseProject(
      {
        SUPABASE_ACCESS_TOKEN: "fake-token",
        SUPABASE_DB_PASSWORD: "generated-in-test",
      },
      fetcher as unknown as typeof fetch,
      vi.fn(),
      async () => {},
    );

    expect(result.ref).toBe("new-ref");
    expect(JSON.parse(String(fetcher.mock.calls[2][1]?.body))).toMatchObject({
      name: "gt-carpool",
      organization_slug: "gt",
      region: "us-east-1",
    });
  });

  it("does not poll or re-verify an already-verified Resend domain", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          object: "list",
          has_more: false,
          data: [{ id: "domain-id", name: "gt.example", status: "verified" }],
        }),
        { status: 200 },
      ),
    );
    const log = vi.fn();

    await ensureResendDomain(
      "gt.example",
      "fake-resend-token",
      fetcher as unknown as typeof fetch,
      vi.fn(),
      log,
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      "Resend domain gt.example is already verified.",
    );
  });

  it("reuses a Vercel project from the documented list response", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: "project-id", name: "gt-carpool" }]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "project-id",
            name: "gt-carpool",
            framework: "nextjs",
            nodeVersion: "22.x",
          }),
          { status: 200 },
        ),
      );

    const project = await ensureVercelProject(
      "fake-vercel-token",
      fetcher as unknown as typeof fetch,
    );

    expect(project).toMatchObject({ id: "project-id", name: "gt-carpool" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://api.vercel.com/v10/projects?search=gt-carpool&limit=100",
    );
  });

  it("reuses or creates the Vercel project", () => {
    expect(planVercelProject([])).toEqual({ action: "create" });
    expect(planVercelProject([{ id: "p1", name: "gt-carpool" }])).toEqual({
      action: "reuse",
      project: { id: "p1", name: "gt-carpool" },
    });
  });

  it("keeps an existing cron secret and plans production variables", () => {
    const values = {
      SMTP_PASS: "resend-key",
      NEXT_PUBLIC_SITE_URL: "https://gt.example",
    };
    const preserved = planVercelEnvironment(
      [
        {
          key: "CRON_SECRET",
          value: "existing-cron",
          target: ["production"],
        },
      ],
      values,
      "new-cron",
    );
    expect(preserved.cronSecret).toBe("existing-cron");
    expect(preserved.variables.map(({ key }) => key)).toEqual([
      "SMTP_PASS",
      "NEXT_PUBLIC_SITE_URL",
    ]);
    expect(preserved.variables[0]).toMatchObject({
      type: "encrypted",
      target: ["production"],
    });

    const created = planVercelEnvironment([], values, "generated-cron");
    expect(created.cronSecret).toBe("generated-cron");
    expect(created.variables.map(({ key }) => key)).toContain("CRON_SECRET");

    const previewOnly = planVercelEnvironment(
      [{ key: "CRON_SECRET", value: "preview-cron", target: ["preview"] }],
      values,
      "production-cron",
    );
    expect(previewOnly.cronSecret).toBe("production-cron");
    expect(
      previewOnly.variables.find(({ key }) => key === "CRON_SECRET"),
    ).toMatchObject({
      key: "CRON_SECRET",
      value: "production-cron",
      target: ["production"],
    });
  });

  it("redacts explicit values and credential-like fields", () => {
    expect(
      redact(
        { token: "secret-token", value: "api-value", message: "secret-token" },
        ["secret-token"],
      ),
    ).not.toContain("secret-token");
    expect(redact({ value: "api-value" })).not.toContain("api-value");
  });

  it("rejects missing tokens with their names", () => {
    expect(() => requireDeploymentTokens({})).toThrow(
      "SUPABASE_ACCESS_TOKEN, VERCEL_TOKEN, RESEND_API_KEY",
    );
  });

  it("fails hard when Supabase auth config read-back differs", () => {
    const expected = {
      siteUrl: "https://gt.example",
      redirectUrls: ["https://gt.example", "https://gt.example/**"],
      smtpFrom: "rides@gt.example",
      magicLinkTemplate: "<p>{{ .Token }}</p>",
      confirmationTemplate: "<p>{{ .Token }}</p>",
    };
    expect(() =>
      assertAuthConfig(
        {
          site_url: "https://wrong.example",
          uri_allow_list: "https://wrong.example",
        },
        expected,
      ),
    ).toThrow("Supabase auth config read-back mismatch");
  });

  it("accepts a matching Supabase auth config read-back", () => {
    const expected = {
      siteUrl: "https://gt.example",
      redirectUrls: ["https://gt.example", "https://gt.example/**"],
      smtpFrom: "rides@gt.example",
      magicLinkTemplate: "<p>{{ .Token }}</p>",
      confirmationTemplate: "<p>{{ .Token }}</p>",
    };
    expect(() =>
      assertAuthConfig(
        {
          site_url: expected.siteUrl,
          uri_allow_list: expected.redirectUrls.join(","),
          disable_signup: false,
          external_email_enabled: true,
          mailer_otp_length: 6,
          mailer_otp_exp: 600,
          smtp_host: "smtp.resend.com",
          smtp_port: "465",
          smtp_user: "resend",
          smtp_admin_email: expected.smtpFrom,
          smtp_sender_name: "GT Carpool",
          rate_limit_email_sent: 30,
          smtp_max_frequency: 30,
          mailer_subjects_magic_link: "Your GT Carpool code",
          mailer_subjects_confirmation: "Your GT Carpool code",
          mailer_templates_magic_link_content: expected.magicLinkTemplate,
          mailer_templates_confirmation_content: expected.confirmationTemplate,
          hook_before_user_created_enabled: true,
          hook_before_user_created_uri:
            "pg-functions://postgres/public/hook_before_user_created",
        },
        expected,
      ),
    ).not.toThrow();
  });

  it("dry-run makes no network or command calls and redacts fake tokens", async () => {
    const fetcher = vi.fn();
    const commandRunner = vi.fn(async () => ({ stdout: "", stderr: "" }));
    const log = vi.fn();
    await deploy(
      {
        SUPABASE_ACCESS_TOKEN: "fake-supabase-token",
        VERCEL_TOKEN: "fake-vercel-token",
        RESEND_API_KEY: "fake-resend-token",
        SUPABASE_DB_PASSWORD: "fake-db-password",
        DOMAIN: "gt.example",
      },
      { dryRun: true },
      {
        fetcher: fetcher as unknown as typeof fetch,
        commandRunner,
        log,
      },
    );

    expect(fetcher).not.toHaveBeenCalled();
    expect(commandRunner).not.toHaveBeenCalled();
    const output = log.mock.calls.map(([line]) => String(line)).join("\n");
    expect(output).toContain("Supabase project");
    expect(output).toContain("Supabase publishable API key if missing");
    expect(output).toContain("Supabase secret API key if missing");
    expect(output).toContain("Resend");
    expect(output).toContain("Vercel");
    expect(output).toContain("Production cron with bearer");
    expect(output).toContain("otp_expiry_seconds");
    expect(output).not.toContain("fake-supabase-token");
    expect(output).not.toContain("fake-vercel-token");
    expect(output).not.toContain("fake-resend-token");
    expect(output).not.toContain("fake-db-password");
  });
});
