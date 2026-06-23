# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

**Daata** — an Expo SDK 55 / React Native (React 19, Hermes, React Compiler enabled) hyperlocal "free stuff" marketplace. Folder/alias names still say `pass` (the old brand); only the display name changed. Don't rename `src/pass/`, the `@/pass/*` alias, or `usePass`/`PassProvider` — internal, unrelated to the visible name.

## Commands

```bash
npm install                 # deps
npm start                   # Expo Go (expo start --go) — default dev loop
npm run start:devclient     # custom dev client (needed for native modules / real OTA)
npm run android | ios | web # open on a target
npm run lint                # expo lint (ESLint)
npx tsc --noEmit            # typecheck — THE verify gate; run after every change, expect 0 errors
npx expo prebuild --clean   # regenerate native projects (after app.json icon/splash/plugin changes)
```

No test runner is configured (no `test` script) — verification is `npx tsc --noEmit` + running the app. Native app-icon/splash changes (`app.json`) do **not** hot-reload and Expo Go can't show a custom launcher icon; they require a prebuild + rebuild. JS/asset/screen changes hot-reload.

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

**Auth** — email OTP **and** password. Sign-up: send OTP (`signInWithEmail`) → `verifyOtp` (creates session) → `setPassword` (`updateUser`). Sign-in: `signInWithPassword`. Forgot-password reuses the OTP→setPassword path. `onAuthStateChange` in the store sets `currentUserId` and does a full pull only on real sign-in; logged-out is `currentUserId === ''`.

**Realtime** — the store opens `postgres_changes` channels to reconcile listings/messages/requests/threads/profiles/notifications live.

**Data model** — `src/pass/data.ts`: `UserId` is a Supabase uuid; types for `Listing`, `Request`, `Message`, `Review`, `Handoff`, `Notification`, `Profile`. No seed data — everything is cloud-backed; `profiles` is the local cache for names/avatars (`profileOf`/`userName`/`userDp`).

**UI system** — compose from primitives, don't reinvent:
- `src/pass/theme.ts` — `C` (colors; accent is coral/orange), `radius`, `shadow()`. Use these tokens, not literals.
- `src/pass/ui.tsx` — `Screen` (safe-area via insets, not SafeAreaView, to avoid mount bounce), `Btn`, `Header`, `EmptyState`, `AnimatedIconHero`, `PhotoTile`, `Avatar`, `ReviewCard`, dialogs.
- `src/pass/icon.tsx` — semantic `IconName` → Ionicons glyph `MAP`. Add a name to both the union and the map; never hardcode raw Ionicons glyph names in screens.

**i18n** — `src/pass/i18n.ts`, one flat dict, 7 languages (en/hi/bn/mr/gu/kn/ta). Lookups are dynamic (`tr(prefix + key)`), so static dead-key detection is unreliable — when adding a key, add it to **all** languages.

**Animation** — react-native-reanimated throughout (floating heroes, falling-icon onboarding fields, shimmer text). `Math.random`/`new Date()` are fine in app code.

## Gotchas

- The splash screen (`src/app/index.tsx`) stays mounted under intro/login and auto-redirects signed-in users; that redirect is gated on `useIsFocused()` so a fresh session mid sign-up doesn't skip the create-password step. Keep the gate.
- `login.tsx` traps Android hardware-back / disables swipe while logged out (dead-end until signed in) — preserve when editing.
- Listing image lifecycle: uploaded to Supabase Storage via `expo-file-system` legacy `uploadAsync` (streamed/memory-safe); deleting a listing triggers server-side storage cleanup.
