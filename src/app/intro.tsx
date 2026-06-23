import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { INTRO_CARDS } from '@/pass/data';
import { type IconName } from '@/pass/icon';
import { useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { AnimatedIconHero, Btn, Screen, t } from '@/pass/ui';

export default function Intro() {
  const router = useRouter();
  const tr = useT();
  const { width } = useWindowDimensions();
  const heroDisc = Math.min(186, Math.round(width * 0.46)); // scale to viewport on small screens
  const [i, setI] = useState(0);
  const card = INTRO_CARDS[i] ?? INTRO_CARDS[0];

  const next = () => {
    if (i < INTRO_CARDS.length - 1) setI(i + 1);
    else router.push('/login');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 28 }}>
        <View style={{ alignItems: 'flex-end' }}>
          <Pressable onPress={() => router.push('/login')} hitSlop={10} style={{ padding: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.muted }}>{tr('intro.skip')}</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <AnimatedIconHero key={i} icon={card.icon as IconName} tint={card.tint} disc={heroDisc} iconSize={Math.round(heroDisc * 0.42)} />
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
