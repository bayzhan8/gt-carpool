import type { RideAudience, RideMix } from "@/lib/rides";

export function audienceLabel(audience: RideAudience): string {
  if (audience === "men") return "Men only";
  if (audience === "women") return "Women only";
  return "Anyone";
}

export function audienceBadgeClass(audience: RideAudience): string {
  if (audience === "women") return "border-pink-200 bg-pink-50 text-pink-800";
  if (audience === "men") return "border-sky-200 bg-sky-50 text-sky-800";
  return "border-hairline";
}

export function audienceCardClass(audience: RideAudience): string {
  if (audience === "women") return "border-pink-200 bg-pink-50/50";
  if (audience === "men") return "border-sky-200 bg-sky-50/50";
  return "border-hairline";
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
