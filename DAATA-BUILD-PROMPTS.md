# Daata — Build Prompt Playbook

Every instruction you gave while building **Daata**, rewritten into clear, reusable prompts and ordered from the **start of the build to the latest**. Each step shows the **Refined prompt** (copy-ready) and, where useful, a short note of the **original** so you can see the polish.

> Tip: a good prompt names **what**, **where**, and **done-when**. The refinements below follow that shape.

---

## Phase 0 — Project foundation & design

> These predate the detailed log; reconstructed from the app as built. Use them as a template for kicking off a similar app.

**0.1 — Kick off the app**
> Build a hyperlocal "free stuff" marketplace with Expo (SDK 55), React Native, Hermes, React Compiler, and expo-router. Single global store with Context + AsyncStorage persistence. Screens: feed, categories, item detail, saved, give/post, chat, profile, settings. Coral/orange theme, rounded cards, soft shadows. Compose UI from shared primitives (Screen, Btn, Header, PhotoTile, Avatar). Support 7 Indian languages via a flat i18n dictionary.

**0.2 — Import the design**
> Import the Claude Design file (`Pass.dc.html`) and implement it as the app's screens, matching the layout, spacing, and components. Run a security + performance review of the result and fix what it finds.

**0.3 — Wire the backend (Supabase)**
> Make the app offline-first on Supabase: typed row mappers, an offline write outbox with client-generated UUID PKs (idempotent replay), Row-Level Security on every table, realtime channels for listings/messages/requests/profiles/notifications, and a `schema.sql` as the single source of truth. Degrade gracefully to local-only when Supabase isn't configured.

**0.4 — Analytics**
> Integrate PostHog to track engagement, retention, and key product events. Keep keys in EAS environment variables, not in code.

---

## Phase 1 — Chat: message deletion

**1.1 — Delete a single message (WhatsApp-style)**
> Add long-press-to-delete on a chat message. Deleting removes it for everyone: delete the message row from the database, and if the message has an image, delete that image from storage too. Reconcile the deletion live over realtime so both sides see it disappear.
>
> *Original: "people should have option to delete the single message or image like WhatsApp… delete it from server database… if the image, also deleted from the server."*

**1.2 — Make the long-press feel instant**
> The delete option currently appears a couple of seconds after I start pressing. Make it pop up *while* I'm pressing — lower the long-press delay so it triggers quickly.

**1.3 — Press feedback**
> While I'm long-pressing a message, give a light haptic tap and slightly dim/blur the message bubble so it's clear it's selected.

---

## Phase 2 — Chat: swipe to reply

**2.1 — Swipe right to quote-reply**
> Add WhatsApp-style swipe-to-reply: swiping a message to the right starts a reply that quotes it (author + text preview above the input). Send stores the quoted reference so the reply renders with the quote.
>
> *Original: "if I right swipe any message I should be able to tag that message and reply to that specific message like WhatsApp."*

**2.2 — Fix the swipe direction**
> The swipeable reply triggers on the wrong direction. Fix it so the reply action fires on a right swipe (the gesture library reports the panel side, not the finger direction — match that).

---

## Phase 3 — Requests & "My listings" manage screen

**3.1 — Redesign the Declined/Cancelled chip**
> On the requests sheet, the Declined state makes the card too tall and looks bad. Put the status as a small inline chip on the header row (like the existing choose/accept control), not as a separate block that grows the card.

**3.2 — Message from a profile should always open the chat**
> Tapping "Message" on a user's profile doesn't open the conversation. Make it always open the chat with that user, whether or not a conversation already exists.

**3.3 — Orange request time**
> Show the "requested N minutes ago" time and date in the accent orange.

---

## Phase 4 — Celebration screen

**4.1 — Redesign with the 3D gift image**
> Redesign the post-success celebration screen around the attached 3D gift illustration. Make it feel rewarding — centered hero, headline, subtle motion.

**4.2 — Transparent image background**
> The gift image ships with a white/checkerboard background. Make the image background transparent so it sits cleanly on the screen.

