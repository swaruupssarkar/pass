# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

**Daata** — an Expo SDK 55 / React Native (React 19, Hermes, React Compiler enabled) hyperlocal "free stuff" marketplace. Folder/alias names still say `pass` (the old brand); only the display name changed. Don't rename `src/pass/`, the `@/pass/*` alias, or `usePass`/`PassProvider` — internal, unrelated to the visible name.

## Commands

```bash
npm install                 # deps
npm run start:devclient     # the dev loop — Metro for the dev build (expo start)
npm run android | ios | web # open on a target
npm run lint                # expo lint (ESLint) — note: eslint may be unconfigured locally
npx tsc --noEmit            # typecheck — THE verify gate; run after every change, expect 0 errors
eas build --profile development --platform android   # build the installable dev client (APK)
npx expo prebuild --clean   # regenerate native projects (after app.json icon/splash/plugin changes)
```

**Run on the dev build, not Expo Go.** The app uses native bits Expo Go can't serve — remote push, `react-native-maps`, deep-link Google OAuth (`daata://`), `react-native-svg`. `npm start --go` will crash or silently break OAuth. Use the EAS **development** build (profiles in `eas.json`: development/preview/production; ids `app.daata`; projectId in `app.json.extra.eas`). JS/asset/screen changes hot-reload; native config (`app.json` icon/splash/plugins, new native deps) needs a rebuild.

No test runner is configured — verification is `npx tsc --noEmit` + running the dev build.

Path aliases (tsconfig): `@/*` → `src/*`, `@/assets/*` → `assets/*`.

## Architecture

**Routing** — expo-router, file-based, screens in `src/app/`. Root `_layout.tsx` wraps everything in `PassProvider`, sets a global fade transition, and sets app-wide `TextInput` defaults (autoCorrect/spellCheck off).

**Single global store** — `src/pass/store.tsx` (large, ~1.6k lines) is the heart: one React Context (`PassProvider`/`usePass`), one `State` object, all actions memoized over `[s]`, persisted to AsyncStorage (debounced) under a versioned key (`pass.state.vN` — bump on breaking state-shape changes). `useT()` returns the i18n `tr` function. Most screens are thin views over this store.

**Backend (Supabase)** — offline-first; degrades to local-only when unconfigured:
- `src/pass/config.ts` — `hasSupabase()` / `hasPlaces()`. Config comes from `EXPO_PUBLIC_*` env or `app.json` → `expo.extra` (`src/.env` is gitignored). The anon key is client-safe; access is enforced by Row-Level Security.
- `src/pass/supabase.ts` — the client (AsyncStorage session, url-polyfill, AppState auto-refresh).
- `src/pass/repo.ts` — typed `rowTo*` mappers and all read/write functions. Writes route through the outbox.
- `src/pass/outbox.ts` — generic offline write queue: try-now-else-persist, replay on app foreground. Client-generated uuid PKs make replays idempotent.
- `supabase/schema.sql` — source of truth for tables, RLS, cross-user notification triggers, security-definer RPCs (`profile_stats`, `delete_account`, `report_listing`), storage buckets/policies, realtime publication. Edit here when changing the data model.

**Auth** ([login.tsx](src/app/login.tsx) + store) — every entry verifies email by OTP first:
- **Sign-up:** email → `signInWithEmail` (OTP, `shouldCreateUser:true`) → `verifyOtp` (creates the session) → `setPassword` (create) → onboarding.
- **Sign-in:** email → OTP (`shouldCreateUser:false`) → `verifyOtp` → enter password (`signInWithPassword`). An unknown email is caught (`isNoAccount`) and routed to sign-up rather than created. A Google-only (passwordless) account auto-switches to "create a password".
- **Forgot password:** lives on the sign-in password step → `setPassword` on the already-verified session.
- **Google:** `signInWithGoogle` = in-app browser `signInWithOAuth` (PKCE) → `exchangeCodeForSession`; auto-links to the same-email account; redirect `daata://auth-callback` must be in Supabase Auth → URL Configuration.
- **Routing:** sign-up / first-time-Google → `/location` (onboarding); sign-in / returning → `/feed`. Onboarding is **per-user**: `onboarded` resets on logout and is derived from `profile.city_id` in `applyUser` (not a device-global flag). `onAuthStateChange` sets `currentUserId` and does the full pull only on real sign-in; logged-out is `currentUserId === ''`.

