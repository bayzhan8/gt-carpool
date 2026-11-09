import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const SUPABASE_API = "https://api.supabase.com/v1";
const VERCEL_API = "https://api.vercel.com";
const RESEND_API = "https://api.resend.com";
const PROJECT_NAME = "gt-carpool";
const SUPABASE_HEALTH_SERVICES = "auth,db,rest";

type Json = Record<string, unknown>;
type Fetcher = typeof fetch;
type CommandResult = { stdout: string; stderr: string };
type CommandRunner = (
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
) => Promise<CommandResult>;

export type DeployEnv = Partial<NodeJS.ProcessEnv> & {
  DOMAIN?: string;
  SUPABASE_ACCESS_TOKEN?: string;
  SUPABASE_DB_PASSWORD?: string;
  SUPABASE_ORG_ID?: string;
  SUPABASE_REGION?: string;
  VERCEL_TOKEN?: string;
  RESEND_API_KEY?: string;
};

type SupabaseOrganization = { id: string; slug: string; name: string };
type SupabaseProject = { name: string; ref: string; status?: string };
type ResendDomain = {
  id: string;
  name: string;
  status: string;
  records?: unknown[];
};
type VercelProject = { id: string; name: string };
type VercelEnv = {
  id?: string;
  key: string;
  value?: string;
  target?: string[];
};