---

## Phase 5 — Delete a whole conversation (per-user)

**5.1 — Per-user conversation delete**
> Let me delete an entire conversation (not single messages). It must be per-user: once I delete it, it stays gone for me even after I log out and back in, but the other person still sees the full chat. Harden against the state cache restoring it and against clock-skew reordering.
>
> *Original: "if I delete the whole conversation then log out and in I can see it again — shouldn't happen. Deleted from my side and DB, but for the other side it shouldn't be deleted."*

---

## Phase 6 — Keyboard handling

**6.1 — Keyboard must not hide inputs / no residual offset**
> Fix keyboard behavior app-wide: the keyboard must never cover a text input, and when it dismisses, the screen must return to its exact original position (no leftover gap). This app is edge-to-edge, where RN's built-in KeyboardAvoidingView is unreliable.
>
> *Resolution: adopt `react-native-keyboard-controller` (KeyboardProvider at the root; its KeyboardAvoidingView with `behavior="padding"` on every screen with inputs). Native module → needs a rebuild.*

---

## Phase 7 — Legal pages & website

**7.1 — Write the legal pages**
> Write Privacy Policy, Terms & Conditions, and Account Deletion pages that satisfy Google Play policy. Support email: support@daata.in.

**7.2 — Add a strong safety disclaimer**
> Add a clear liability section: Daata is only an aggregator/platform connecting givers and receivers; it does not guarantee user safety and is not responsible for any harm, loss, or tragedy arising from meetups or transactions between users.

**7.3 — Deliver as copy-ready content**
> Tell me exactly where this section goes, and give me the full Terms & Conditions as one ready-to-paste block with sections renumbered.

**7.4 — WordPress-ready HTML**
> Give all three pages as WordPress Gutenberg-compatible HTML with correct H1/H2/H3 heading structure so I can paste them straight in.

**7.5 — Landing page**
> Design a single responsive HTML landing page for WordPress: logo, tagline "Turn clutter into kindness", Play Store link (`https://play.google.com/store/apps/details?id=app.daata`), and an Account Deletion link. Must look good on mobile and tablet.

---

## Phase 8 — Login polish

**8.1 — Legal footer on login**
> Add a footer on the login screen: "By continuing you agree to our Terms and Privacy Policy", linking to `https://daata.in/terms-conditions/` and `https://daata.in/privacy-policy/`. Keep it at the bottom, clean, not cluttered. Pin it outside the keyboard-avoiding area so the keyboard never covers it.

**8.2 — City images & layout**
> Use the city landmark images I added for the city picker; show only the city name (no landmark caption). Also, the "Don't have an account? Sign up" link sits too low and visually mixes with the terms text — move it up so they're clearly separate.

---

## Phase 9 — App Store Optimization (ASO)

**9.1 — Meta tags**
> Give me the meta title and description text for the website home page.

**9.2 — Full keyword & competitor research**
> Do full ASO research for a free/giveaway hyperlocal app: trending keywords (use Google Trends), main competitors (Olio, Trash Nothing, Snag), and write the Play Store title + description and the website title + description. We're launching India-only.

---

## Phase 10 — Account & password management

**10.1 — Account section in Settings**
> Add an Account section under Settings showing the user's email and a "Change password" option. Changing password first verifies the current password, then sets the new one. Persist the change to Supabase so logging out and back in with the new password works.

**10.2 — Forgot password (OTP)**
> On the change-password flow, add "Forgot password?": email an OTP, verify it, then let the user set a new password without the old one.

---

## Phase 11 — Notifications

**11.1 — Toggle behavior (clarify + implement)**
> The "New items near me" and "Chat & request updates" toggles should each control both the in-app notification *and* the mobile push. When a toggle is ON, the user gets both; when OFF, neither in-app nor push for that category.

**11.2 — Admin broadcast must still work; don't block the OS**
> Confirm that an admin dashboard broadcast still reaches users who have the relevant toggle ON, and that these in-app toggles never revoke the OS-level notification permission.

