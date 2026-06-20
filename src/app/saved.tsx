import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '@/pass/icon';
import { distLabel, myRequests, savedListings, usePass } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { BottomNav, Btn, FreeTag, PhotoTile, Screen, shadow, t } from '@/pass/ui';

export default function Saved() {
  const router = useRouter();
  const { s, openListing, toggleSave, openThreadFor, cancelRequest, showConfirm } = usePass();
  const [tab, setTab] = useState<'saved' | 'requested'>('saved');
  const saved = savedListings(s);
  const requested = myRequests(s);

  const open = (id: string) => {
    openListing(id);
    router.push('/detail');
  };
  const chat = (listingId: string) => {
    openThreadFor(listingId);
    router.push('/thread');
  };
  const cancel = (requestId: string, title?: string) => {
    showConfirm({
      title: 'Cancel request?',
      message: title ? `Withdraw your request for “${title}”?` : 'Withdraw this request?',
      confirmLabel: 'Cancel request',
      destructive: true,
      onConfirm: () => cancelRequest(requestId),
    });
  };

  return (
    <Screen>
      <View style={{ paddingHorizontal: 18, paddingTop: 6 }}>
        <Text style={[t.h2, { marginBottom: 12 }]}>Saved</Text>
        {/* tabs */}
        <View style={{ flexDirection: 'row', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: radius.md, padding: 4, gap: 4 }}>
          {(['saved', 'requested'] as const).map((k) => {
            const on = tab === k;
            const n = k === 'saved' ? saved.length : requested.length;
            return (
              <Pressable key={k} onPress={() => setTab(k)} style={{ flex: 1, paddingVertical: 9, borderRadius: 11, backgroundColor: on ? C.accent : 'transparent', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: on ? '#fff' : C.ink }}>
                  {k === 'saved' ? 'Saved' : 'Requested'} {n > 0 ? `· ${n}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 24, gap: 13, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {tab === 'saved' ? (
          saved.length === 0 ? (
            <Empty
              icon="heart-outline"
              title="Nothing saved yet"
              body="Tap the heart on any item to keep it here."
              cta="Browse free items"
              onPress={() => router.navigate('/feed')}
            />
          ) : (
            saved.map((it) => (
              <Pressable key={it.id} onPress={() => open(it.id)} style={{ flexDirection: 'row', gap: 13, alignItems: 'center', backgroundColor: C.surface, borderRadius: radius.xl, borderCurve: 'continuous', padding: 11, ...shadow(8, 20, 0.4) }}>
                <PhotoTile tint={it.tint} uri={it.photos?.[0]} style={{ width: 76, height: 76, borderRadius: radius.md }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }} numberOfLines={1}>{it.title}</Text>
                  <Text style={[t.small, { marginTop: 4 }]} numberOfLines={1}>{distLabel(s, it)} · {it.area}</Text>
                  <FreeTag small style={{ marginTop: 7, alignSelf: 'flex-start' }} />
                </View>
                <Pressable onPress={() => toggleSave(it.id)} hitSlop={8}>
                  <Icon name="heart" size={22} color={C.accent} />
                </Pressable>
              </Pressable>
            ))
          )
        ) : requested.length === 0 ? (
          <Empty
            icon="time"
            title="No requests yet"
            body="Tap “I want this” on an item to request it. It shows up here with its status."
            cta="Browse free items"
            onPress={() => router.navigate('/feed')}
          />
        ) : (
          requested.map(({ request, listing }) => (
            <View key={request.id} style={{ backgroundColor: C.surface, borderRadius: radius.xl, borderCurve: 'continuous', padding: 11, ...shadow(8, 20, 0.4) }}>
              <Pressable disabled={!listing} onPress={() => listing && open(listing.id)} style={{ flexDirection: 'row', gap: 13, alignItems: 'center' }}>
                <PhotoTile tint={listing?.tint ?? C.bg} uri={listing?.photos?.[0]} style={{ width: 64, height: 64, borderRadius: radius.md }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }} numberOfLines={1}>{listing ? listing.title : 'Listing removed'}</Text>
                  <Text style={[t.small, { marginTop: 4 }]} numberOfLines={1}>{request.note}</Text>
                </View>
                <StatusBadge status={request.status} />
              </Pressable>
              {request.status === 'accepted' && listing ? (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 11 }}>
                  <Btn icon="chat" label="Chat" onPress={() => chat(listing.id)} style={{ flex: 1, paddingVertical: 11 }} textStyle={{ fontSize: 14 }} />
                  <Btn label="Cancel" variant="outline" onPress={() => cancel(request.id, listing?.title)} style={{ paddingVertical: 11, borderColor: C.dangerBorder }} textStyle={{ fontSize: 14, color: C.dangerInk }} />
                </View>
              ) : request.status === 'pending' ? (
                <Btn icon="close" label="Cancel request" variant="outline" onPress={() => cancel(request.id, listing?.title)} block style={{ marginTop: 11, paddingVertical: 11, borderColor: C.dangerBorder }} textStyle={{ fontSize: 14, color: C.dangerInk }} />
              ) : (
                <Btn icon="trash" label="Remove" variant="outline" onPress={() => cancelRequest(request.id)} block style={{ marginTop: 11, paddingVertical: 11 }} textStyle={{ fontSize: 14, color: C.muted }} />
              )}
            </View>
          ))
        )}
      </ScrollView>

      <BottomNav active="saved" />
    </Screen>
  );
}

function StatusBadge({ status }: { status: 'pending' | 'accepted' | 'declined' }) {
  const map =
    {
      pending: { label: 'Pending', bg: C.pendingBg, fg: C.pendingInk },
      accepted: { label: 'Accepted', bg: '#E4F0E9', fg: C.free },
      declined: { label: 'Declined', bg: C.bg, fg: C.muted },
    }[status] ?? { label: 'Pending', bg: C.pendingBg, fg: C.pendingInk };
  return (
    <View style={{ backgroundColor: map.bg, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: map.fg }}>{map.label}</Text>
    </View>
  );
}

function Empty({ icon, title, body, cta, onPress }: { icon: 'heart-outline' | 'time'; title: string; body: string; cta: string; onPress: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={34} color={C.accent} />
      </View>
      <Text style={[t.h3, { marginTop: 18 }]}>{title}</Text>
      <Text style={[t.small, { marginTop: 8, textAlign: 'center', maxWidth: 280 }]}>{body}</Text>
      <Btn label={cta} onPress={onPress} style={{ marginTop: 18, paddingVertical: 12, paddingHorizontal: 22 }} textStyle={{ fontSize: 14 }} />
    </View>
  );
}
