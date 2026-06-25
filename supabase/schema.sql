-- ============================================================================
-- Daata — Supabase schema (run once in the Supabase SQL Editor)
-- Tables + Row-Level Security + cross-user notification triggers + storage.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS.
-- ============================================================================

-- ---------- helper: updated_at autostamp ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ============================================================================
-- TABLES
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  city_id text,
  dp text,
  since text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  blurb text,
  cat text not null,
  cond text,
  descr text,
  city_id text not null,
  lat double precision not null,
  lng double precision not null,
  address text,
  area text,
  tint text,
  ph text,
  photos text[] default '{}',
  taken boolean default false,
  taken_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists listings_city_live_idx on public.listings (city_id) where taken = false;
create index if not exists listings_owner_idx on public.listings (owner_id);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user   uuid not null references public.profiles(id) on delete cascade,
  note text,
  status text not null default 'pending',   -- pending | accepted | declined
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (listing_id, from_user)
);

create table if not exists public.threads (
  id text primary key,                        -- 'p:<a>-<b>' sorted pair
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  starter uuid references public.profiles(id),
  accepted boolean default false,
  read_a timestamptz,
  read_b timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null references public.threads(id) on delete cascade,
  from_user uuid not null references public.profiles(id) on delete cascade,
  body text default '',
  image text,
  created_at timestamptz default now()
);
create index if not exists messages_thread_idx on public.messages (thread_id, created_at);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user   uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  tags text[] default '{}',
  body text,
  created_at timestamptz default now(),
  unique (from_user, listing_id)
);

-- handoffs: denormalized snapshot, MUST survive listing deletion (no FK cascade)
create table if not exists public.handoffs (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid,
  giver_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  photo text,
  tint text,
  cat text,
  created_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  body text,
  kind text not null,                         -- message | request | taken | item
  thread_id text references public.threads(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  route text,
  read boolean default false,
  created_at timestamptz default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, read);

create table if not exists public.saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, listing_id)
);

create table if not exists public.blocks (
  blocker uuid not null references public.profiles(id) on delete cascade,
  blocked uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker, blocked)
);

create table if not exists public.notify_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  near boolean default true,
  chat boolean default true,
  addr_lat double precision,
  addr_lng double precision,
  addr_label text,
  updated_at timestamptz default now()
);

create table if not exists public.report_counts (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  count int default 0
);

-- updated_at triggers
drop trigger if exists t_profiles_updated on public.profiles;
create trigger t_profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists t_listings_updated on public.listings;
create trigger t_listings_updated before update on public.listings for each row execute function public.touch_updated_at();
drop trigger if exists t_requests_updated on public.requests;
create trigger t_requests_updated before update on public.requests for each row execute function public.touch_updated_at();
drop trigger if exists t_threads_updated on public.threads;
create trigger t_threads_updated before update on public.threads for each row execute function public.touch_updated_at();

-- ============================================================================
-- PROFILE BOOTSTRAP: create a profiles row when a new auth user signs up
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, since)
  values (new.id, split_part(coalesce(new.email, 'user'), '@', 1), to_char(now(), 'YYYY'))
  on conflict (id) do nothing;
  insert into public.notify_prefs (user_id) values (new.id) on conflict do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- CROSS-USER NOTIFICATION TRIGGERS
-- (clients cannot insert notifications for other users under RLS; the DB does it)
-- ============================================================================
create or replace function public.notify_on_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare lt text;
begin
  select title into lt from public.listings where id = new.listing_id;
  insert into public.notifications (user_id, title, body, kind, listing_id, route)
  values (new.to_user, 'Someone wants your item', coalesce(lt,'your item'), 'request', new.listing_id, '/inbox');
  return new;
end; $$;
drop trigger if exists on_request_created on public.requests;
create trigger on_request_created after insert on public.requests
  for each row execute function public.notify_on_request();

create or replace function public.notify_on_request_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare lt text;
begin
  if new.status = old.status then return new; end if;
  select title into lt from public.listings where id = new.listing_id;
  if new.status = 'accepted' then
    insert into public.notifications (user_id, title, body, kind, listing_id, route)
    values (new.from_user, 'Request accepted', coalesce(lt,'the item'), 'request', new.listing_id, '/inbox');
  elsif new.status = 'declined' then
    insert into public.notifications (user_id, title, body, kind, listing_id, route)
    values (new.from_user, 'Request declined', coalesce(lt,'the item'), 'request', new.listing_id, '/inbox');
  end if;
  return new;
end; $$;
drop trigger if exists on_request_status on public.requests;
create trigger on_request_status after update on public.requests
  for each row execute function public.notify_on_request_status();

