export const DEMO_EMAIL_DOMAIN = "carpool-demo.gatech.edu";

export function isDemoEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}
