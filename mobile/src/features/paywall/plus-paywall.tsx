import { Image } from 'expo-image';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { Icon, type IconName } from '@/components/icon';
import { Rise } from '@/components/rise';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { Fonts, Gutter, MaxContentWidth, Radius, Space } from '@/constants/theme';
import { purchaseMade } from '@/features/balloons/use-balloons';
import {
  DEFAULT_PLAN,
  fullPrice,
  perMonth,
  planSaving,
  PLUS_OFFER_ENDS_AT,
  type Plan,
} from '@/features/paywall/catalog';
import { PLAN_ROW_HEIGHT, PlanRow } from '@/features/paywall/plan-row';
import { settleShop, useCatalog, useMoney } from '@/features/paywall/shop';
import { goBackOr, showNotice } from '@/features/settings/settings-ui';
import { useTheme } from '@/hooks/use-theme';
import { useT, type TranslationKey } from '@/i18n';
import type { PlusPlan } from '@/shared/balloons';
import { withAlpha } from '@/utils/color';
import { haptics } from '@/utils/haptics';
import { buyProduct, purchasesAvailable, restorePurchases } from '@/utils/purchases';

/** The same pages as Settings' Terms and Privacy, on the web: they open over the paywall. */
const TERMS_URL = 'https://lassenothelfer-ims.github.io/popdate/terms/';
const PRIVACY_URL = 'https://lassenothelfer-ims.github.io/popdate/privacy/';

/** Placeholder hero from the design (Pexels, free licence). */
const HERO = require('../../../assets/images/plus-hero-light.jpg');

/**
 * On the design's 844 pt screen the offer chip sits 232 pt down, the photo is
 * 480 pt tall and fades into the page over its last 330 pt. Taller phones move
 * all of it down with the content; shorter ones scroll.
 */
const BELOW_CHIP = 612;
const PHOTO_BELOW_CHIP = 248;
const FADE = 330;
/** The wordmark's baseline sits 0.8 of its size down; Fraunces' sits 0.978 em down its line. */
const PLUS_SIZE = 22;
const PLUS_NUDGE = PLUS_SIZE * (0.8 - 0.978);

const BENEFITS: { icon: IconName; key: TranslationKey }[] = [
  { icon: 'infinity', key: 'paywall.benefitUnlimited' },
  { icon: 'skip', key: 'paywall.benefitSkip' },
  { icon: 'eye', key: 'paywall.benefitSeen' },
  { icon: 'replay', key: 'paywall.benefitReplay' },
];

const PLAN_NAME: Record<PlusPlan, TranslationKey> = {
  weekly: 'paywall.weekly',
  sixMonths: 'paywall.sixMonths',
  annual: 'paywall.annual',
};
const RENEWS: Record<PlusPlan, TranslationKey> = {
  weekly: 'paywall.renewsWeekly',
  sixMonths: 'paywall.renewsSixMonths',
  annual: 'paywall.renewsAnnual',
};

/**
 * Popdate+: a full-screen modal with a photo, what it gives you and the three
 * plans, annual picked to start. Opens from Settings and from the buy sheet
 * (`?from=shop`), which closes with it after a purchase.
 */