**11.3 — Add request push**
> Add push notifications for requests: notify the item owner when someone requests, and notify the requester when it's accepted — both gated by the chat/request toggle.

---

## Phase 12 — Chat safety, product card & location sharing

**12.1 — Dismissible safety strip**
> Add a close (✕) on the chat safety warning ("never share OTP", "it's free means free") so users can dismiss it. After a logout → login, the warning should appear again.

**12.2 — Request-aware product card**
> The product card at the top of a chat shouldn't show after the owner declines or the requester cancels. If the user then requests a different item, show that new item instead. Rule: only show the card for the latest request when it's pending or accepted.

**12.3 — Gated location sharing**
> The "Share current location" option should appear only after the owner accepts the request — then both people can share. Once the item is marked taken, remove the share-location option from the chat.

---

## Phase 13 — Category images

**13.1 — Category hero images**
> Use the category images I added in `Downloads/category` for the categories. Map each image to its category and show it in the category-browse tiles (home category row + categories screen rail and banner). Keep per-listing placeholders as icons.

---

## Phase 14 — Animation

**14.1 — Animate the Give-away page**
> The Give-away page looks static. Animate it: float the 3D gift hero, stagger the entrance of the headline/subtitle/benefit card, and give the primary CTA a gentle motion. (Not the posting form — the Give landing screen.)

**14.2 — Keep the posting form calm**
> On the Post-an-item form, keep the subtitle entrance and the photo add/remove animation, but remove the bouncy staggered section entrances and the pulsing CTA — it's too much there.

**14.3 — Fix the benefit-icon animation**
> The benefit icons (Help someone in need / Make a positive impact / Be the first to give) animate badly. Replace the springy pop with something subtle — fade the card in as one unit and give each icon a small, slow, staggered float.

---

## Phase 15 — Release & infrastructure

**15.1 — Push to GitHub (with a secret scan)**
> Commit and push everything to GitHub. Before pushing, scan the diff for secrets and never commit `.env` or any `*-firebase-adminsdk-*.json` service-account key.

**15.2 — Diagnose & fix push delivery**
> In-app notifications arrive but push doesn't. Diagnose the Android push pipeline end-to-end and fix it.
>
> *Resolution: the FCM V1 (Google Service Account) key wasn't uploaded to Expo — upload it via the EAS CLI, then confirm an Expo push receipt flips from `InvalidCredentials` to `ok`.*

**15.3 — Build the preview APK**
> Build a standalone preview APK on EAS (internal distribution) so I can install and test it outside Expo Go. Don't start any build without asking me first.

**15.4 — Audit, then build the production AAB**
> Before building, run a full pre-release audit: typecheck, expo-doctor, confirm the production EAS environment has the Supabase/Places/analytics variables, secret-scan, and remove any unused sensitive permissions. Then build the production Android App Bundle (AAB) for the Play Store.
>
> *Found & fixed: removed unused `RECORD_AUDIO`; aligned Expo patch versions; verified env + credentials.*

---

## Reusable prompt template for this project

```
<Area/screen>: <what to change>.
Behavior: <exact expected behavior, incl. edge cases>.
Persistence/sync: <DB/storage/realtime/per-user expectations>.
Constraints: <don't rename pass/usePass; keyboard via keyboard-controller;
             tokens from theme.ts; i18n in all 7 languages; route writes via outbox>.
Done when: <acceptance criteria, e.g. tsc clean + behavior on the dev build>.
Build: don't run any EAS build without asking me first.
```

**Standing rules I expect you to always follow**
- Verify with `npx tsc --noEmit` (0 errors) after every change.
- Never start an EAS build without explicit approval.
- Secret-scan before every push; never commit `.env` or Firebase admin keys.
- Don't rename `src/pass/`, `@/pass/*`, `usePass`, or `PassProvider` (internal names; brand is "Daata").
- Add new i18n keys to all 7 languages.
