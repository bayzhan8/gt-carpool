import type { RideAudience, RideMix } from "@/lib/rides";

export function audienceLabel(audience: RideAudience): string {
  if (audience === "brothers") return "Brothers only";
  if (audience === "sisters") return "Sisters only";
  return "Anyone";
}

export function formatMix(mix: RideMix): string {
  const brothers = `${mix.brothers} brother${mix.brothers === 1 ? "" : "s"}`;
  const sisters = `${mix.sisters} sister${mix.sisters === 1 ? "" : "s"}`;
  return `${brothers} · ${sisters}`;
}