export function PlusPaywall() {
  const theme = useTheme();
  const t = useT();
  const money = useMoney();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // Measured too: the web's first render can be told 0.
  const [screenHeight, setScreenHeight] = useState(windowHeight);
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromShop = from === 'shop';
  const [catalogState, retry] = useCatalog();
  const plans = catalogState.status === 'ready' ? catalogState.catalog.plans : [];
  const [choice, setChoice] = useState<PlusPlan>(DEFAULT_PLAN);
  const plan = plans.find((item) => item.plan === choice) ?? plans[plans.length - 1];
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [footerHeight, setFooterHeight] = useState(120);
  // Development builds count down to a sample end, so the chip can be seen; a real end ships in the catalog.
  const [sampleEnd] = useState(() => Date.now() + (58 * 60 + 29) * 1000);
  const offerEndsAt = PLUS_OFFER_ENDS_AT ?? (__DEV__ ? sampleEnd : null);

  const chipTop = Math.max(insets.top + 44 + Space.lg, screenHeight - BELOW_CHIP);
  const photoHeight = chipTop + PHOTO_BELOW_CHIP;

  function close() {
    goBackOr('/home' as Href);
  }

  /** Popdate+ is yours: over the buy sheet, both close and the line opens. */
  function done(productId?: string) {
    if (fromShop) {
      settleShop({ outcome: 'bought', productId });
      router.dismiss(2);
    } else {
      close();
    }
  }

  async function start() {
    if (!plan || busy) return;
    if (!purchasesAvailable) {
      showNotice(t('paywall.plusLabel'), t('paywall.notHere'));
      return;
    }
    setBusy('buy');
    setError(null);
    const outcome = await buyProduct(plan.id);
    setBusy(null);
    if (outcome === 'bought') {
      purchaseMade(plan.id);
      done(plan.id);
    } else if (outcome === 'failed') {
      haptics.error();
      setError(t('paywall.buyFailed'));
    }
  }

  async function restore() {
    if (busy) return;
    setBusy('restore');
    setError(null);
    try {
      if (await restorePurchases()) {
        haptics.success();
        done();
      } else {
        showNotice(t('settings.restoreNoneTitle'), t('settings.restoreNoneBody'));
      }
    } catch {
      setError(t('paywall.storeFailed'));
    } finally {
      setBusy(null);
    }
  }

  function tagFor(item: Plan) {
    const saving = planSaving(item, plans);
    if (saving <= 0) return undefined;
    const best = Math.max(...plans.map((other) => planSaving(other, plans)));
    return saving === best
      ? t('paywall.bestValue', { percent: saving })
      : t('paywall.save', { percent: saving });
  }

  function rowFor(item: Plan) {
    const price = money(item.price, item.currency);
    if (item.plan === 'weekly') {
      return {
        detail: t('paywall.cancelAnyTime'),
        price: t('paywall.perWeek', { price }),
      };
    }
    return {
      detail: t(item.plan === 'annual' ? 'paywall.billedAnnual' : 'paywall.billedSixMonths', {
        price,
      }),
      price: t('paywall.perMonth', {
        price: money(perMonth(item), item.currency),
      }),
    };
  }

  const struck = plan ? fullPrice(plan, plans) : null;
  const failed = catalogState.status === 'failed';

  return (
    <View
      style={[styles.fill, { backgroundColor: theme.page }]}
      onLayout={(event) => setScreenHeight(event.nativeEvent.layout.height)}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[
          styles.content,
          { paddingTop: chipTop, paddingBottom: footerHeight + 26 },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { height: photoHeight }]} pointerEvents="none">
          <Image
            source={HERO}
            contentFit="cover"
            contentPosition={{ left: '50%', top: '20%' }}
            style={StyleSheet.absoluteFill}
            accessible={false}
          />
          <Fade color={theme.page} height={photoHeight} />
        </View>

        <Rise index={1} style={styles.intro}>
          {offerEndsAt ? <OfferChip endsAt={offerEndsAt} /> : null}
          <ThemedText
            type="title"
            accessibilityRole="header"
            style={styles.title}
            maxFontSizeMultiplier={1.2}>
            {t('paywall.plusTitle')}
          </ThemedText>
        </Rise>

        <Rise index={2} style={styles.benefits}>
          {BENEFITS.map(({ icon, key }) => (
            <View key={key} style={styles.benefit}>
              <View
                style={[styles.benefitIcon, { backgroundColor: withAlpha(theme.brand, 0.14) }]}>
                <Icon name={icon} size={14} color={theme.brand} />
              </View>
              <ThemedText type="callout" style={styles.benefitText}>
                {t(key)}
              </ThemedText>
            </View>
          ))}
        </Rise>

        <Rise index={3} style={styles.plans}>
          {plans.length > 0 ? (
            <View accessibilityRole="radiogroup" style={styles.planList}>
              {plans.map((item) => (
                <PlanRow
                  key={item.id}
                  title={t(PLAN_NAME[item.plan])}
                  {...rowFor(item)}
                  tag={tagFor(item)}
                  selected={item === plan}
                  onPress={() => setChoice(item.plan)}
                />
              ))}
            </View>
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
        </Rise>
      </ScrollView>

      {/* The page's top edge darkens a little, so the wordmark and the close button read over the photo. */}
      <View style={[styles.topShade, { height: insets.top + 140 }]} pointerEvents="none">
        <Shade color={theme.page} />
      </View>
      <Rise index={0} style={[styles.topBar, { top: insets.top + 4 }]}>
        <PlusMark />
        <Button
          title={t('common.close')}
          variant="glass"
          size="small"
          iconOnly
          fullWidth={false}
          icon={<Icon name="close" size={14} color={theme.text} />}
          onPress={close}
        />
      </Rise>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.page,
            paddingBottom: Math.max(insets.bottom - 4, Space.md),
          },
        ]}
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}>
        <Rise index={4} style={styles.footerInner}>
          {error ? <ErrorLine message={error} /> : null}
          {failed ? (
            <Button title={t('common.tryAgain')} onPress={retry} />
          ) : (
            <Button
              title={
                plan
                  ? t('paywall.startPlus', {
                      price: money(plan.price, plan.currency),
                    })
                  : t('paywall.plusLabel')
              }
              variant="brand"
              onPress={start}
              loading={busy === 'buy' || !plan}
              disabled={busy === 'restore'}
              trailing={(color) =>
                plan && struck ? (
                  <Text style={[styles.struck, { color }]}>{money(struck, plan.currency)}</Text>
                ) : null
              }
            />
          )}
          <ThemedText type="caption" themeColor="textTertiary" style={[styles.center, styles.fine]}>
            {plan ? `${t(RENEWS[plan.plan], { price: money(plan.price, plan.currency) })} ` : ''}
            <Text
              accessibilityRole="link"
              onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
              style={styles.link}>
              {t('paywall.terms')}
            </Text>
            {' · '}
            <Text
              accessibilityRole="link"
              onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
              style={styles.link}>
              {t('paywall.privacy')}
            </Text>
            {' · '}
            <Text accessibilityRole="link" onPress={restore} style={styles.link}>
              {t('paywall.restoreShort')}
            </Text>
          </ThemedText>
        </Rise>
      </View>
    </View>
  );
}

