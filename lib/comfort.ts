import type { RideAudience, RideMix } from "@/lib/rides";

export function audienceLabel(audience: RideAudience): string {
  if (audience === "men") return "Men only";
  if (audience === "women") return "Women only";
  return "Anyone";
}

export function formatMix(mix: RideMix): string | null {
  const parts: string[] = [];
  if (mix.women > 0) {
    parts.push(`${mix.women} ${mix.women === 1 ? "woman" : "women"}`);
  }
  if (mix.men > 0) {
    parts.push(`${mix.men} ${mix.men === 1 ? "man" : "men"}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
