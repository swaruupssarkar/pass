import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { GENDERS, type Gender } from '@/pass/data';
import { Icon } from '@/pass/icon';
import { useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { shadow } from '@/pass/ui';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NOW = new Date();
const MAX_YEAR = NOW.getFullYear() - 18; // 18+ only
const MIN_YEAR = NOW.getFullYear() - 100;
const YEARS = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MAX_YEAR - i);
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' → "5 Aug 2000" */
export function prettyDob(dob: string): string {
  const [y, m, d] = dob.split('-').map(Number);
  if (!y || !m || !d) return dob;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

type Props = {
  name: string;
  gender: Gender | null;
  dob: string | null;
  onName: (v: string) => void;
  onGender: (g: Gender) => void;
  onDob: (iso: string) => void;
};

/** Shared name + gender + date-of-birth fields. Used by onboarding (profile-setup)
 * and the Account edit screen so both stay identical. */
export function ProfileFields({ name, gender, dob, onName, onGender, onDob }: Props) {
  const tr = useT();
  const [open, setOpen] = useState(false);

  return (
    <View style={{ gap: 20 }}>
      {/* name */}
      <View>
        <Text style={label}>{tr('profile.nameLabel')}</Text>
        <TextInput
          value={name}
          onChangeText={onName}
          placeholder={tr('profile.namePlaceholder')}
          placeholderTextColor={C.muted}
          maxLength={40}
          style={input}
        />
      </View>

      {/* gender */}
      <View>
        <Text style={label}>{tr('profile.genderLabel')}</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {GENDERS.map((g) => {
            const on = gender === g;
            return (
              <Pressable
                key={g}
                onPress={() => onGender(g)}
                style={{ flex: 1, paddingVertical: 13, borderRadius: radius.lg, borderCurve: 'continuous', alignItems: 'center', backgroundColor: on ? C.accentSoft : C.surface, borderWidth: 1.5, borderColor: on ? C.accent : C.line }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: on ? C.accent : C.ink }}>{tr('gender.' + g)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* date of birth */}
      <View>
        <Text style={label}>{tr('profile.dobLabel')}</Text>
        <Pressable
          onPress={() => setOpen(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1.5, borderColor: C.line, paddingVertical: 14, paddingHorizontal: 14 }}>
          <Icon name="time" size={18} color={C.muted} />
          <Text style={{ fontSize: 15, color: dob ? C.ink : C.muted, fontWeight: dob ? '600' : '400' }}>
            {dob ? prettyDob(dob) : tr('profile.dobPlaceholder')}
          </Text>
        </Pressable>
      </View>

      <DobPicker visible={open} value={dob} onClose={() => setOpen(false)} onPick={(d) => { onDob(d); setOpen(false); }} doneLabel={tr('common.done')} title={tr('profile.dobLabel')} />
    </View>
  );
}

function DobPicker({ visible, value, onClose, onPick, doneLabel, title }: { visible: boolean; value: string | null; onClose: () => void; onPick: (iso: string) => void; doneLabel: string; title: string }) {
  const init = value ? value.split('-').map(Number) : [MAX_YEAR, 1, 1];
  const [y, setY] = useState(init[0] || MAX_YEAR);
  const [m, setM] = useState((init[1] || 1) - 1); // 0-based month
  const [d, setD] = useState(init[2] || 1);

  const days = Array.from({ length: daysIn(y, m) }, (_, i) => i + 1);
  const safeDay = Math.min(d, days.length);

  const confirm = () => onPick(`${y}-${pad(m + 1)}-${pad(safeDay)}`);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderCurve: 'continuous', paddingTop: 18, paddingBottom: 28, paddingHorizontal: 18, ...shadow(16, 40, 0.3) }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: C.ink, textAlign: 'center', marginBottom: 14 }}>{title}</Text>
          <View style={{ flexDirection: 'row', gap: 10, height: 220 }}>
            <Column items={days} value={safeDay} onPick={setD} fmt={(v) => String(v)} />
            <Column items={MONTHS.map((_, i) => i)} value={m} onPick={setM} fmt={(v) => MONTHS[v]} />
            <Column items={YEARS} value={y} onPick={setY} fmt={(v) => String(v)} />
          </View>
          <Pressable onPress={confirm} style={{ marginTop: 18, backgroundColor: C.accent, borderRadius: radius.lg, borderCurve: 'continuous', paddingVertical: 15, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{doneLabel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Column({ items, value, onPick, fmt }: { items: number[]; value: number; onPick: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, borderRadius: radius.md, borderCurve: 'continuous' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
        {items.map((it) => {
          const on = it === value;
          return (
            <Pressable key={it} onPress={() => onPick(it)} style={{ paddingVertical: 11, alignItems: 'center', backgroundColor: on ? C.accentSoft : 'transparent', borderRadius: radius.sm, marginHorizontal: 5, marginVertical: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: on ? '800' : '500', color: on ? C.accent : C.ink }}>{fmt(it)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const label = { fontSize: 13, fontWeight: '700' as const, color: C.ink, marginBottom: 9 };
const input = { backgroundColor: C.surface, borderRadius: radius.lg, borderCurve: 'continuous' as const, borderWidth: 1.5, borderColor: C.line, paddingVertical: 14, paddingHorizontal: 14, fontSize: 16, color: C.ink };