/** "Popdate" as it always is, then "Plus" in Fraunces italic at the same size, on the same baseline. */
function PlusMark() {
  const theme = useTheme();
  const t = useT();
  return (
    <View
      style={styles.mark}
      accessible
      accessibilityRole="header"
      accessibilityLabel={t('paywall.plusLabel')}>
      <Wordmark size={PLUS_SIZE} compact />
      <Text style={[styles.plusWord, { color: theme.brand }]} maxFontSizeMultiplier={1}>
        {t('paywall.plusWord')}
      </Text>
    </View>
  );
}

/** "Intro offer ends in 58:29", counting down each second, gone when it ends. */
function OfferChip({ endsAt }: { endsAt: number }) {
  const theme = useTheme();
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = Math.ceil((endsAt - now) / 1000);
  if (left <= 0) return null;
  const hours = Math.floor(left / 3600);
  const minutes = Math.floor((left % 3600) / 60);
  const seconds = left % 60;
  const two = (value: number) => String(value).padStart(2, '0');
  const time =
    hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
  return (
    <View style={[styles.chip, { backgroundColor: theme.highlight }]}>
      <View style={[styles.chipDot, { backgroundColor: theme.brand }]} />
      <ThemedText type="timer" style={styles.chipText}>
        {t('paywall.offerEnds', { time })}
      </ThemedText>
    </View>
  );
}

/** The photo fades into the page: clear, then 85% at 60% of the way, then the page itself. */
function Fade({ color, height }: { color: string; height: number }) {
  return (
    <Svg style={[styles.fade, { height: FADE }]} width="100%" height={FADE} pointerEvents="none">
      <Defs>
        <LinearGradient id="plusFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0} />
          <Stop offset="0.6" stopColor={color} stopOpacity={0.85} />
          <Stop offset="1" stopColor={color} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect y={0} width="100%" height={Math.min(FADE, height)} fill="url(#plusFade)" />
    </Svg>
  );
}

function Shade({ color }: { color: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id="plusShade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.45} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#plusShade)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Gutter,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  topShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topBar: {
    position: 'absolute',
    left: Gutter,
    right: Gutter - 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mark: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  plusWord: {
    fontFamily: Fonts.plus,
    fontStyle: 'italic',
    fontWeight: 400,
    fontSize: PLUS_SIZE,
    marginLeft: 6,
    marginTop: PLUS_NUDGE,
    includeFontPadding: false,
  },
  intro: {
    gap: 10,
    alignItems: 'flex-start',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: 600,
  },
  title: {
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -0.76,
  },
  benefits: {
    marginTop: 2,
    gap: 9,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
  },
  plans: {
    marginTop: 21,
  },
  planList: {
    gap: 12,
  },
  waiting: {
    height: 3 * PLAN_ROW_HEIGHT + 2 * 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: Space.xs,
  },
  footerInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Gutter,
    gap: 8,
    alignItems: 'center',
  },
  struck: {
    fontFamily: Fonts.sans,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 500,
    textDecorationLine: 'line-through',
    opacity: 0.55,
  },
  fine: {
    fontSize: 11,
    lineHeight: 15,
    maxWidth: 330,
  },
  link: {
    textDecorationLine: 'underline',
  },
});
