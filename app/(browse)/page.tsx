import { connection } from "next/server";
import { getViewer } from "@/lib/auth";
import { listOpenPlaces, listRides } from "@/lib/rides";
import { nextDays } from "@/lib/time";
import { parseBrowseParams, type BrowseParams } from "@/lib/ride-filters";
import { Hero, HeroBanner } from "../hero";
import { RideBrowser } from "../ride-browser";

type HomeProps = {
  searchParams: Promise<BrowseParams>;
};

export default async function Home({ searchParams }: HomeProps) {
  await connection();
  const [params, viewer, airport, campus, other, openPlaces] =
    await Promise.all([
      searchParams,
      getViewer(),
      listRides("airport", null),
      listRides("campus", null),
      listRides("other", null),
      listOpenPlaces(),
    ]);
  const initial = parseBrowseParams(params);
  const gender = viewer.profile?.gender;
  const viewerAudience =
    gender === "woman" ? "women" : gender === "man" ? "men" : null;

  return (
    <>
      {viewer.user ? <HeroBanner /> : <Hero />}
      <RideBrowser
        airport={airport}
        campus={campus}
        days={nextDays(28)}
        initial={initial}
        openPlaces={openPlaces}
        other={other}
        viewerAudience={viewerAudience}
      />
    </>
  );
}
