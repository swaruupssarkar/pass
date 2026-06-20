import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { INTRO_CARDS } from '@/pass/data';
import { C, radius } from '@/pass/theme';
import { Btn, PhotoTile, Screen, t } from '@/pass/ui';

export default function Intro() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const card = INTRO_CARDS[i] ?? INTRO_CARDS[0];

  const next = () => {
    if (i < INTRO_CARDS.length - 1) setI(i + 1);
    else router.push('/location');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 28 }}>
        <View style={{ alignItems: 'flex-end' }}>
          <Pressable onPress={() => router.push('/location')} hitSlop={10} style={{ padding: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.muted }}>Skip</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <PhotoTile
            tint={card.tint}
            caption={card.img}
            gap={24}
            style={{ width: 230, height: 230, borderRadius: 36, borderCurve: 'continuous' }}
          />
          <Text style={[t.h1, { fontSize: 26, marginTop: 32, textAlign: 'center', maxWidth: 280, lineHeight: 31 }]}>
            {card.title}
          </Text>
          <Text style={[t.muted, { fontSize: 15, marginTop: 12, textAlign: 'center', maxWidth: 290, lineHeight: 23 }]}>
            {card.body}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 22 }}>
          {INTRO_CARDS.map((_, idx) => (
            <View
              key={idx}
              style={{ width: i === idx ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === idx ? C.accent : C.toggleOff }}
            />
          ))}
        </View>
        <Btn label={card.cta} onPress={next} block style={{ borderRadius: radius.lg }} />
      </View>
    </Screen>
  );
}
