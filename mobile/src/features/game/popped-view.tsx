import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewInstance,
} from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Balloon } from '@/components/balloon';
import { ErrorLine } from '@/components/error-line';
import { Bob, Pulse, Stage, StageBlock, stageText, stageType } from '@/components/stage';
import { BrandBalloon, Ease } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { webSafeKeyframe } from '@/utils/web-motion';

// "Not this time", drawn to design/four-screens on the 390 x 844 stage.

/** The shreds around the popped balloon: where each lies in the top zone, its width, turn and strength. */
const SHREDS = [
  { left: 96, top: 150, width: 14, opacity: 1, rotate: -28 },
  { left: 274, top: 138, width: 16, opacity: 1, rotate: 34 },
  { left: 70, top: 214, width: 10, opacity: 0.7, rotate: 18 },
  { left: 304, top: 206, width: 12, opacity: 0.75, rotate: -16 },
  { left: 128, top: 104, width: 10, opacity: 0.6, rotate: 62 },
  { left: 246, top: 96, width: 12, opacity: 0.6, rotate: -58 },
  { left: 190, top: 82, width: 9, opacity: 0.45, rotate: 8 },
] as const;

/** Each shred drops in from 18 pt above with a fade, over 1.4 s after 300 ms. */
const shredIn = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: -18 }, { scale: 0.6 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Ease.rise },
  })
    .duration(1400)
    .delay(300),
);

/** A seat in the "Still floating" card. */
export type FloatingSeat = {
  id: string;
  name: string;
  color: string;
  popped: boolean;
};

type PoppedViewProps = {
  popperName: string;
  round: number | null;
  /** The room's five seats in seat order, yours among them. */
  seats: FloatingSeat[];
  meId: string;
  /** The round the room is in now, to watch live. Null once the game is over. */
  liveRound: number | null;
  /** True while you leave this room and join the queue. */
  replaying: boolean;
  /** The last failed call, shown above the buttons. */
  error: string | null;
  onPlayAgain: () => void;
  onWatch: () => void;
  onLeave: () => void;
};

/**
 * Not this time: your popped balloon with its shreds, who popped it, the room
 * still floating (the whole card takes you back in to watch), and the two ways
 * out. There is no back button: these three are the only exits.
 */