**Realtime** — the store opens `postgres_changes` channels to reconcile listings/messages/requests/threads/profiles/notifications live.

**Data model** — `src/pass/data.ts`: `UserId` is a Supabase uuid; types for `Listing`, `Request`, `Message`, `Review`, `Handoff`, `Notification`, `Profile`. No seed data — everything is cloud-backed; `profiles` is the local cache for names/avatars (`profileOf`/`userName`/`userDp`).

**UI system** — compose from primitives, don't reinvent:
- `src/pass/theme.ts` — `C` (colors; accent is coral/orange), `radius`, `shadow()`. Use these tokens, not literals.
- `src/pass/ui.tsx` — `Screen` (safe-area via insets, not SafeAreaView, to avoid mount bounce), `Btn`, `Header`, `EmptyState`, `AnimatedIconHero`, `PhotoTile`, `Avatar`, `ReviewCard`, dialogs.
- `src/pass/icon.tsx` — semantic `IconName` → Ionicons glyph `MAP`. Add a name to both the union and the map; never hardcode raw Ionicons glyph names in screens. (A few visuals reach past this: MaterialCommunityIcons for the teddy in the empty-state animation, and `src/pass/google-icon.tsx` for the multi-colour Google "G" via `react-native-svg`.)

**i18n** — `src/pass/i18n.ts`, one flat dict, 7 languages (en/hi/bn/mr/gu/kn/ta). Lookups are dynamic (`tr(prefix + key)`), so static dead-key detection is unreliable — when adding a key, add it to **all** languages.

**Animation** — react-native-reanimated throughout (floating heroes, falling-icon onboarding fields, shimmer text). `Math.random`/`new Date()` are fine in app code.

## Gotchas

- The splash screen (`src/app/index.tsx`) stays mounted under intro/login and auto-redirects signed-in users; that redirect is gated on `useIsFocused()` so a fresh session mid sign-up doesn't skip the create-password step. Keep the gate.
- `login.tsx` traps Android hardware-back / disables swipe while logged out (dead-end until signed in) — preserve when editing.
- Listing image lifecycle: uploaded to Supabase Storage via `expo-file-system` legacy `uploadAsync` (streamed/memory-safe); deleting a listing triggers server-side storage cleanup.
- **Pull-vs-cache invariant:** the `repo.ts` user-data fetch helpers (`fetchRequests`/`fetchThreadBundle`/etc.) **throw on Supabase error** so `pullUserData` returns `null` and `applyUser`'s `if (ud)` guard keeps the local cache (same as `fetchListings` returning null). Never "fix" a helper to swallow errors and return `[]` — a transient error would then wipe chats/requests/saves on the next sign-in.
- **Browse filter** (`browseListings`): city mode → `cityId === activeCityId`; GPS mode → within `radius` of `userLoc`. A GPS session with **no fix** falls back to the active city — it must never return the unfiltered (worldwide) list.
- Realtime message inserts are kept **`ts`-ordered** (clock skew / outbox replay can deliver out of order); keep the sort in the messages channel handler.
- **Outbox is uid-tagged + logout drains briefly then signs out (no data loss on account switch):** every optimistic write in the store must be wrapped in `track(...)` (from `outbox.ts`) — including the fire-and-forget `(async () => …)()` upload-then-upsert blocks. `logout()` sets `state.syncing` (shows the blocking `SyncOverlay`), races `drainOutbox()` against a **6s cap**, then signs out **regardless** — anything unsynced stays in the durable, uid-tagged outbox and replays on THIS user's next sign-in on this device (never under another account: `flushOutbox` skips ops whose `uid` doesn't match — RLS would deny them forever and could corrupt the other account). The old refuse-on-unsynced path is gone; the `sync.cantLogout*` i18n keys are currently unused. Logout is confirm-gated in settings/profile (`settings.logoutConfirm*`). When adding a new write, route it through `track()`. Also: in `submitPost`, persist the listing **row first** (photos stripped to remote-only), then upload + second upsert — so a quick logout can't strand the row behind a slow photo upload. `syncing` is a transient flag — keep it out of the persist whitelist.
