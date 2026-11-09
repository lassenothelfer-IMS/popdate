import { type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Ease, Fonts, MaxContentWidth, Motion, Radius, Space } from '@/constants/theme';
import { purchaseMade, useBalloons } from '@/features/balloons/use-balloons';
import { featuredIndex, packSaving, perBalloon, type Pack } from '@/features/paywall/catalog';
import { CARD_GAP, CARD_HEIGHT, CARD_WIDTH, PackCard } from '@/features/paywall/pack-card';
import {
  openPlus,
  settleShop,
  useCatalog,
  useMoney,
  type ShopResult,
} from '@/features/paywall/shop';
import { goBackOr, showNotice } from '@/features/settings/settings-ui';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { useT, type TranslationKey } from '@/i18n';
import { FEATURED_PACK } from '@/shared/balloons';
import { haptics } from '@/utils/haptics';
import { buyProduct, purchasesAvailable, restorePurchases } from '@/utils/purchases';

const STEP = CARD_WIDTH + CARD_GAP;
/** Room above the cards for the tag that sits on their top edge. */
const TAG_ROOM = 12;
/** The sheet rises 60 pt as it fades in, over 620 ms. */
const RISE = 60;
const ENTER_MS = 620;
/** A drag this far down, or a flick this fast, closes the sheet. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

const BLURBS: Record<number, TranslationKey> = {
  5: 'paywall.blurb5',
  15: 'paywall.blurb15',
  40: 'paywall.blurb40',
};

// Web has no snapToOffsets: CSS scroll snapping centers one card at a time.
const webTrack =
  Platform.OS === 'web' ? ({ scrollSnapType: 'x mandatory' } as unknown as ViewStyle) : undefined;
const webCard =
  Platform.OS === 'web' ? ({ scrollSnapAlign: 'center' } as unknown as ViewStyle) : undefined;

/**
 * "Need more balloons?": a sheet over the screen you were on, with the balloon
 * packs in a carousel that opens on the most popular one. Opens from "Get in
 * line" with no balloons left (`openBalloonShop`) and from Settings. Prices are
 * the store's; buying goes through Apple's own sheet.
 */
