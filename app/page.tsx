import Link from "next/link";
import { connection } from "next/server";
import { listRides, type RideDirection } from "@/lib/rides";
import { atlantaDateKey, formatDayHeader, next14Days } from "@/lib/time";
import { RideCard } from "./rides/ride-card";

type HomeProps = {
  searchParams: Promise<{
    dir?: string | string[];
    day?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function validDay(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? null
    : value;
}

export default async function Home({ searchParams }: HomeProps) {
  await connection();
  const params = await searchParams;
  const rawDirection = firstValue(params.dir);
  const direction: RideDirection =
    rawDirection === "campus" ? "campus" : "airport";
  const day = validDay(firstValue(params.day));
  const rides = await listRides(direction, day);
  const groups = new Map<string, typeof rides>();

  for (const ride of rides) {
    const key = atlantaDateKey(ride.departs_at);
    groups.set(key, [...(groups.get(key) ?? []), ride]);
  }

  const days = next14Days();

  return (
    <section className="pb-24 sm:pb-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rides</h1>
          <p className="mt-2 text-sm text-muted">
            Find or share a ride to the airport.
          </p>
        </div>
        <Link
          className="hidden min-h-11 items-center rounded-[10px] bg-primary px-4 text-sm font-medium text-white sm:inline-flex"
          href="/rides/new"
        >
          Post a ride
        </Link>
      </div>

      <nav
        aria-label="Ride direction"
        className="mt-6 grid grid-cols-2 rounded-[10px] bg-surface p-1"
      >
        {(["airport", "campus"] as const).map((value) => {
          const href = `/?dir=${value}${day ? `&day=${day}` : ""}`;
          return (
            <Link
              aria-current={direction === value ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center rounded-[8px] text-sm font-medium ${
                direction === value ? "bg-white shadow-sm" : "text-muted"
              }`}
              href={href}
              key={value}
            >
              {value === "airport" ? "To the airport" : "To campus"}
            </Link>
          );
        })}
      </nav>

      <nav
        aria-label="Departure day"
        className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-2"
      >
        <Link
          aria-current={day === null ? "date" : undefined}
          className={`flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm ${
            day === null
              ? "border-primary bg-primary text-white"
              : "border-hairline"
          }`}
          href={`/?dir=${direction}`}
        >
          Any day
        </Link>
        {days.map((date) => (
          <Link
            aria-current={day === date ? "date" : undefined}
            className={`flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm ${
              day === date
                ? "border-primary bg-primary text-white"
                : "border-hairline"
            }`}
            href={`/?dir=${direction}&day=${date}`}
            key={date}
          >
            {formatDayHeader(`${date}T17:00:00.000Z`)}
          </Link>
        ))}
      </nav>

      {rides.length === 0 ? (
        <div className="mt-8 rounded-[12px] border border-hairline p-6 text-center">
          <p className="font-medium">
            No rides yet. Post one and others can join.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-7">
          {Array.from(groups, ([date, dayRides]) => (
            <section
              aria-label={formatDayHeader(`${date}T17:00:00.000Z`)}
              key={date}
            >
              <h2 className="mb-3 text-sm font-semibold text-muted">
                {formatDayHeader(`${date}T17:00:00.000Z`)}
              </h2>
              <div className="space-y-3">
                {dayRides.map((ride) => (
                  <RideCard key={ride.id} ride={ride} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Link
        className="fixed inset-x-4 bottom-4 z-10 flex min-h-11 items-center justify-center rounded-[10px] bg-primary px-4 font-medium text-white sm:static sm:mt-6 sm:hidden"
        href="/rides/new"
      >
        Post a ride
      </Link>
    </section>
  );
}
