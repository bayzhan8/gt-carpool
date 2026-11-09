import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";

type QueryOutcome =
  { success: true } | { success: false; code?: string; message: string };

function getDatabaseUrl(): string {
  const configuredUrl = process.env.DB_URL?.trim();

  if (configuredUrl) {
    return configuredUrl;
  }

  let output: string;

  try {
    output = execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error(
      "DB_URL is unset and `supabase status -o env` could not provide it",
    );
  }

  const line = output
    .split(/\r?\n/)
    .find((entry) => entry.startsWith("DB_URL="));
  const rawValue = line?.slice("DB_URL=".length).trim();

  if (!rawValue) {
    throw new Error(
      "DB_URL is unset and missing from `supabase status -o env`",
    );
  }

  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    return JSON.parse(rawValue) as string;
  }

  if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
    return rawValue.slice(1, -1);
  }

  return rawValue;
}

const pool = new Pool({ connectionString: getDatabaseUrl(), max: 12 });
const fixtureUserIds: string[] = [];

async function createProfile(): Promise<string> {
  const id = randomUUID();
  const email = `race-${id}@gatech.edu`;
  fixtureUserIds.push(id);

  await pool.query(
    `insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
     values ($1, 'authenticated', 'authenticated', $2, '', now())`,
    [id, email],
  );
  await pool.query(
    `insert into public.profiles (id, email, first_name, last_name, phone)
     values ($1, $2, 'Race', 'Tester', '+14045550123')`,
    [id, email],
  );

  return id;
}

async function queryAsUser(
  userId: string,
  query: string,
  values: unknown[],
): Promise<QueryOutcome> {
  const client: PoolClient = await pool.connect();

  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    await client.query(query, values);
    await client.query("commit");
    return { success: true };
  } catch (error) {
    await client.query("rollback");
    const databaseError = error as Error & { code?: string };
    return {
      success: false,
      code: databaseError.code,
      message: databaseError.message,
    };
  } finally {
    client.release();
  }
}

afterEach(async () => {
  if (fixtureUserIds.length > 0) {
    await pool.query("delete from auth.users where id = any($1::uuid[])", [
      fixtureUserIds,
    ]);
    fixtureUserIds.length = 0;
  }
});

afterAll(async () => {
  await pool.end();
});

describe("database concurrency invariants", () => {
  it("allows exactly one of eight concurrent joins into the last seat", async () => {
    const ownerId = await createProfile();
    const joinerIds = await Promise.all(
      Array.from({ length: 8 }, () => createProfile()),
    );
    const rideResult = await pool.query<{ id: string }>(
      `insert into public.rides (owner_id, origin, destination, departs_at, seats)
       values ($1, 'gt', 'atl-domestic', now() + interval '1 day', 2)
       returning id`,
      [ownerId],
    );
    const rideId = rideResult.rows[0].id;

    await pool.query(
      "insert into public.ride_members (ride_id, user_id) values ($1, $2)",
      [rideId, ownerId],
    );

    const outcomes = await Promise.all(
      joinerIds.map((userId) =>
        queryAsUser(userId, "select public.join_ride($1::uuid)", [rideId]),
      ),
    );
    const successes = outcomes.filter((outcome) => outcome.success);
    const failures = outcomes.filter(
      (outcome): outcome is Extract<QueryOutcome, { success: false }> =>
        !outcome.success,
    );
    const members = await pool.query<{ count: string; seats: number }>(
      `select count(rm.user_id)::text as count, r.seats
       from public.rides as r
       join public.ride_members as rm on rm.ride_id = r.id
       where r.id = $1
       group by r.id, r.seats`,
      [rideId],
    );

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(7);
    expect(failures.map((failure) => [failure.code, failure.message])).toEqual(
      Array.from({ length: 7 }, () => ["P0001", "ride_full"]),
    );
    expect(Number(members.rows[0].count)).toBe(members.rows[0].seats);
  });

  it("serializes create limits for six concurrent calls with three rides already owned", async () => {
    const ownerId = await createProfile();
    const departsAt = new Date(Date.now() + 60 * 60 * 1000);

    for (let index = 0; index < 3; index += 1) {
      const rideResult = await pool.query<{ id: string }>(
        `insert into public.rides (owner_id, origin, destination, departs_at, seats)
         values ($1, 'gt', 'atl-domestic', $2, 4)
         returning id`,
        [ownerId, new Date(departsAt.getTime() + index * 60 * 60 * 1000)],
      );
      await pool.query(
        "insert into public.ride_members (ride_id, user_id) values ($1, $2)",
        [rideResult.rows[0].id, ownerId],
      );
    }

    const outcomes = await Promise.all(
      Array.from({ length: 6 }, () =>
        queryAsUser(
          ownerId,
          `select public.create_ride(
             $1::text, $2::text, $3::timestamptz, $4::integer, $5::text
           )`,
          ["gt", "atl-domestic", departsAt.toISOString(), 4, ""],
        ),
      ),
    );
    const successes = outcomes.filter((outcome) => outcome.success);
    const failures = outcomes.filter(
      (outcome): outcome is Extract<QueryOutcome, { success: false }> =>
        !outcome.success,
    );
    const ownedRides = await pool.query<{ count: string; memberships: string }>(
      `select count(*)::text as count,
              count(*) filter (
                where exists (
                  select 1 from public.ride_members as rm
                  where rm.ride_id = r.id and rm.user_id = r.owner_id
                )
              )::text as memberships
       from public.rides as r
       where r.owner_id = $1
         and r.status = 'active'
         and r.departs_at > now()`,
      [ownerId],
    );

    expect(successes).toHaveLength(2);
    expect(failures).toHaveLength(4);
    expect(failures.map((failure) => [failure.code, failure.message])).toEqual(
      Array.from({ length: 4 }, () => ["P0001", "too_many_rides"]),
    );
    expect(ownedRides.rows[0].count).toBe("5");
    expect(ownedRides.rows[0].memberships).toBe("5");
  });
});