export function BuyBalloonsSheet() {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduced = useReduceMotion();
  const money = useMoney();
  const { count } = useBalloons();
  const [catalogState, retry] = useCatalog();
  const packs = catalogState.status === 'ready' ? catalogState.catalog.packs : [];
  const [chosen, setChosen] = useState<number | null>(null);
  const selected = chosen ?? featuredIndex(packs);
  const pack: Pack | undefined = packs[selected];
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A short phone gives up some of the air above the cards.
  const airAbove = windowHeight > 0 && windowHeight < 800 ? 24 : 54 - TAG_ROOM;

  // Shown: 0 before it opens and after it closes, 1 while open. Drag: how far it's pulled down.
  const shown = useSharedValue(0);
  const drag = useSharedValue(0);
  /** Set once it starts closing, so a second tap or drag doesn't close it twice. */
  const leaving = useSharedValue(false);

  useEffect(() => {
    shown.set(
      withTiming(1, {
        duration: reduced ? Motion.state : ENTER_MS,
        easing: Ease.rise,
      }),
    );
    // However it closes, whoever opened it hears so. A purchase has already said 'bought'.
    return () => settleShop({ outcome: 'closed' });
    // Only on open: Reduce Motion changing mid-sheet doesn't replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close(result?: ShopResult) {
    if (leaving.get()) return;
    leaving.set(true);
    if (result) settleShop(result);
    shown.set(
      withTiming(0, { duration: Motion.exit, easing: Ease.out }, (finished) => {
        if (finished) scheduleOnRN(goBackOr, '/home' as Href);
      }),
    );
  }

  const dim = useAnimatedStyle(() => ({
    opacity: shown.get() * (1 - Math.min(drag.get() / 400, 0.6)),
  }));
  const sheet = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: (reduced ? 0 : (1 - shown.get()) * RISE) + drag.get() }],
  }));

  // Pull down to close. Sideways drags belong to the carousel.
  const pull = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .failOffsetX([-12, 12])
    .onUpdate(({ translationY }) => {
      drag.set(Math.max(0, translationY));
    })
    .onEnd(({ translationY, velocityY }) => {
      if (translationY > DISMISS_DISTANCE || velocityY > DISMISS_VELOCITY) scheduleOnRN(close);
      else drag.set(withTiming(0, { duration: Motion.state, easing: Ease.out }));
    });

  async function buy() {
    if (!pack || busy) return;
    if (!purchasesAvailable) {
      showNotice(t('paywall.plusLabel'), t('paywall.notHere'));
      return;
    }
    setBusy('buy');
    setError(null);
    const outcome = await buyProduct(pack.id);
    setBusy(null);
    if (outcome === 'bought') {
      purchaseMade(pack.id);
      close({ outcome: 'bought', productId: pack.id });
    } else if (outcome === 'failed') {
      haptics.error();
      setError(t('paywall.buyFailed'));
    }
  }

  // Apple wants earlier purchases recoverable from where they're sold. Packs are used
  // up, so only Popdate+ comes back.
  async function restore() {
    if (busy) return;
    setBusy('restore');
    setError(null);
    try {
      if (await restorePurchases()) {
        haptics.success();
        close({ outcome: 'bought' });
      } else {
        showNotice(t('settings.restoreNoneTitle'), t('settings.restoreNoneBody'));
      }
    } catch {
      setError(t('paywall.storeFailed'));
    } finally {
      setBusy(null);
    }
  }

  function tagFor(item: Pack) {
    if (item.id === FEATURED_PACK) return t('paywall.mostPopular');
    const saving = packSaving(item, packs);
    return saving > 0 && item === packs[packs.length - 1]
      ? t('paywall.save', { percent: saving })
      : undefined;
  }

  const ready = catalogState.status === 'ready' && pack !== undefined;
  const failed = catalogState.status === 'failed';

  return (
    <GestureHandlerRootView style={styles.fill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }, dim]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={StyleSheet.absoluteFill}
          onPress={() => close()}
        />
      </Animated.View>
      <View style={styles.anchor} pointerEvents="box-none">
        <GestureDetector gesture={pull}>
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                backgroundColor: theme.sheet,
                paddingBottom: Math.max(insets.bottom, Space.md),
              },
              sheet,
            ]}>
            <View style={[styles.grabber, { backgroundColor: theme.text }]} />
            <Button
              title={t('common.close')}
              variant="glass"
              size="small"
              iconOnly
              fullWidth={false}
              icon={<Icon name="close" size={14} color={theme.text} />}
              onPress={() => close()}
              style={styles.close}
            />

            <View style={styles.header}>
              {typeof count === 'number' ? (
                <Text style={[styles.eyebrow, { color: theme.accentText }]}>
                  {t('paywall.youHave', { count })}
                </Text>
              ) : null}
              <ThemedText
                type="display"
                accessibilityRole="header"
                style={styles.center}
                maxFontSizeMultiplier={1.2}>
                {t('paywall.buyTitle')}
              </ThemedText>
              <ThemedText
                type="callout"
                themeColor="textSecondary"
                style={[styles.center, styles.subtitle]}>
                {t('paywall.buySubtitle')}
              </ThemedText>
            </View>

            <View style={[styles.carousel, { marginTop: airAbove }]}>
              {ready ? (
                <PackCarousel
                  packs={packs}
                  selected={selected}
                  onSelect={setChosen}
                  render={(item) => ({
                    name: t('paywall.packName', { count: item.balloons }),
                    each: t('paywall.each', {
                      price: money(perBalloon(item), item.currency),
                    }),
                    blurb: BLURBS[item.balloons]
                      ? t(BLURBS[item.balloons], {
                          percent: packSaving(item, packs),
                        })
                      : '',
                    tag: tagFor(item),
                  })}
                />
              ) : (
                <View style={styles.waiting}>
                  {failed ? (
                    <ThemedText type="callout" themeColor="textSecondary" style={styles.center}>
                      {t('paywall.storeFailed')}
                    </ThemedText>
                  ) : (
                    <ActivityIndicator color={theme.textSecondary} />
                  )}
                </View>
              )}
            </View>

            <View
              style={styles.dots}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden>
              {packs.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: theme.text,
                      opacity: index === selected ? 1 : 0.25,
                    },
                  ]}
                />
              ))}
            </View>

            <View style={styles.footer}>
              {error ? <ErrorLine message={error} /> : null}
              {failed ? (
                <Button title={t('common.tryAgain')} onPress={retry} />
              ) : (
                <Button
                  title={
                    pack
                      ? t('paywall.getPack', {
                          count: pack.balloons,
                          price: money(pack.price, pack.currency),
                        })
                      : t('paywall.buyTitle')
                  }
                  variant="brand"
                  onPress={buy}
                  loading={busy === 'buy' || !ready}
                  disabled={busy === 'restore'}
                />
              )}
              <Button
                title={t('paywall.plusLink')}
                variant="plain"
                onPress={() => openPlus(true)}
                trailing={(color) => <Icon name="chevronRight" size={12} color={color} />}
              />
              <ThemedText
                type="caption"
                themeColor="textTertiary"
                style={[styles.center, styles.fine]}>
                {t('paywall.oneTime')}{' '}
                <Text
                  accessibilityRole="link"
                  onPress={restore}
                  style={[styles.link, { color: theme.textTertiary }]}>
                  {t('paywall.restore')}
                </Text>
              </ThemedText>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
}