export function PoppedView({
  popperName,
  round,
  seats,
  meId,
  liveRound,
  replaying,
  error,
  onPlayAgain,
  onWatch,
  onLeave,
}: PoppedViewProps) {
  const theme = useTheme();
  const t = useT();
  const reduced = useReduceMotion();
  const headerRef = useRef<ViewInstance>(null);
  const line = round
    ? t('game.poppedYouInRound', { name: popperName, round })
    : t('game.poppedYou', { name: popperName });
  const next = t('game.poppedNext');
  const title = t('game.notThisTime');
  const floating = seats.filter((seat) => !seat.popped).length;
  const watch = liveRound ? t('game.watchRoundLive', { round: liveRound }) : t('game.stayWatch');

  // The room turns into this view inside one route, so the system posts no screen
  // change. Move VoiceOver to the news once it is in.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const timer = setTimeout(() => {
      if (headerRef.current) AccessibilityInfo.sendAccessibilityEvent(headerRef.current, 'focus');
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Stage>
      <StageBlock index={0} style={styles.top} pointerEvents="none">
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
          {SHREDS.map((shred, i) => (
            <Animated.View
              key={i}
              entering={reduced ? undefined : shredIn}
              style={[styles.shredPlace, { left: shred.left, top: shred.top }]}>
              <View
                style={[
                  styles.shred,
                  {
                    width: shred.width,
                    opacity: shred.opacity,
                    backgroundColor: theme.brand,
                    transform: [{ rotate: `${shred.rotate}deg` }],
                  },
                ]}
              />
            </Animated.View>
          ))}
          <View style={styles.popped}>
            <Balloon color={BrandBalloon.color} size={120} popped />
          </View>
        </View>
      </StageBlock>

      <StageBlock index={1} style={styles.copy}>
        {/* One header, so the focus lands on the whole news: who popped you, and what now. */}
        <View
          ref={headerRef}
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${title} ${line} ${next}`}
          style={styles.copyGroup}>
          <Text {...stageText} style={[stageType.serif, styles.title, { color: theme.text }]}>
            {title}
          </Text>
          <Text {...stageText} style={[stageType.sans, styles.line, { color: theme.textSecondary }]}>
            {line}
            {'\n'}
            {next}
          </Text>
        </View>
      </StageBlock>

      <StageBlock index={2} style={styles.cardPlace}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('game.stillFloating')}, ${t('game.floatingCount', { left: floating, total: seats.length })}. ${watch}`}
          disabled={replaying}
          onPress={onWatch}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: theme.field, boxShadow: `inset 0 0 0 1px ${theme.border}` },
            pressed && styles.pressed,
          ]}>
          <View style={styles.cardHead}>
            <Text {...stageText} style={[stageType.sans, styles.cardLabel, { color: theme.textSecondary }]}>
              {t('game.stillFloating')}
            </Text>
            <View style={styles.cardCount}>
              <Pulse style={[styles.liveDot, { backgroundColor: theme.success }]}>{null}</Pulse>
              <Text {...stageText} style={[stageType.sans, styles.cardCountText, { color: theme.textSecondary }]}>
                {t('game.floatingCount', { left: floating, total: seats.length })}
              </Text>
            </View>
          </View>
          <View style={styles.seats}>
            {seats.map((seat) => {
              const mine = seat.id === meId;
              const gone = mine || seat.popped;
              return (
                <View key={seat.id} style={styles.seat}>
                  {gone ? (
                    <Balloon color={seat.color} size={24} ghost />
                  ) : (
                    <Bob kind="c">
                      <Balloon color={seat.color} size={24} />
                    </Bob>
                  )}
                  <Text
                    {...stageText}
                    numberOfLines={1}
                    style={[
                      stageType.sans,
                      styles.seatName,
                      { color: gone ? theme.textSecondary : theme.textSecondary },
                      gone && styles.struck,
                      mine && styles.bold,
                    ]}>
                    {mine ? t('common.you') : seat.name}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={[styles.watch, { borderTopColor: theme.border }]}>
            <Text {...stageText} style={[stageType.sans, styles.watchText, { color: theme.brand }]}>
              {watch}
            </Text>
            <Svg width={8} height={14} viewBox="0 0 8 14" fill="none">
              <Path d="M1 1l6 6-6 6" stroke={theme.brand} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
        </Pressable>
      </StageBlock>

      <StageBlock index={3} style={styles.exits}>
        {error ? <ErrorLine message={error} /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('game.playAnother')}
          accessibilityState={{ disabled: replaying, busy: replaying }}
          disabled={replaying}
          onPress={onPlayAgain}
          style={({ pressed }) => [styles.primary, { backgroundColor: theme.text }, pressed && styles.pressed]}>
          {replaying ? (
            <ActivityIndicator size="small" color={theme.page} />
          ) : (
            <Text {...stageText} style={[stageType.sans, styles.buttonText, { color: theme.page }]}>
              {t('game.playAnother')}
            </Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('game.leaveRoom')}
          disabled={replaying}
          onPress={onLeave}
          style={({ pressed }) => [styles.plain, (pressed || replaying) && styles.dim]}>
          <Text {...stageText} style={[stageType.sans, styles.buttonText, { color: theme.text }]}>
            {t('game.leaveRoom')}
          </Text>
        </Pressable>
      </StageBlock>
    </Stage>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
  dim: {
    opacity: 0.4,
  },
  top: {
    left: 0,
    right: 0,
    top: 96,
    height: 250,
  },
  shredPlace: {
    position: 'absolute',
  },
  shred: {
    height: 5,
    borderRadius: 3,
  },
  popped: {
    position: 'absolute',
    left: 135,
    top: 34,
  },
  copy: {
    left: 20,
    right: 20,
    top: 356,
  },
  copyGroup: {
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 46,
    lineHeight: 50,
    fontWeight: 500,
    letterSpacing: -0.92,
    textAlign: 'center',
  },
  line: {
    width: 330,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  cardPlace: {
    left: 20,
    right: 20,
    top: 496,
  },
  card: {
    borderRadius: 24,
    borderCurve: 'continuous',
    paddingTop: 14,
    paddingHorizontal: 16,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: 700,
    letterSpacing: 0.72,
    textTransform: 'uppercase',
  },
  cardCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cardCountText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: 600,
  },
  seats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  seat: {
    width: 52,
    alignItems: 'center',
    gap: 6,
  },
  seatName: {
    fontSize: 12,
    lineHeight: 15,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  bold: {
    fontWeight: 700,
  },
  watch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    marginTop: 12,
    borderTopWidth: 1,
  },
  watchText: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: 600,
  },
  exits: {
    left: 20,
    right: 20,
    bottom: 34,
    gap: 4,
  },
  primary: {
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plain: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 600,
  },
});
