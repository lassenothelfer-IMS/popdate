import { Image } from 'expo-image';
import { useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type ImageSourcePropType, type ViewInstance } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { Avatar } from '@/components/avatar';
import { useSeats, useTheme, youSeat } from '@/hooks/use-theme';
import { useSession } from '@/state/session';

/** The tab bar's icon box, in points. */
const SIZE = 28;
/** Drawn at three pixels to the point, so it stays sharp on every iPhone. */
const SCALE = 3;
/** The ring the selected tab wears, like the other tabs' filled symbols. */
const RING = 2;
const GAP = 1.5;

type TabIcons = { default: ImageSourcePropType; selected: ImageSourcePropType };

/**
 * Your photo as the You tab's icon, round, like Hinge. The tab bar takes only a
 * finished picture, so the face is drawn once off screen as a small circle (and
 * again with a ring for the selected tab), photographed, and handed over. Until
 * then, and wherever this fails, the tab keeps its person symbol.
 *
 * `capture` must be rendered somewhere; it sits off screen and draws nothing you see.
 */
export function useYouTabIcon(): { icons: TabIcons | null; capture: ReactNode } {
  const theme = useTheme();
  const seats = useSeats();
  const { profile } = useSession();
  const uri = profile?.photos[0] ?? null;
  const plain = useRef<ViewInstance>(null);
  const ringed = useRef<ViewInstance>(null);
  const [made, setMade] = useState<{ uri: string; icons: TabIcons } | null>(null);
  /** The photo this capture is for: a new photo starts a new one. */
  const pending = useRef<string | null>(null);

  // Only iOS draws its tab icons from a picture; Android and the web have their own.
  if (Platform.OS !== 'ios' || !uri || !profile) return { icons: null, capture: null };

  async function take(forUri: string) {
    if (pending.current === forUri || made?.uri === forUri) return;
    pending.current = forUri;
    const options = { format: 'png', result: 'tmpfile', width: SIZE * SCALE, height: SIZE * SCALE } as const;
    try {
      const [plainFile, ringedFile] = await Promise.all([
        captureRef(plain, options),
        captureRef(ringed, options),
      ]);
      if (pending.current !== forUri) return;
      const source = (file: string) => ({ uri: file, width: SIZE, height: SIZE, scale: SCALE });
      setMade({ uri: forUri, icons: { default: source(plainFile), selected: source(ringedFile) } });
    } catch {
      // The symbol stays. Nothing to tell anyone: the tab still works.
      pending.current = null;
    }
  }

  const real = !uri.startsWith('mock://');
  // A test photo is drawn at once; a real one is photographed once it has loaded.
  const face = (size: number) =>
    real ? (
      <Image
        source={{ uri }}
        contentFit="cover"
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onLoad={() => void take(uri)}
      />
    ) : (
      <Avatar name={profile.name} uri={uri} tone={youSeat(seats)} size={size} />
    );

  const capture = (
    <View
      style={styles.offscreen}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={real ? undefined : () => requestAnimationFrame(() => void take(uri))}>
      <View ref={plain} collapsable={false} style={styles.disc}>
        {face(SIZE)}
      </View>
      <View ref={ringed} collapsable={false} style={[styles.disc, { borderWidth: RING, borderColor: theme.text }]}>
        {/* A hair of air between the ring and the face. */}
        {face(SIZE - 2 * RING - 2 * GAP)}
      </View>
    </View>
  );

  return { icons: made?.uri === uri ? made.icons : null, capture };
}

const styles = StyleSheet.create({
  // Laid out, so it can be photographed, but well off the screen's edge.
  offscreen: {
    position: 'absolute',
    left: -1000,
    top: 0,
    flexDirection: 'row',
  },
  disc: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