export function redact(value: unknown, secrets: string[] = []): string {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  let output = text ?? String(value);

  for (const secret of secrets.filter(Boolean)) {
    output = output.replaceAll(secret, "[REDACTED]");
  }

  return output
    .replace(/(Bearer\s+)[^\s"'`]+/gi, "$1[REDACTED]")
    .replace(
      /("(?:api_key|db_pass|password|smtp_pass|secret|token|value)"\s*:\s*")[^"]*(")/gi,
      "$1[REDACTED]$2",
    );
}

export function requireDeploymentTokens(env: DeployEnv): void {
  const missing = [
    ["SUPABASE_ACCESS_TOKEN", env.SUPABASE_ACCESS_TOKEN],
    ["VERCEL_TOKEN", env.VERCEL_TOKEN],
    ["RESEND_API_KEY", env.RESEND_API_KEY],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Missing required deployment token(s): ${missing.join(", ")}`,
    );
  }
}

export function selectOrganization(
  organizations: SupabaseOrganization[],
  organizationId?: string,
): SupabaseOrganization {
  if (organizationId) {
    const organization = organizations.find(({ id }) => id === organizationId);
    if (!organization) {
      throw new Error(`Supabase organization ${organizationId} was not found.`);
    }
    return organization;
  }

  if (organizations.length !== 1) {
    throw new Error(
      `SUPABASE_ORG_ID is required when the token can access ${organizations.length} organizations.`,
    );
  }
  return organizations[0];
}

export function planSupabaseProject(
  projects: SupabaseProject[],
  organizations: SupabaseOrganization[],
  options: {
    dbPassword: string;
    organizationId?: string;
    region: string;
  },
):
  | { action: "reuse"; project: SupabaseProject }
  | {
      action: "create";
      body: {
        name: string;
        db_pass: string;
        organization_slug: string;
        region: string;
      };
    } {
  const existing = projects.find(({ name }) => name === PROJECT_NAME);
  if (existing) return { action: "reuse", project: existing };

  const organization = selectOrganization(
    organizations,
    options.organizationId,
  );
  return {
    action: "create",
    body: {
      name: PROJECT_NAME,
      db_pass: options.dbPassword,
      organization_slug: organization.slug,
      region: options.region,
    },
  };
}

export function planResendDomain(
  domains: ResendDomain[],
  domainName: string,
):
  | { action: "create" }
  | { action: "verified"; domain: ResendDomain }
  | {
      action: "verify";
      domain: ResendDomain;
    } {
  const existing = domains.find(
    ({ name }) => name.toLowerCase() === domainName.toLowerCase(),
  );
  if (!existing) return { action: "create" };
  if (existing.status === "verified") {
    return { action: "verified", domain: existing };
  }
  return { action: "verify", domain: existing };
}

export function planVercelProject(
  projects: VercelProject[],
): { action: "create" } | { action: "reuse"; project: VercelProject } {
  const existing = projects.find(({ name }) => name === PROJECT_NAME);
  return existing
    ? { action: "reuse", project: existing }
    : { action: "create" };
}

export function planVercelEnvironment(
  existing: VercelEnv[],
  values: Record<string, string>,
  generatedCronSecret: string,
): {
  variables: Array<{
    key: string;
    value: string;
    type: "encrypted";
    target: ["production"];
  }>;
  cronSecret: string;
} {
  const existingCronSecret = existing.find(
    ({ key, target }) =>
      key === "CRON_SECRET" && target?.includes("production"),
  )?.value;
  const cronSecret = existingCronSecret || generatedCronSecret;
  const nextValues = { ...values, CRON_SECRET: cronSecret };

  return {
    variables: Object.entries(nextValues)
      .filter(([key]) => key !== "CRON_SECRET" || !existingCronSecret)
      .map(([key, value]) => ({
        key,
        value,
        type: "encrypted",
        target: ["production"] as ["production"],
      })),
    cronSecret,
  };
}

export function assertAuthConfig(
  actual: Json,
  expected: {
    siteUrl: string;
    redirectUrls: string[];
    smtpFrom: string;
    magicLinkTemplate: string;
    confirmationTemplate: string;
  },
): void {
  const actualRedirects = String(actual.uri_allow_list ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const mismatches: string[] = [];

  if (actual.site_url !== expected.siteUrl) mismatches.push("site_url");
  if (
    expected.redirectUrls.some((url) => !actualRedirects.includes(url)) ||
    actualRedirects.length !== expected.redirectUrls.length
  ) {
    mismatches.push("uri_allow_list");
  }
  if (actual.disable_signup !== false) mismatches.push("disable_signup");
  if (actual.external_email_enabled !== true) {
    mismatches.push("external_email_enabled");
  }
  if (actual.mailer_otp_length !== 6) mismatches.push("mailer_otp_length");
  if (actual.mailer_otp_exp !== 600) mismatches.push("mailer_otp_exp");
  if (actual.smtp_host !== "smtp.resend.com") mismatches.push("smtp_host");
  if (String(actual.smtp_port) !== "465") mismatches.push("smtp_port");
  if (actual.smtp_user !== "resend") mismatches.push("smtp_user");
  if (actual.smtp_admin_email !== expected.smtpFrom) {
    mismatches.push("smtp_admin_email");
  }
  if (actual.smtp_sender_name !== "GT Carpool") {
    mismatches.push("smtp_sender_name");
  }
  if (actual.rate_limit_email_sent !== 30) {
    mismatches.push("rate_limit_email_sent");
  }
  if (actual.smtp_max_frequency !== 30) {
    mismatches.push("smtp_max_frequency");
  }
  if (actual.mailer_subjects_magic_link !== "Your GT Carpool code") {
    mismatches.push("mailer_subjects_magic_link");
  }
  if (actual.mailer_subjects_confirmation !== "Your GT Carpool code") {
    mismatches.push("mailer_subjects_confirmation");
  }
  if (
    actual.mailer_templates_magic_link_content !== expected.magicLinkTemplate
  ) {
    mismatches.push("mailer_templates_magic_link_content");
  }
  if (
    actual.mailer_templates_confirmation_content !==
    expected.confirmationTemplate
  ) {
    mismatches.push("mailer_templates_confirmation_content");
  }
  if (actual.hook_before_user_created_enabled !== true) {
    mismatches.push("hook_before_user_created_enabled");
  }
  if (
    actual.hook_before_user_created_uri !==
    "pg-functions://postgres/public/hook_before_user_created"
  ) {
    mismatches.push("hook_before_user_created_uri");
  }

  if (mismatches.length > 0) {
    throw new Error(
      `Supabase auth config read-back mismatch: ${mismatches.join(", ")}`,
    );
  }
}

function must<T>(value: T | undefined | null, message: string): T {
  if (value === undefined || value === null) throw new Error(message);
  return value;
}

async function requestJson<T>(
  fetcher: Fetcher,
  url: string,
  token: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetcher(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  });
  if (!response.ok) {
    throw new Error(
      `${options.method ?? "GET"} ${url} failed (${response.status}).`,
    );
  }
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

async function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<CommandResult> {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else {
        const safeStderr = redact(stderr, [
          env.SUPABASE_ACCESS_TOKEN ?? "",
          env.SUPABASE_DB_PASSWORD ?? "",
          env.VERCEL_TOKEN ?? "",
          env.RESEND_API_KEY ?? "",
        ]);
        reject(new Error(`${command} exited with code ${code}: ${safeStderr}`));
      }
    });
  });
  return { stdout, stderr };
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

type Dependencies = {
  fetcher?: Fetcher;
  commandRunner?: CommandRunner;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
};

async function runSupabaseCli(
  args: string[],
  token: string,
  environment: Record<string, string>,
  runner: CommandRunner,
): Promise<CommandResult> {
  const env = {
    ...process.env,
    SUPABASE_ACCESS_TOKEN: token,
    SUPABASE_ENV: "production",
    ...environment,
  };
  const result = await runner(
    "npx",
    ["--no-install", "supabase", ...args],
    env,
  );
  return result;
}

export async function ensureSupabaseProject(
  env: DeployEnv,
  fetcher: Fetcher,
  log: (message: string) => void,
  sleep: (ms: number) => Promise<void>,
): Promise<{ ref: string; dbPassword: string }> {
  const token = must(
    env.SUPABASE_ACCESS_TOKEN,
    "SUPABASE_ACCESS_TOKEN is required.",
  );
  // Supabase Management API: https://supabase.com/docs/reference/api/v1-list-all-projects
  const projects = await requestJson<SupabaseProject[]>(
    fetcher,
    `${SUPABASE_API}/projects`,
    token,
  );

  let project = projects.find(({ name }) => name === PROJECT_NAME);
  let dbPassword = env.SUPABASE_DB_PASSWORD;
  let generatedPassword = false;
  if (!project) {
    if (!dbPassword) {
      dbPassword = randomBytes(24).toString("base64url");
      generatedPassword = true;
    }

    // Supabase Management API: https://supabase.com/docs/reference/api/v1-list-all-organizations
    const organizations = await requestJson<SupabaseOrganization[]>(
      fetcher,
      `${SUPABASE_API}/organizations`,
      token,
    );
    const plan = planSupabaseProject(projects, organizations, {
      dbPassword,
      organizationId: env.SUPABASE_ORG_ID,
      region: env.SUPABASE_REGION || "us-east-1",
    });
    if (plan.action === "reuse") {
      project = plan.project;
    } else {
      // Supabase Management API: https://supabase.com/docs/reference/api/v1-create-a-project
      project = await requestJson<SupabaseProject & { ref: string }>(
        fetcher,
        `${SUPABASE_API}/projects`,
        token,
        { method: "POST", body: plan.body },
      );
    }
  }

  if (!dbPassword) {
    throw new Error(
      "SUPABASE_DB_PASSWORD is required for an existing project so migrations can be pushed.",
    );
  }
  if (generatedPassword) {
    log(`Generated Supabase DB password (save it now): ${dbPassword}`);
  }

  // Supabase Management API: https://supabase.com/docs/reference/api/v1-get-services-health
  const healthUrl = `${SUPABASE_API}/projects/${project.ref}/health?services=${SUPABASE_HEALTH_SERVICES}`;
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const services = await requestJson<Array<{ healthy: boolean }>>(
      fetcher,
      healthUrl,
      token,
    );
    if (services.length > 0 && services.every(({ healthy }) => healthy)) {
      return { ref: project.ref, dbPassword };
    }
    await sleep(5000);
  }
  throw new Error(
    `Supabase project ${project.ref} did not become healthy in 10 minutes.`,
  );
}

async function configureSupabaseAuth(
  env: DeployEnv,
  ref: string,
  siteUrl: string,
  smtpFrom: string,
  dbPassword: string,
  dependencies: Required<
    Pick<Dependencies, "fetcher" | "commandRunner" | "log">
  >,
): Promise<void> {
  const accessToken = must(
    env.SUPABASE_ACCESS_TOKEN,
    "SUPABASE_ACCESS_TOKEN is required.",
  );
  const cliEnv = {
    SUPABASE_PROJECT_REF: ref,
    SUPABASE_SITE_URL: siteUrl,
    SUPABASE_REDIRECT_WILDCARD: `${siteUrl}/**`,
    SUPABASE_DB_PASSWORD: dbPassword,
    SMTP_FROM_ADDRESS: smtpFrom,
  };

  // Supabase CLI config push docs: https://supabase.com/docs/reference/cli/supabase-config
  await runSupabaseCli(
    ["config", "push", `--remote=${ref}`, "--yes"],
    accessToken,
    cliEnv,
    dependencies.commandRunner,
  );

  // Supabase Management API: https://supabase.com/docs/reference/api/v1-get-auth-service-config
  const actual = await requestJson<Json>(
    dependencies.fetcher,
    `${SUPABASE_API}/projects/${ref}/config/auth`,
    accessToken,
  );
  assertAuthConfig(actual, {
    siteUrl,
    redirectUrls: [siteUrl, `${siteUrl}/**`],
    smtpFrom,
    magicLinkTemplate: await readFile(
      "supabase/templates/magic_link.html",
      "utf8",
    ),
    confirmationTemplate: await readFile(
      "supabase/templates/confirmation.html",
      "utf8",
    ),
  });
  dependencies.log("Supabase auth config read-back matched.");
}

export async function ensureResendDomain(
  domainName: string,
  token: string,
  fetcher: Fetcher,
  sleep: (ms: number) => Promise<void>,
  log: (message: string) => void,
): Promise<void> {
  // Resend Domains API: https://resend.com/docs/api-reference/domains/list-domains
  const response = await requestJson<{ data: ResendDomain[] }>(
    fetcher,
    `${RESEND_API}/domains`,
    token,
  );
  const plan = planResendDomain(response.data, domainName);
  if (plan.action === "verified") {
    log(`Resend domain ${domainName} is already verified.`);
    return;
  }

  let domain: ResendDomain;
  if (plan.action === "create") {
    // Resend Domains API: https://resend.com/docs/api-reference/domains/create-domain
    domain = await requestJson<ResendDomain>(
      fetcher,
      `${RESEND_API}/domains`,
      token,
      { method: "POST", body: { name: domainName, region: "us-east-1" } },
    );
  } else {
    domain = plan.domain;
  }

  log(
    `Add these Resend DNS records for ${domainName}:\n${JSON.stringify(domain.records ?? [], null, 2)}`,
  );
  // Resend Domains API: https://resend.com/docs/api-reference/domains/verify-domain
  await requestJson<Json>(
    fetcher,
    `${RESEND_API}/domains/${domain.id}/verify`,
    token,
    { method: "POST" },
  );

  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    // Resend Domains API: https://resend.com/docs/api-reference/domains/get-domain
    const current = await requestJson<ResendDomain>(
      fetcher,
      `${RESEND_API}/domains/${domain.id}`,
      token,
    );
    if (current.status === "verified") return;
    await sleep(10_000);
  }
  throw new Error(
    `Resend domain ${domainName} was not verified within 10 minutes.`,
  );
}

export async function ensureVercelProject(
  token: string,
  fetcher: Fetcher,
): Promise<VercelProject> {
  // Vercel project listing: https://vercel.com/docs/rest-api/projects/retrieve-a-list-of-projects
  const projects = await requestJson<VercelProject[]>(
    fetcher,
    `${VERCEL_API}/v10/projects?search=${PROJECT_NAME}&limit=100`,
    token,
  );
  const plan = planVercelProject(projects);
  let project: VercelProject;
  if (plan.action === "reuse") {
    project = plan.project;
  } else {
    // Vercel Projects API: https://vercel.com/docs/rest-api/projects/create-a-new-project
    project = await requestJson<VercelProject>(
      fetcher,
      `${VERCEL_API}/v11/projects`,
      token,
      { method: "POST", body: { name: PROJECT_NAME, framework: "nextjs" } },
    );
  }

  // Vercel Projects API: https://vercel.com/docs/rest-api/projects/update-an-existing-project
  return requestJson<VercelProject>(
    fetcher,
    `${VERCEL_API}/v9/projects/${encodeURIComponent(project.id)}`,
    token,
    { method: "PATCH", body: { framework: "nextjs", nodeVersion: "22.x" } },
  );
}

export async function configureVercelEnvironment(
  project: VercelProject,
  token: string,
  values: Record<string, string>,
  fetcher: Fetcher,
): Promise<string> {
  // Vercel environment listing: https://vercel.com/docs/rest-api/projects/retrieve-the-environment-variables-of-a-project
  const response = await requestJson<{ envs: VercelEnv[] }>(
    fetcher,
    `${VERCEL_API}/v10/projects/${encodeURIComponent(project.id)}/env?decrypt=true`,
    token,
  );
  const plan = planVercelEnvironment(
    response.envs ?? [],
    values,
    randomBytes(32).toString("base64url"),
  );
  if (plan.variables.length > 0) {
    // Vercel Projects API: https://vercel.com/docs/rest-api/sdk/projects/create-one-or-more-environment-variables
    await requestJson<Json>(
      fetcher,
      `${VERCEL_API}/v10/projects/${encodeURIComponent(project.id)}/env?upsert=true`,
      token,
      { method: "POST", body: plan.variables },
    );
  }
  return plan.cronSecret;
}

async function configureVercelDomain(
  project: VercelProject,
  domain: string,
  token: string,
  fetcher: Fetcher,
  log: (message: string) => void,
): Promise<void> {
  // Vercel project domain listing: https://vercel.com/docs/rest-api/projects/retrieve-project-domains-by-project-by-id-or-name
  const response = await requestJson<{ domains: Array<{ name: string }> }>(
    fetcher,
    `${VERCEL_API}/v9/projects/${encodeURIComponent(project.id)}/domains?limit=100`,
    token,
  );
  if (response.domains?.some(({ name }) => name === domain)) {
    log(`Vercel domain ${domain} is already attached.`);
    return;
  }

  // Vercel Projects API: https://vercel.com/docs/rest-api/projects/add-a-domain-to-a-project
  const added = await requestJson<Json>(
    fetcher,
    `${VERCEL_API}/v10/projects/${encodeURIComponent(project.id)}/domains`,
    token,
    { method: "POST", body: { name: domain } },
  );
  log(`Vercel domain DNS details:\n${JSON.stringify(added, null, 2)}`);
}

function makeDryRunPlan(env: DeployEnv): Json[] {
  const domain = env.DOMAIN ?? null;
  return [
    {
      step: "Supabase project",
      method: "GET",
      url: `${SUPABASE_API}/projects`,
    },
    {
      step: "Supabase project if absent",
      method: "POST",
      url: `${SUPABASE_API}/projects`,
      body: {
        name: PROJECT_NAME,
        db_pass: "[REDACTED: generated or supplied]",
        organization_slug: "[selected from organization list]",
        region: env.SUPABASE_REGION || "us-east-1",
      },
    },
    {
      step: "Supabase organizations if creating",
      method: "GET",
      url: `${SUPABASE_API}/organizations`,
    },
    {
      step: "Supabase project health",
      method: "GET",
      url: `${SUPABASE_API}/projects/{ref}/health?services=${SUPABASE_HEALTH_SERVICES}`,
    },
    {
      step: "Supabase link",
      command: "npx --no-install supabase link --project-ref {ref} --yes",
    },
    {
      step: "Supabase migrations",
      command:
        "npx --no-install supabase db push --remote={ref} --password [REDACTED] --yes",
    },
    {
      step: "Supabase auth configuration",
      command: "npx --no-install supabase config push --remote={ref} --yes",
      settings: {
        site_url: env.DOMAIN
          ? `https://${env.DOMAIN}`
          : `https://${PROJECT_NAME}.vercel.app`,
        additional_redirect_urls: [
          env.DOMAIN
            ? `https://${env.DOMAIN}`
            : `https://${PROJECT_NAME}.vercel.app`,
          env.DOMAIN
            ? `https://${env.DOMAIN}/**`
            : `https://${PROJECT_NAME}.vercel.app/**`,
        ],
        enable_signup: true,
        otp_length: 6,
        otp_expiry_seconds: 600,
        smtp_host: "smtp.resend.com",
        smtp_port: 465,
        smtp_user: "resend",
        smtp_password: "[REDACTED]",
        smtp_sender_name: "GT Carpool",
        before_user_created_hook:
          "pg-functions://postgres/public/hook_before_user_created",
      },
    },
    {
      step: "Supabase auth read-back",
      method: "GET",
      url: `${SUPABASE_API}/projects/{ref}/config/auth`,
    },
    {
      step: "Supabase API keys",
      method: "GET",
      url: `${SUPABASE_API}/projects/{ref}/api-keys?reveal=true`,
    },
    {
      step: "Supabase publishable API key if missing",
      method: "POST",
      url: `${SUPABASE_API}/projects/{ref}/api-keys`,
      body: { type: "publishable", name: "default" },
    },
    {
      step: "Supabase secret API key if missing",
      method: "POST",
      url: `${SUPABASE_API}/projects/{ref}/api-keys`,
      body: {
        type: "secret",
        name: "default",
        secret_jwt_template: { role: "service_role" },
      },
    },
    {
      step: "Supabase API key read-back if created",
      method: "GET",
      url: `${SUPABASE_API}/projects/{ref}/api-keys?reveal=true`,
    },
    ...(domain
      ? [
          {
            step: "Resend domains",
            method: "GET",
            url: `${RESEND_API}/domains`,
          },
          {
            step: "Resend create if absent",
            method: "POST",
            url: `${RESEND_API}/domains`,
            body: { name: domain, region: "us-east-1" },
          },
          {
            step: "Resend verify if unverified",
            method: "POST",
            url: `${RESEND_API}/domains/{id}/verify`,
          },
          {
            step: "Resend status polling if needed",
            method: "GET",
            url: `${RESEND_API}/domains/{id}`,
          },
        ]
      : []),
    {
      step: "Vercel projects",
      method: "GET",
      url: `${VERCEL_API}/v10/projects?search=${PROJECT_NAME}&limit=100`,
    },
    {
      step: "Vercel create if absent",
      method: "POST",
      url: `${VERCEL_API}/v11/projects`,
      body: { name: PROJECT_NAME, framework: "nextjs" },
    },
    {
      step: "Vercel framework and Node 22",
      method: "PATCH",
      url: `${VERCEL_API}/v9/projects/{id}`,
      body: { framework: "nextjs", nodeVersion: "22.x" },
    },
    {
      step: "Vercel env read",
      method: "GET",
      url: `${VERCEL_API}/v10/projects/{id}/env?decrypt=true`,
    },
    {
      step: "Vercel production env upsert",
      method: "POST",
      url: `${VERCEL_API}/v10/projects/{id}/env?upsert=true`,
      body: {
        keys: [
          "NEXT_PUBLIC_SUPABASE_URL",
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
          "SUPABASE_SECRET_KEY",
          "SMTP_HOST",
          "SMTP_PORT",
          "SMTP_USER",
          "SMTP_PASS",
          "SMTP_FROM",
          "REPORTS_EMAIL",
          "NEXT_PUBLIC_SITE_URL",
          "CRON_SECRET",
        ],
        values: "[REDACTED]",
      },
    },
    ...(domain
      ? [
          {
            step: "Vercel domains",
            method: "GET",
            url: `${VERCEL_API}/v9/projects/{id}/domains?limit=100`,
          },
          {
            step: "Vercel add domain if absent",
            method: "POST",
            url: `${VERCEL_API}/v10/projects/{id}/domains`,
            body: { name: domain },
          },
        ]
      : []),
    {
      step: "Supabase auth final URL reapply",
      command: "npx --no-install supabase config push --remote={ref} --yes",
      settings: {
        site_url: "[final production URL]",
        additional_redirect_urls: [
          "[final production URL]",
          "[final production URL]/**",
        ],
      },
    },
    {
      step: "Production deploy",
      command: "npx --yes vercel deploy --prod --project gt-carpool",
    },
    {
      step: "Production root and headers",
      method: "GET",
      url: "[production URL]/",
    },
    {
      step: "Production invalid ride",
      method: "GET",
      url: "[production URL]/rides/not-a-uuid",
    },
    {
      step: "Production cron without bearer",
      method: "GET",
      url: "[production URL]/api/cron/notifications",
    },
    {
      step: "Production cron with bearer",
      method: "GET",
      url: "[production URL]/api/cron/notifications",
    },
    {
      step: "GoTrue hook smoke check",
      method: "POST",
      url: "https://{ref}.supabase.co/auth/v1/signup",
    },
  ];
}

export async function deploy(
  env: DeployEnv,
  options: { dryRun?: boolean } = {},
  dependencies: Dependencies = {},
): Promise<void> {
  const log = dependencies.log ?? console.log;
  requireDeploymentTokens(env);

  if (options.dryRun) {
    const plan = makeDryRunPlan(env);
    if (!env.DOMAIN) {
      plan.unshift({
        warning:
          "Without DOMAIN, Resend only delivers to the account owner's address until a domain is verified.",
      });
    }
    log(
      redact(plan, [
        env.SUPABASE_ACCESS_TOKEN ?? "",
        env.VERCEL_TOKEN ?? "",
        env.RESEND_API_KEY ?? "",
        env.SUPABASE_DB_PASSWORD ?? "",
      ]),
    );
    return;
  }

  const fetcher = dependencies.fetcher ?? fetch;
  const commandRunner = dependencies.commandRunner ?? runCommand;
  const sleep = dependencies.sleep ?? defaultSleep;
  const resendKey = must(
    env.RESEND_API_KEY,
    "RESEND_API_KEY is required before email setup.",
  );
  const accessToken = must(
    env.SUPABASE_ACCESS_TOKEN,
    "SUPABASE_ACCESS_TOKEN is required.",
  );
  const vercelToken = must(env.VERCEL_TOKEN, "VERCEL_TOKEN is required.");

  const { ref, dbPassword } = await ensureSupabaseProject(
    env,
    fetcher,
    log,
    sleep,
  );
  // Supabase CLI link docs: https://supabase.com/docs/reference/cli/supabase-link
  await runSupabaseCli(
    ["link", "--project-ref", ref, "--yes"],
    accessToken,
    { SUPABASE_DB_PASSWORD: dbPassword },
    commandRunner,
  );
  // Supabase CLI db push docs: https://supabase.com/docs/reference/cli/supabase-db-push
  await runSupabaseCli(
    ["db", "push", `--remote=${ref}`, "--password", dbPassword, "--yes"],
    accessToken,
    { SUPABASE_DB_PASSWORD: dbPassword },
    commandRunner,
  );

  // Resend SMTP docs: https://resend.com/docs/send-with-smtp
  const fromAddress = env.DOMAIN
    ? `rides@${env.DOMAIN}`
    : "onboarding@resend.dev";
  const smtpFrom = `GT Carpool <${fromAddress}>`;
  if (env.DOMAIN) {
    await ensureResendDomain(env.DOMAIN, resendKey, fetcher, sleep, log);
  } else {
    log(
      "WARNING: without DOMAIN, Resend only delivers to the account owner's address until a domain is verified.",
    );
  }

  const initialSiteUrl = env.DOMAIN
    ? `https://${env.DOMAIN}`
    : `https://${PROJECT_NAME}.vercel.app`;
  await configureSupabaseAuth(
    env,
    ref,
    initialSiteUrl,
    fromAddress,
    dbPassword,
    { fetcher, commandRunner, log },
  );

  // Supabase Management API: https://supabase.com/docs/reference/api/v1-get-project-api-keys
  const apiKeys = await requestJson<Array<{ type: string; api_key: string }>>(
    fetcher,
    `${SUPABASE_API}/projects/${ref}/api-keys?reveal=true`,
    accessToken,
  );
  let publishableKey = apiKeys.find(
    ({ type }) => type === "publishable",
  )?.api_key;
  let secretKey = apiKeys.find(({ type }) => type === "secret")?.api_key;

  if (!publishableKey) {
    // Supabase Management API: https://supabase.com/docs/reference/api/v1-create-project-api-key
    await requestJson<Json>(
      fetcher,
      `${SUPABASE_API}/projects/${ref}/api-keys`,
      accessToken,
      { method: "POST", body: { type: "publishable", name: "default" } },
    );
  }
  if (!secretKey) {
    // Supabase Management API: https://supabase.com/docs/reference/api/v1-create-project-api-key
    await requestJson<Json>(
      fetcher,
      `${SUPABASE_API}/projects/${ref}/api-keys`,
      accessToken,
      {
        method: "POST",
        body: {
          type: "secret",
          name: "default",
          secret_jwt_template: { role: "service_role" },
        },
      },
    );
  }
  if (!publishableKey || !secretKey) {
    // Supabase Management API: https://supabase.com/docs/reference/api/v1-get-project-api-keys
    const refreshed = await requestJson<
      Array<{ type: string; api_key: string }>
    >(
      fetcher,
      `${SUPABASE_API}/projects/${ref}/api-keys?reveal=true`,
      accessToken,
    );
    publishableKey = refreshed.find(
      ({ type }) => type === "publishable",
    )?.api_key;
    secretKey = refreshed.find(({ type }) => type === "secret")?.api_key;
  }
  publishableKey = must(
    publishableKey,
    "Supabase publishable key was not returned.",
  );
  secretKey = must(secretKey, "Supabase secret key was not returned.");

  const vercelProject = await ensureVercelProject(vercelToken, fetcher);
  const provisionalUrl = initialSiteUrl;
  // Resend SMTP docs: https://resend.com/docs/send-with-smtp
  const vercelValues = {
    NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_SECRET_KEY: secretKey,
    SMTP_HOST: "smtp.resend.com",
    SMTP_PORT: "465",
    SMTP_USER: "resend",
    SMTP_PASS: resendKey,
    SMTP_FROM: smtpFrom,
    ...(env.REPORTS_EMAIL ? { REPORTS_EMAIL: env.REPORTS_EMAIL } : {}),
    NEXT_PUBLIC_SITE_URL: provisionalUrl,
  };
  let cronSecret = await configureVercelEnvironment(
    vercelProject,
    vercelToken,
    vercelValues,
    fetcher,
  );
  if (env.DOMAIN) {
    await configureVercelDomain(
      vercelProject,
      env.DOMAIN,
      vercelToken,
      fetcher,
      log,
    );
  }

  // Vercel CLI deployment docs: https://vercel.com/docs/cli/deploy
  // The CLI reads VERCEL_TOKEN from its environment instead of exposing it in argv.
  const deployment = await commandRunner(
    "npx",
    ["--yes", "vercel", "deploy", "--prod", "--project", PROJECT_NAME],
    { ...process.env, VERCEL_TOKEN: vercelToken },
  );
  const deploymentUrl =
    env.DOMAIN ??
    deployment.stdout
      .match(/https:\/\/[a-z0-9.-]+\.vercel\.app/i)?.[0]
      ?.replace(/\/$/, "") ??
    provisionalUrl;
  const finalUrl = `https://${deploymentUrl.replace(/^https:\/\//, "")}`;

  await configureSupabaseAuth(env, ref, finalUrl, fromAddress, dbPassword, {
    fetcher,
    commandRunner,
    log,
  });
  if (finalUrl !== provisionalUrl) {
    cronSecret = await configureVercelEnvironment(
      vercelProject,
      vercelToken,
      { ...vercelValues, NEXT_PUBLIC_SITE_URL: finalUrl },
      fetcher,
    );
    await commandRunner(
      "npx",
      ["--yes", "vercel", "deploy", "--prod", "--project", PROJECT_NAME],
      { ...process.env, VERCEL_TOKEN: vercelToken },
    );
  }

  const summary: Array<[string, string]> = [
    ["Supabase project", ref],
    ["Database migrations", "pushed"],
    ["Supabase auth", "configured and read back"],
    ["Resend", env.DOMAIN ? "domain verified" : "restricted onboarding sender"],
    ["Vercel", `deployed to ${finalUrl}`],
  ];

  // Vercel security headers and deployment smoke checks use the public production URL.
  const home = await fetcher(finalUrl);
  const homeBody = await home.text();
  if (!home.ok || !homeBody.includes("GT Carpool")) {
    throw new Error("Production home smoke check failed.");
  }
  for (const header of [
    "x-frame-options",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
  ]) {
    if (!home.headers.get(header)) {
      throw new Error(`Production security header missing: ${header}`);
    }
  }
  const notFound = await fetcher(`${finalUrl}/rides/not-a-uuid`);
  if (notFound.status !== 404)
    throw new Error("Invalid ride URL did not return 404.");
  const cronNoAuth = await fetcher(`${finalUrl}/api/cron/notifications`);
  if (cronNoAuth.status !== 401)
    throw new Error("Cron endpoint did not reject an empty bearer token.");
  const cron = await fetcher(`${finalUrl}/api/cron/notifications`, {
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  if (!cron.ok)
    throw new Error("Cron endpoint rejected the configured secret.");

  // Supabase Auth API: https://supabase.com/docs/reference/auth/v1-signup
  const signup = await fetcher(`https://${ref}.supabase.co/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "x@example.com",
      password: `GT-CARPOOL-${randomBytes(16).toString("hex")}`,
    }),
  });
  const signupBody = await signup.text();
  if (
    signup.status !== 403 ||
    !signupBody.includes("Use your @gatech.edu email.")
  ) {
    throw new Error(
      "Direct GoTrue signup was not rejected by the before-user-created hook.",
    );
  }
  summary.push(["Production smoke checks", "passed"]);
  log(
    `\n${"Step".padEnd(28)}Result\n${summary.map(([step, result]) => `${step.padEnd(28)}${result}`).join("\n")}`,
  );
}

function isMain(): boolean {
  const script = process.argv[1];
  return Boolean(
    script && import.meta.url === pathToFileURL(resolve(script)).href,
  );
}

if (isMain()) {
  deploy(process.env as DeployEnv, {
    dryRun: process.argv.includes("--dry-run"),
  }).catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Deployment failed.",
    );
    process.exitCode = 1;
  });
}
