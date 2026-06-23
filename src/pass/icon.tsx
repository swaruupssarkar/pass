// Central icon set for the `pass` app.
// One semantic name -> one Ionicons glyph, so screens never hardcode emoji or
// raw glyph names and the whole set can be re-skinned in one place.

import Ionicons from '@expo/vector-icons/Ionicons';
import { type StyleProp, type TextStyle } from 'react-native';

import { C } from '@/pass/theme';

type Glyph = keyof typeof Ionicons.glyphMap;

export type IconName =
  // navigation
  | 'home'
  | 'home-outline'
  | 'heart'
  | 'heart-outline'
  | 'chat'
  | 'chat-outline'
  | 'person'
  | 'person-outline'
  | 'add'
  | 'remove'
  // chrome / actions
  | 'back'
  | 'forward'
  | 'down'
  | 'up'
  | 'arrow-right'
  | 'close'
  | 'close-circle'
  | 'search'
  | 'list'
  | 'map'
  | 'sort'
  | 'bell'
  | 'pin'
  | 'send'
  | 'mail'
  | 'lock'
  | 'eye'
  | 'eye-off'
  | 'google'
  | 'camera'
  | 'pencil'
  | 'settings'
  | 'shield'
  | 'cart'
  | 'flag'
  | 'time'
  | 'play'
  // status / affect
  | 'check'
  | 'check-circle'
  | 'tickSent'
  | 'tickRead'
  | 'warning'
  | 'star'
  | 'star-outline'
  | 'thumbs-up'
  | 'gift'
  | 'celebrate'
  | 'clipboard'
  | 'trash'
  | 'image'
  // categories
  | 'cat-furniture'
  | 'cat-appliances'
  | 'cat-electronics'
  | 'cat-baby'
  | 'cat-books'
  | 'cat-kitchen'
  | 'cat-clothes'
  | 'cat-decor'
  | 'cat-other';

const MAP: Record<IconName, Glyph> = {
  home: 'home',
  'home-outline': 'home-outline',
  heart: 'heart',
  'heart-outline': 'heart-outline',
  chat: 'chatbubbles',
  'chat-outline': 'chatbubbles-outline',
  person: 'person',
  'person-outline': 'person-outline',
  add: 'add',
  remove: 'remove',
  back: 'chevron-back',
  forward: 'chevron-forward',
  down: 'chevron-down',
  up: 'chevron-up',
  'arrow-right': 'arrow-forward',
  close: 'close',
  'close-circle': 'close-circle',
  search: 'search',
  list: 'list',
  map: 'map-outline',
  sort: 'swap-vertical',
  bell: 'notifications-outline',
  pin: 'location-sharp',
  send: 'send',
  mail: 'mail-outline',
  lock: 'lock-closed-outline',
  eye: 'eye-outline',
  'eye-off': 'eye-off-outline',
  google: 'logo-google',
  camera: 'camera',
  pencil: 'create-outline',
  settings: 'settings-outline',
  shield: 'shield-checkmark-outline',
  cart: 'cart-outline',
  flag: 'flag',
  time: 'time-outline',
  play: 'play',
  check: 'checkmark',
  'check-circle': 'checkmark-circle',
  tickSent: 'checkmark',
  tickRead: 'checkmark-done',
  warning: 'warning',
  star: 'star',
  'star-outline': 'star-outline',
  'thumbs-up': 'thumbs-up',
  gift: 'gift',
  celebrate: 'sparkles',
  clipboard: 'reader-outline',
  trash: 'trash-outline',
  image: 'image-outline',
  'cat-furniture': 'bed-outline',
  'cat-appliances': 'snow-outline',
  'cat-electronics': 'laptop-outline',
  'cat-baby': 'balloon-outline',
  'cat-books': 'book-outline',
  'cat-kitchen': 'restaurant-outline',
  'cat-clothes': 'shirt-outline',
  'cat-decor': 'color-palette-outline',
  'cat-other': 'cube-outline',
};

const CAT_ICON: Record<string, IconName> = {
  Furniture: 'cat-furniture',
  Appliances: 'cat-appliances',
  Electronics: 'cat-electronics',
  'Baby & Kids': 'cat-baby',
  Books: 'cat-books',
  Kitchen: 'cat-kitchen',
  Clothes: 'cat-clothes',
  'Home & Decor': 'cat-decor',
  Other: 'cat-other',
};
export const catIcon = (cat: string): IconName => CAT_ICON[cat] ?? 'cat-other';

export function Icon({
  name,
  size = 20,
  color = C.ink,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Ionicons name={MAP[name]} size={size} color={color} style={style} />;
}