-- in-app message notifications are COALESCED: one row per recipient+thread, refreshed
-- with each new message (WhatsApp-style), not one row per message. Needs this index.
create unique index if not exists notifications_msg_thread_uq
  on public.notifications (user_id, thread_id) where kind = 'message';
create or replace function public.notify_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare other uuid; th record; sender text;
begin
  select * into th from public.threads where id = new.thread_id;
  if th is null then return new; end if;
  other := case when th.user_a = new.from_user then th.user_b else th.user_a end;
  select coalesce(nullif(name, ''), 'New message') into sender from public.profiles where id = new.from_user;
  insert into public.notifications (user_id, title, body, kind, thread_id, route, read, created_at)
  values (other, coalesce(sender, 'New message'),
          coalesce(nullif(new.body, ''), 'Sent a photo'), 'message', new.thread_id, '/thread', false, now())
  on conflict (user_id, thread_id) where kind = 'message'
  do update set body = excluded.body, title = excluded.title, read = false, created_at = now();
  return new;
end; $$;
drop trigger if exists on_message_created on public.messages;
create trigger on_message_created after insert on public.messages
  for each row execute function public.notify_on_message();

-- mobile push for new messages → notify-message edge function (WhatsApp-style;
-- collapses per conversation via collapseId = thread id, respects the chat toggle).
create or replace function public.push_message_webhook()
returns trigger language plpgsql security definer set search_path = public, net as $$
begin
  perform net.http_post(
    url := 'https://kugmucssfdlzsqotxvoy.supabase.co/functions/v1/notify-message',
    body := jsonb_build_object('type', 'INSERT', 'table', 'messages', 'record', to_jsonb(new)),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  return new;
end; $$;
drop trigger if exists on_message_push on public.messages;
create trigger on_message_push after insert on public.messages
  for each row execute function public.push_message_webhook();

create or replace function public.notify_on_handoff()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, title, body, kind, listing_id, route)
  values (new.recipient_id, 'You received an item', new.title, 'taken', new.listing_id, '/impact');
  return new;
end; $$;
drop trigger if exists on_handoff_created on public.handoffs;
create trigger on_handoff_created after insert on public.handoffs
  for each row execute function public.notify_on_handoff();

-- ============================================================================
-- RPC: increment report count (cross-owner write → security definer)
-- ============================================================================
create or replace function public.report_listing(p_listing uuid)
returns int language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into public.report_counts (listing_id, count) values (p_listing, 1)
  on conflict (listing_id) do update set count = public.report_counts.count + 1
  returning count into c;
  return c;
end; $$;

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================
alter table public.profiles      enable row level security;
alter table public.listings      enable row level security;
alter table public.requests      enable row level security;
alter table public.threads       enable row level security;
alter table public.messages      enable row level security;
alter table public.reviews       enable row level security;
alter table public.handoffs      enable row level security;
alter table public.notifications enable row level security;
alter table public.saves         enable row level security;
alter table public.blocks        enable row level security;
alter table public.notify_prefs  enable row level security;
alter table public.report_counts enable row level security;

-- profiles: world-readable, self-write
drop policy if exists p_sel on public.profiles;
create policy p_sel on public.profiles for select using (true);
drop policy if exists p_ins on public.profiles;
create policy p_ins on public.profiles for insert with check (id = auth.uid());
drop policy if exists p_upd on public.profiles;
create policy p_upd on public.profiles for update using (id = auth.uid());

-- listings: public read; owner-only write
drop policy if exists l_sel on public.listings;
create policy l_sel on public.listings for select using (true);
drop policy if exists l_ins on public.listings;
create policy l_ins on public.listings for insert with check (owner_id = auth.uid());
drop policy if exists l_upd on public.listings;
create policy l_upd on public.listings for update using (owner_id = auth.uid());
drop policy if exists l_del on public.listings;
create policy l_del on public.listings for delete using (owner_id = auth.uid());

-- requests: either party reads; requester inserts; either updates/deletes
drop policy if exists r_sel on public.requests;
create policy r_sel on public.requests for select using (from_user = auth.uid() or to_user = auth.uid());
drop policy if exists r_ins on public.requests;
create policy r_ins on public.requests for insert with check (from_user = auth.uid());
drop policy if exists r_upd on public.requests;
create policy r_upd on public.requests for update using (from_user = auth.uid() or to_user = auth.uid());
drop policy if exists r_del on public.requests;
create policy r_del on public.requests for delete using (from_user = auth.uid() or to_user = auth.uid());

