# "New items near me" — push notifications

When a listing is posted, users with **near-me notifications on** whose saved
notify address is within **100 km** get notified — excluding the poster.

Two independent layers (both fire on a new listing):

| Layer | Mechanism | Needs setup? |
|---|---|---|
| **In-app** notification | `on_listing_created` DB trigger inserts a `notifications` row | Just run `schema.sql` |
| **Mobile push** | This edge function sends via Expo Push API, fired by a DB webhook | Firebase + deploy + rebuild |

The in-app layer works the moment the schema is applied — no Firebase, no rebuild.
The push layer needs the steps below.

## Status

- ✅ Schema applied (`push_tokens`, `km_between`, `notify_on_listing`/`on_listing_created`, `nearby_push_targets`).
- ✅ Function deployed (`supabase functions deploy notify-nearby --no-verify-jwt`) + smoke-tested (HTTP 200).
- ✅ Webhook live — `on_listing_push` trigger via **pg_net** (in `schema.sql`), no dashboard hook needed.
- ⏳ **You:** upload FCM V1 key to `eas credentials` (step 2) + rebuild (step 5).

## One-time setup for mobile push

### 1. Apply the schema — DONE
Already applied: `push_tokens`, `km_between`, `notify_on_listing` + `on_listing_created`,
`nearby_push_targets`, and the `on_listing_push` pg_net webhook.

### 2. Firebase / FCM (required for Android push)
1. Firebase console → create project → add **Android** app, package **`app.daata`**.
2. Download **`google-services.json`** → put it in the project root.
3. In `app.json`, under `expo.android`, add: `"googleServicesFile": "./google-services.json"`.
4. Firebase → Project settings → **Service accounts** → *Generate new private key* (JSON).
5. `eas credentials` → Android → **Push Notifications (FCM V1)** → upload that JSON.

(iOS push additionally needs an Apple Developer account + APNs key via `eas credentials`.)

### 3. Deploy the function
```bash
supabase functions deploy notify-nearby --no-verify-jwt
# optional shared secret the webhook must send as x-hook-secret:
supabase secrets set NOTIFY_HOOK_SECRET=<random-string>
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### 4. Create the Database Webhook
Supabase → Database → **Webhooks** → Create:
- Table: `public.listings`, Events: **Insert**
- Type: **HTTP Request** → POST → `https://<project-ref>.functions.supabase.co/notify-nearby`
- If you set `NOTIFY_HOOK_SECRET`, add header `x-hook-secret: <same value>`

### 5. Rebuild the app
`google-services.json` + the notifications module are native — rebuild the dev/preview
client and reinstall. On first launch (or when toggling near-me on) the app asks for
notification permission and registers its Expo push token in `push_tokens`.

## Test
1. Sign in on device A, set a notify address, turn **New items near me** on.
2. From device B (or another account), post a listing within 100 km of A's address.
3. A gets: **"New item near you 🎁 — <title> · <X> km away — be the first to claim it!"**
   Tapping it opens the listing.
