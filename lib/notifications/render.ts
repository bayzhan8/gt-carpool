import { formatDayHeader, formatTime } from "../time";

export type NotificationKind =
  | "member_joined"
  | "member_left"
  | "ownership_transferred"
  | "ride_cancelled"
  | "time_changed";

export type NotificationEmailData = {
  id: number;
  kind: NotificationKind;
  actor_name: string;
  payload: Record<string, unknown>;
  attempts: number;
  recipient_email: string;
  recipient_first_name: string;
  ride: {
    id: string;
    departs_at: string;
    origin_short_name: string;
    destination_short_name: string;
  };
};

function rideRoute(notification: NotificationEmailData): string {
  return `from ${notification.ride.origin_short_name} to ${notification.ride.destination_short_name}`;
}

function rideWhen(iso: string): string {
  return `${formatDayHeader(iso)} at ${formatTime(iso)}`;
}

export function render(
  notification: NotificationEmailData,
  siteUrl: string,
): { subject: string; text: string } {
  const { actor_name: actor, kind } = notification;
  const route = rideRoute(notification);
  const link = `${siteUrl.replace(/\/$/, "")}/rides/${notification.ride.id}`;
  let subject: string;
  let sentence: string;

  switch (kind) {
    case "member_joined":
      subject = `${actor} joined your ride`;
      sentence = `${actor} joined your ride ${route} on ${rideWhen(notification.ride.departs_at)}.`;
      break;
    case "member_left":
      subject = `${actor} left your ride`;
      sentence = `${actor} left your ride ${route} on ${rideWhen(notification.ride.departs_at)}.`;
      break;
    case "ownership_transferred":
      subject = "You're now the organizer of your ride";
      sentence = `You're now the organizer of the ride ${route} (${actor} left).`;
      break;
    case "ride_cancelled":
      subject = `${actor} cancelled your ride`;
      sentence = `${actor} cancelled the ride ${route} on ${rideWhen(notification.ride.departs_at)}.`;
      break;
    case "time_changed": {
      const oldTime = notification.payload.old_departs_at;
      const newTime = notification.payload.new_departs_at;
      if (typeof oldTime !== "string" || typeof newTime !== "string") {
        throw new Error(
          "Time-change notification is missing its departure times",
        );
      }
      subject = `${actor} changed your ride time`;
      sentence = `${actor} moved the ride ${route} to ${rideWhen(newTime)} (was ${rideWhen(oldTime)}).`;
      break;
    }
  }

  return { subject, text: `${sentence}\n\n${link}` };
}
