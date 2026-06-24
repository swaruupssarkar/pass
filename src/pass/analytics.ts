// PostHog product analytics. One singleton client used everywhere — the
// PostHogProvider in _layout wires autocapture (touches + app lifecycle); these
// helpers add identified users, screen views, and named events. No-ops cleanly
// when unconfigured (mirrors hasSupabase / hasPlaces).

import PostHog from 'posthog-react-native';

import { hasPostHog, POSTHOG_HOST, POSTHOG_KEY } from '@/pass/config';

export const posthog: PostHog | null = hasPostHog()
  ? new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST })
  : null;

type Props = Record<string, string | number | boolean | null | undefined>;
type Person = { set?: Props; setOnce?: Props };

/** A named product event (e.g. 'listing_posted'). `person.set` writes person
 *  properties (overwrite), `person.setOnce` writes them only if unset (e.g.
 *  first_listed_at) — these power user segments and giver/taker cohorts. */
export function capture(event: string, props?: Props, person?: Person): void {
  if (!posthog) return;
  const p: Record<string, unknown> = { ...(props ?? {}) };
  if (person?.set) p.$set = person.set;
  if (person?.setOnce) p.$set_once = person.setOnce;
  posthog.capture(event, p as Record<string, never>);
}

/** Set person properties without a distinct event (overwrite / set-once). */
export function setPerson(set?: Props, setOnce?: Props): void {
  if (!posthog || (!set && !setOnce)) return;
  const p: Record<string, unknown> = {};
  if (set) p.$set = set;
  if (setOnce) p.$set_once = setOnce;
  posthog.capture('$set', p as Record<string, never>);
}

/** Tie all subsequent events to a user — required for retention/stickiness. */
export function identifyUser(id: string, props?: Props): void {
  if (id) posthog?.identify(id, props as Record<string, never> | undefined);
}

/** Clear identity on logout so the next account isn't merged into this one. */
export function resetAnalytics(): void {
  posthog?.reset();
}

/** Record a screen view ($screen) — powers "most used screens". */
export function captureScreen(name: string): void {
  posthog?.screen(name);
}
