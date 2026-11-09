export const DB_ERROR_KEYS = [
  "not_authenticated",
  "profile_required",
  "invalid_profile",
  "email_not_allowed",
  "ride_not_found",
  "ride_not_active",
  "ride_departed",
  "ride_full",
  "already_member",
  "not_member",
  "not_owner",
  "invalid_route",
  "invalid_time",
  "invalid_seats",
  "invalid_notes",
  "too_many_rides",
  "seats_below_members",
  "invalid_gender",
  "gender_locked",
  "audience_not_allowed",
  "audience_restricted",
  "audience_members_mismatch",
  "invalid_reason",
  "invalid_details",
  "already_reported",
  "report_limit",
] as const;

export type DbErrorKey = (typeof DB_ERROR_KEYS)[number];

const ERROR_COPY: Record<DbErrorKey, string> = {
  not_authenticated: "Sign in to continue.",
  profile_required: "Finish your profile first.",
  invalid_profile: "Check your profile details and try again.",
  email_not_allowed: "Use your @gatech.edu email.",
  ride_not_found: "This ride is no longer available.",
  ride_not_active: "This ride is no longer active.",
  ride_departed: "This ride has already departed.",
  ride_full: "This ride just filled up.",
  already_member: "You're already in this ride.",
  not_member: "You're not a member of this ride.",
  not_owner: "Only the ride owner can do that.",
  invalid_route: "Choose one campus location and one airport.",
  invalid_time: "Pick a time at least 15 minutes from now and within 120 days.",
  invalid_seats: "Choose between 2 and 6 seats.",
  invalid_notes: "Notes must be 280 characters or fewer.",
  too_many_rides: "You can have at most 5 upcoming rides.",
  seats_below_members: "Seats can't be fewer than the current passengers.",
  invalid_gender: "Choose Woman, Man, or Prefer not to say.",
  gender_locked:
    "You can't change this while you're in an upcoming men-only or women-only ride.",
  audience_not_allowed: "Choose anyone or your own group.",
  audience_restricted: "This ride is only open to its selected group.",
  audience_members_mismatch:
    "Every current member must match the selected group.",
  invalid_reason: "Choose a reason for this report.",
  invalid_details: "Details must be 500 characters or fewer.",
  already_reported: "You already reported this ride.",
  report_limit: "You can send up to five reports in 24 hours.",
};

const FALLBACK = "Something went wrong. Try again.";
const RATE_LIMIT_COPY = "Too many attempts. Wait a minute and try again.";

export function errorCopy(key: string): string {
  return Object.prototype.hasOwnProperty.call(ERROR_COPY, key)
    ? ERROR_COPY[key as DbErrorKey]
    : FALLBACK;
}

export function authErrorCopy(
  error: {
    status?: number;
    code?: string | null;
    message?: string;
  } | null,
): string {
  const code = error?.code?.toLowerCase();
  const message = error?.message?.toLowerCase() ?? "";

  if (
    error?.status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit"
  ) {
    return RATE_LIMIT_COPY;
  }

  if (error?.status === 403 && message.includes("gatech.edu")) {
    return "Use your @gatech.edu email.";
  }

  if (code === "otp_expired" || error?.status === 403) {
    return "That code is wrong or expired.";
  }

  return FALLBACK;
}
