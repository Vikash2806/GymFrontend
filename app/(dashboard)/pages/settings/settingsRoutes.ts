import type { SessionPayload } from "@/redux/features/auth/sessionTypes";
import { FEATURES, hasFeature } from "@/utils/permissions";

export const SETTINGS_ROUTES = {
  profile: "/pages/settings/organisation/profile-settings",
  gym: "/pages/settings/mastersettings/gym-settings",
  subscription: "/pages/settings/mastersettings/subscription-pricing"
} as const;

export const SETTINGS_DEFAULT_ROUTE = SETTINGS_ROUTES.profile;

export function isSettingsPath(pathname: string): boolean {
  return pathname === "/pages/settings" || pathname.startsWith("/pages/settings/");
}

export function hasAnySettingsView(session: SessionPayload | null): boolean {
  return (
    hasFeature(session, FEATURES.SETTINGS) ||
    hasFeature(session, FEATURES.GYM_PROFILE) ||
    hasFeature(session, FEATURES.SUBSCRIPTION_PRICING)
  );
}

export function getFirstAccessibleSettingsRoute(session: SessionPayload | null): string | null {
  if (hasFeature(session, FEATURES.SETTINGS)) {
    return SETTINGS_ROUTES.profile;
  }
  if (hasFeature(session, FEATURES.GYM_PROFILE)) {
    return SETTINGS_ROUTES.gym;
  }
  if (hasFeature(session, FEATURES.SUBSCRIPTION_PRICING)) {
    return SETTINGS_ROUTES.subscription;
  }
  return null;
}