type CarouselProps = {
  packs: Pack[];
  selected: number;
  onSelect: (index: number) => void;
  render: (pack: Pack) => {
    name: string;
    each: string;
    blurb: string;
    tag?: string;
  };
};

/**
 * The packs side by side, snapping one card at a time. It opens on the featured
 * pack, and the card in the middle is the selected one, live as you swipe; a
 * tap on a side card brings it to the middle.
 */
function PackCarousel({ packs, selected, onSelect, render }: CarouselProps) {
  const reduced = useReduceMotion();
  // Measured, so the first and last cards can sit in the middle at any width.
  const [width, setWidth] = useState(0);
  const sidePad = Math.max(0, (width - CARD_WIDTH) / 2);
  const track = useAnimatedRef<Animated.ScrollView>();
  const startX = selected * STEP;
  const scrollX = useSharedValue(startX);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
  });
  const last = packs.length - 1;
  useAnimatedReaction(
    () => Math.max(0, Math.min(last, Math.round(scrollX.get() / STEP))),
    (index, previous) => {
      if (previous !== null && index !== previous) scheduleOnRN(onSelect, index);
    },
    [last],
  );

  function show(index: number) {
    track.current?.scrollTo({ x: index * STEP, animated: !reduced });
    onSelect(index);
  }

  return (
    <View style={styles.fill} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Animated.ScrollView
          ref={track}
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="radiogroup"
          // iOS opens on the featured card; the others get there on their first layout.
          contentOffset={{ x: startX, y: 0 }}
          onLayout={() => track.current?.scrollTo({ x: startX, animated: false })}
          snapToOffsets={Platform.OS === 'web' ? undefined : packs.map((_, index) => index * STEP)}
          decelerationRate="fast"
          disableIntervalMomentum
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={webTrack}
          contentContainerStyle={[styles.track, { paddingHorizontal: sidePad }]}>
          {packs.map((item, index) => (
            <View key={item.id} style={webCard}>
              <PackCard
                index={index}
                balloons={item.balloons}
                {...render(item)}
                selected={index === selected}
                scrollX={scrollX}
                onPress={() => show(index)}
              />
            </View>
          ))}
        </Animated.ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  anchor: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  grabber: {
    alignSelf: 'center',
    marginTop: 8,
    width: 36,
    height: 5,
    borderRadius: 3,
    opacity: 0.3,
  },
  close: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
  },
  header: {
    marginTop: 27,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 700,
    letterSpacing: 0.96,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  center: {
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 290,
  },
  carousel: {
    height: CARD_HEIGHT + TAG_ROOM,
  },
  track: {
    gap: CARD_GAP,
    paddingTop: TAG_ROOM,
  },
  waiting: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    height: 6,
    marginTop: 18,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  footer: {
    marginTop: 9,
    paddingHorizontal: 20,
    gap: 10,
    alignItems: 'center',
  },
  fine: {
    fontSize: 11,
    lineHeight: 15,
  },
  link: {
    textDecorationLine: 'underline',
  },
});
