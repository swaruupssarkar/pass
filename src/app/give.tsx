import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/pass/icon';
import { usePass } from '@/pass/store';
import { C } from '@/pass/theme';
import { Btn, BottomNav, PhotoTile, Screen, t } from '@/pass/ui';

export default function Give() {
  const router = useRouter();
  const { startPost } = usePass();

  const post = () => {
    startPost();
    router.push('/post');
  };

  return (
    <Screen>
      <View style={{ flex: 1, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={t.h2}>Give away</Text>
          <Pressable onPress={() => router.navigate('/feed')} hitSlop={8}>
            <Icon name="close" size={22} color={C.muted} />
          </Pressable>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <PhotoTile tint={C.accentSoft} caption="giving a box" gap={24} style={{ width: 150, height: 150, borderRadius: 40, borderCurve: 'continuous' }} />
          <Text style={[t.h1, { marginTop: 26, textAlign: 'center', maxWidth: 280, lineHeight: 30 }]}>Got something to give?</Text>
          <Text style={[t.muted, { fontSize: 14.5, marginTop: 12, textAlign: 'center', maxWidth: 290, lineHeight: 22 }]}>
            Post it in under a minute. A neighbour will love it — and you keep it out of a landfill.
          </Text>
        </View>

        <Btn label="Post an item" onPress={post} block />
        <View style={{ flexDirection: 'row', gap: 11, marginTop: 11 }}>
          <Btn label="My listings" variant="outline" onPress={() => router.push('/manage')} style={{ flex: 1, paddingVertical: 13 }} textStyle={{ fontSize: 14 }} />
          <Btn label="My impact" variant="outline" onPress={() => router.push('/impact')} style={{ flex: 1, paddingVertical: 13 }} textStyle={{ fontSize: 14 }} />
        </View>
      </View>
      <BottomNav active="give" />
    </Screen>
  );
}
