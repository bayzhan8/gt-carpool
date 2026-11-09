import "server-only";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type RideDirection = "airport" | "campus";
export type RideStatus = "active" | "cancelled";
export type RideAudience = "anyone" | "men" | "women";

export type RideMix = {
  men: number;
  women: number;
};

export type RidePlaceCard = {
  slug: string;
  short_name: string;
};

export type RideCard = {
  id: string;
  departs_at: string;
  audience: RideAudience;
  mix?: RideMix;
  origin: RidePlaceCard;
  destination: RidePlaceCard;
  seats: number;
  seats_left: number;
  owner_name?: string;
  is_member?: boolean;
};

export type MyRide = RideCard & {
  status: RideStatus;
  is_past: boolean;
  is_owner: boolean;
};

export type RideMemberSummary = {
  name: string;
  is_owner: boolean;
};

export type RideContact = {
  name: string;
  first_name: string;
  last_name: string;
  phone: string;
  venmo: string | null;
  email: string;
  is_owner: boolean;
  is_viewer: boolean;
};

export type RideDetail = {
  id: string;
  departs_at: string;
  audience: RideAudience;
  viewer_can_join_audience?: boolean;
  mix?: RideMix;
  status: RideStatus;
  is_past: boolean;
  seats: number;
  seats_left: number;
  origin: RidePlaceCard & { name: string; address: string };
  destination: RidePlaceCard & { name: string; address: string };
  notes?: string;
  viewer_is_member?: boolean;
  viewer_is_owner?: boolean;
  members?: RideMemberSummary[] | RideContact[];
};

function asArray<T>(value: Json): T[] {
  return Array.isArray(value) ? (value as unknown as T[]) : [];
}

export async function listRides(
  direction: RideDirection,
  day: string | null,
): Promise<RideCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_rides", {
    p_direction: direction,
    p_day: day ?? undefined,
  });

  if (error) {
    throw new Error(error.message);
  }

  return asArray<RideCard>(data);
}

export async function getRide(id: string): Promise<RideDetail | null> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_ride", {
    p_ride_id: id,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data === null ? null : (data as unknown as RideDetail);
}

export async function myRides(): Promise<MyRide[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_rides");

  if (error) {
    throw new Error(error.message);
  }

  return asArray<MyRide>(data);
}

export async function findSimilarRides(
  origin: string,
  destination: string,
  departsAt: string,
): Promise<RideCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_similar_rides", {
    p_origin: origin,
    p_destination: destination,
    p_departs_at: departsAt,
  });

  if (error) {
    throw new Error(error.message);
  }

  return asArray<RideCard>(data);
}
