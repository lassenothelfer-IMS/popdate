import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { useTheme } from '@/hooks/use-theme';

/** SF Symbols on iOS, Material Symbols on Android and web. */
const ICONS = {
  add: { ios: 'plus', android: 'add', web: 'add' },
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  chat: { ios: 'bubble.left.and.bubble.right', android: 'chat_bubble', web: 'chat_bubble' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  checkCircle: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  error: { ios: 'exclamationmark.circle', android: 'error', web: 'error' },
  eye: { ios: 'eye', android: 'visibility', web: 'visibility' },
  heart: { ios: 'heart.fill', android: 'favorite', web: 'favorite' },
  hourglass: { ios: 'hourglass', android: 'hourglass_empty', web: 'hourglass_empty' },
  leave: {
    ios: 'rectangle.portrait.and.arrow.right',
    android: 'logout',
    web: 'logout',
  },
  lock: { ios: 'lock.fill', android: 'lock', web: 'lock' },
  people: { ios: 'person.2', android: 'group', web: 'group' },
  photo: { ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' },
  send: { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' },
  timer: { ios: 'timer', android: 'timer', web: 'timer' },
} as const satisfies Record<string, SymbolViewProps['name']>;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

/** A decorative icon. Put the meaning in a nearby label, not in the icon alone. */
export function Icon({ name, size = 20, color }: IconProps) {
  const theme = useTheme();
  return (
    <SymbolView
      name={ICONS[name]}
      size={size}
      tintColor={color ?? theme.text}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