-- threads: participants only
drop policy if exists t_sel on public.threads;
create policy t_sel on public.threads for select using (user_a = auth.uid() or user_b = auth.uid());
drop policy if exists t_ins on public.threads;
create policy t_ins on public.threads for insert with check (user_a = auth.uid() or user_b = auth.uid());
drop policy if exists t_upd on public.threads;
create policy t_upd on public.threads for update using (user_a = auth.uid() or user_b = auth.uid());

-- messages: participants of parent thread; sender-only insert
drop policy if exists m_sel on public.messages;
create policy m_sel on public.messages for select using (
  exists (select 1 from public.threads th where th.id = thread_id and (th.user_a = auth.uid() or th.user_b = auth.uid())));
drop policy if exists m_ins on public.messages;
create policy m_ins on public.messages for insert with check (
  from_user = auth.uid() and exists (select 1 from public.threads th where th.id = thread_id and (th.user_a = auth.uid() or th.user_b = auth.uid())));

-- reviews: public read, author-only write
drop policy if exists rev_sel on public.reviews;
create policy rev_sel on public.reviews for select using (true);
drop policy if exists rev_ins on public.reviews;
create policy rev_ins on public.reviews for insert with check (from_user = auth.uid());

-- handoffs: giver or recipient read; giver inserts
drop policy if exists h_sel on public.handoffs;
create policy h_sel on public.handoffs for select using (giver_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists h_ins on public.handoffs;
create policy h_ins on public.handoffs for insert with check (giver_id = auth.uid());

-- notifications: recipient only (INSERT happens via security-definer triggers)
drop policy if exists n_sel on public.notifications;
create policy n_sel on public.notifications for select using (user_id = auth.uid());
drop policy if exists n_upd on public.notifications;
create policy n_upd on public.notifications for update using (user_id = auth.uid());
drop policy if exists n_del on public.notifications;
create policy n_del on public.notifications for delete using (user_id = auth.uid());

-- saves / blocks / notify_prefs: self only
drop policy if exists s_all on public.saves;
create policy s_all on public.saves for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists b_all on public.blocks;
create policy b_all on public.blocks for all using (blocker = auth.uid()) with check (blocker = auth.uid());
drop policy if exists np_all on public.notify_prefs;
create policy np_all on public.notify_prefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- report_counts: public read (drives client-side auto-delist); writes via RPC only
drop policy if exists rc_sel on public.report_counts;
create policy rc_sel on public.report_counts for select using (true);

-- ============================================================================
-- REALTIME: add tables to the supabase_realtime publication
-- ============================================================================
alter publication supabase_realtime add table public.listings;
alter publication supabase_realtime add table public.requests;
alter publication supabase_realtime add table public.threads;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.reviews;
alter publication supabase_realtime add table public.handoffs;

-- ============================================================================
-- STORAGE: public-read buckets + owner-only write (first path segment = uid)
-- ============================================================================
insert into storage.buckets (id, name, public) values ('listing-photos','listing-photos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars','avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('chat-images','chat-images', true) on conflict (id) do nothing;

drop policy if exists st_read on storage.objects;
create policy st_read on storage.objects for select using (bucket_id in ('listing-photos','avatars','chat-images'));

drop policy if exists st_ins on storage.objects;
create policy st_ins on storage.objects for insert to authenticated with check (
  bucket_id in ('listing-photos','avatars','chat-images') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists st_upd on storage.objects;
create policy st_upd on storage.objects for update to authenticated using (
  bucket_id in ('listing-photos','avatars','chat-images') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists st_del on storage.objects;
create policy st_del on storage.objects for delete to authenticated using (
  bucket_id in ('listing-photos','avatars','chat-images') and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- ACCOUNT DELETION
-- Deletes the caller's auth.users row; FK ON DELETE CASCADE removes their
-- profile and every row referencing it (listings, requests, threads, messages,
-- reviews, handoffs, saves, blocks, notify_prefs, notifications). Storage
-- objects are wiped client-side before this is called (RLS lets a user delete
-- their own bucket folders).
-- ============================================================================
create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
end; $$;
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- ============================================================================
-- PUBLIC PROFILE STATS
-- handoffs are participant-only readable (RLS), so other users' given/received
-- counts need a security-definer aggregate that exposes only the numbers.
-- ============================================================================
create or replace function public.profile_stats(p_user uuid)
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'given', (select count(*) from public.handoffs where giver_id = p_user),
    'received', (select count(*) from public.handoffs where recipient_id = p_user)
  );
$$;
grant execute on function public.profile_stats(uuid) to authenticated;

-- ============================================================================
-- POST-LAUNCH HARDENING (applied via Management API; kept here for the record)
-- ============================================================================
-- profiles realtime so cached names/dp/city refresh across devices
alter publication supabase_realtime add table public.profiles;
-- server-side moderation: delist a listing once reports cross the threshold
alter table public.listings add column if not exists delisted boolean default false;
-- (report_listing updated to set listings.delisted = true when count >= 5)
-- (notify_on_request_status extended to notify the other party on status='cancelled')
-- storage cleanup for deleted listings is done CLIENT-SIDE via the Storage API
-- (repo.deleteListingPhotos). Supabase's platform `protect_delete` trigger now
-- BLOCKS direct `delete from storage.objects` ("Use the Storage API instead"),
-- which made this DB trigger throw and roll back EVERY listing delete (rows never
-- deleted + the delete op poisoned the offline outbox). Trigger + function removed:
drop trigger if exists on_listing_deleted on public.listings;
drop function if exists public.cleanup_listing_storage();

-- ============================================================================
-- "NEW ITEMS NEAR ME" — in-app notification + mobile-push fan-out on new listing
-- ============================================================================

-- Expo push tokens, one row per device (a user can sign in on several phones).
create table if not exists public.push_tokens (
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text,
  updated_at timestamptz default now(),
  primary key (user_id, token)
);
alter table public.push_tokens enable row level security;
drop policy if exists pt_all on public.push_tokens;
create policy pt_all on public.push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Great-circle distance (km) between two lat/lng points.
create or replace function public.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 6371 * acos(least(1, greatest(-1,
    cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1))
    + sin(radians(lat1)) * sin(radians(lat2))
  )));
$$;

-- In-app: when a listing is posted, drop a notification for everyone with "near"
-- on whose notify address is within 100 km (excluding the poster). Realtime
-- delivers it to open apps; it also shows in the notifications list.
create or replace function public.notify_on_listing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.lat is null or new.lng is null then return new; end if;
  insert into public.notifications (user_id, title, body, kind, listing_id, route)
  select np.user_id,
         'New item near you',
         coalesce(new.title, 'A free item') || ' · ' ||
           case when public.km_between(new.lat, new.lng, np.addr_lat, np.addr_lng) < 1
                then 'less than 1 km away'
                else round(public.km_between(new.lat, new.lng, np.addr_lat, np.addr_lng)::numeric, 0)::text || ' km away'
           end,
         'item', new.id, '/detail'
  from public.notify_prefs np
  where np.near = true
    and np.addr_lat is not null and np.addr_lng is not null
    and np.user_id <> new.owner_id
    and public.km_between(new.lat, new.lng, np.addr_lat, np.addr_lng) <= 100;
  return new;
end; $$;
drop trigger if exists on_listing_created on public.listings;
create trigger on_listing_created after insert on public.listings
  for each row execute function public.notify_on_listing();

-- Push fan-out target list for the edge function (service-role). Returns each
-- nearby user's distance + their device tokens, so the function can send a
-- personalised "X km away" push to every device.
create or replace function public.nearby_push_targets(p_lat double precision, p_lng double precision, p_owner uuid)
returns table(user_id uuid, distance_km double precision, tokens text[])
language sql security definer set search_path = public as $$
  select np.user_id,
         public.km_between(p_lat, p_lng, np.addr_lat, np.addr_lng) as distance_km,
         coalesce(array_agg(pt.token) filter (where pt.token is not null), '{}') as tokens
  from public.notify_prefs np
  left join public.push_tokens pt on pt.user_id = np.user_id
  where np.near = true
    and np.addr_lat is not null and np.addr_lng is not null
    and np.user_id <> p_owner
    and public.km_between(p_lat, p_lng, np.addr_lat, np.addr_lng) <= 100
  group by np.user_id, np.addr_lat, np.addr_lng;
$$;

-- Mobile push: POST each new listing to the notify-nearby edge function via
-- pg_net (async, fire-and-forget). The function fans out the Expo push. (This
-- replaces a dashboard Database Webhook — same effect, kept in code.)
create extension if not exists pg_net;
create or replace function public.push_nearby_webhook()
returns trigger language plpgsql security definer set search_path = public, net as $$
begin
  if new.lat is null or new.lng is null then return new; end if;
  perform net.http_post(
    url := 'https://kugmucssfdlzsqotxvoy.supabase.co/functions/v1/notify-nearby',
    body := jsonb_build_object('type', 'INSERT', 'table', 'listings', 'record', to_jsonb(new)),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  return new;
end; $$;
drop trigger if exists on_listing_push on public.listings;
create trigger on_listing_push after insert on public.listings
  for each row execute function public.push_nearby_webhook();
