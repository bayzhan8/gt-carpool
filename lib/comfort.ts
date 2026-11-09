import type { RideAudience, RideMix } from "@/lib/rides";

export function audienceLabel(audience: RideAudience): string {
  if (audience === "men") return "Men only";
  if (audience === "women") return "Women only";
  return "Anyone";
}

export function formatMix(mix: RideMix): string {
  const men = `${mix.men} ${mix.men === 1 ? "man" : "men"}`;
  const women = `${mix.women} ${mix.women === 1 ? "woman" : "women"}`;
  return `${women} · ${men}`;
}
