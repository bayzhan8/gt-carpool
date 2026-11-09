import { buildIcs } from "@/lib/ics";
import { getRide } from "@/lib/rides";

type CalendarRouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: Request,
  { params }: CalendarRouteProps,
): Promise<Response> {
  const { id } = await params;
  const ride = await getRide(id);

  if (!ride) {
    return new Response(null, { status: 404 });
  }

  const url = new URL(`/rides/${ride.id}`, request.url).href;
  const calendar = buildIcs({
    uid: `${ride.id}@gt-carpool`,
    start: ride.departs_at,
    minutes: 30,
    summary: `Carpool: ${ride.origin.short_name} → ${ride.destination.short_name}`,
    location: ride.origin.address,
    description: url,
    url,
  });

  return new Response(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ride.ics"',
    },
  });
}
