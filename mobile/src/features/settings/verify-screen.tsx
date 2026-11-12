import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { api, type VerificationStatus } from '@/api';
import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { Rise } from '@/components/rise';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { VerifiedCheck } from '@/components/verified-check';
import { Radius, Space } from '@/constants/theme';
import { goBackOr, SETTINGS_PAGE } from '@/features/settings/settings-ui';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { useT, type TranslationKey } from '@/i18n';
import { haptics } from '@/utils/haptics';

const POLL_MS = 2000;
const SHUTTER = 72;
const isWeb = Platform.OS === 'web';

const STATUS: Record<
  VerificationStatus,
  { label: TranslationKey; body: TranslationKey | null; color: 'text' | 'success' | 'danger' }
> = {
  none: { label: 'settings.statusNone', body: null, color: 'text' },
  pending: { label: 'settings.statusPending', body: 'settings.verifyPendingBody', color: 'text' },
  verified: { label: 'settings.statusVerified', body: 'settings.verifyVerifiedBody', color: 'success' },
  rejected: { label: 'settings.statusRejected', body: 'settings.verifyRejectedBody', color: 'danger' },
};

/** Selfie verification (P02), as a modal: why, where it stands, and the camera in an oval. */
export function VerifyScreen() {
  const t = useT();
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [mode, setMode] = useState<'info' | 'camera' | 'preview'>('info');
  const [cameraReady, setCameraReady] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.getVerification().then(
      (loaded) => active && setStatus(loaded),
      () => active && setError(t('common.somethingWrong')),
    );
    return () => {
      active = false;
    };
    // Loads once; the language can change without a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While it's in review, ask again every 2 seconds; stop once it's decided or you leave.
  useEffect(() => {
    if (status !== 'pending') return;
    const timer = setInterval(() => {
      api.getVerification().then((next) => {
        if (next === 'pending') return;
        setStatus(next);
        if (next === 'verified') haptics.success();
        AccessibilityInfo.announceForAccessibility(t(STATUS[next].label));
      }, () => {});
    }, POLL_MS);
    return () => clearInterval(timer);
    // The status is the only thing that starts or stops the poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function fail(message = t('common.somethingWrong')) {
    setError(message);
    AccessibilityInfo.announceForAccessibility(message);
  }

  async function openCamera() {
    setError(null);
    let granted = permission?.granted ?? false;
    if (!granted && permission?.canAskAgain !== false) {
      granted = (await requestPermission()).granted;
    }
    if (!granted) {
      setCameraDenied(true);
      AccessibilityInfo.announceForAccessibility(t('settings.cameraDenied'));
      return;
    }
    setCameraDenied(false);
    setCameraReady(false);
    setMode('camera');
  }

  async function takePhoto() {
    if (!camera.current || !cameraReady || busy) return;
    haptics.light();
    setBusy(true);
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.7 });
      setPhoto(picture.uri);
      setMode('preview');
    } catch {
      fail();
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    haptics.selection();
    setPhoto(null);
    setCameraReady(false);
    setMode('camera');
  }

  async function submit() {
    if (!photo) return;
    setError(null);
    setBusy(true);
    try {
      const next = await api.submitSelfie(photo);
      setStatus(next);
      setPhoto(null);
      setMode('info');
      haptics.light();
      AccessibilityInfo.announceForAccessibility(t(STATUS[next].label));
    } catch {
      fail();
    } finally {
      setBusy(false);
    }
  }

  const close = () => goBackOr(SETTINGS_PAGE);
  const canTake = status === 'none' || status === 'rejected';
  const current = status ? STATUS[status] : null;
  // The three steps: read why, take it, check it.
  const step = mode === 'info' ? 1 : mode === 'camera' ? 2 : 3;

  const footer =
    mode === 'camera' ? (
      <View style={styles.shutterRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.shutter')}
          accessibilityState={{ disabled: !cameraReady || busy, busy }}
          disabled={!cameraReady || busy}
          onPress={takePhoto}
          style={({ pressed }) => [
            styles.shutter,
            { borderColor: theme.text },
            pressed && styles.shutterPressed,
          ]}>
          <View
            style={[
              styles.shutterFill,
              { backgroundColor: cameraReady && !busy ? theme.inverse : theme.surfacePressed },
            ]}
          />
        </Pressable>
      </View>
    ) : mode === 'preview' ? (
      <View style={styles.pair}>
        <View style={styles.flex}>
          <Button variant="tinted" title={t('settings.retake')} disabled={busy} onPress={retake} />
        </View>
        <View style={styles.flex}>
          <Button title={t('settings.usePhoto')} loading={busy} onPress={submit} />
        </View>
      </View>
    ) : status === 'pending' ? (
      <Button variant="tinted" title={t('settings.checking')} disabled />
    ) : canTake && !isWeb ? (
      <Button
        title={status === 'rejected' ? t('settings.retakeSelfie') : t('settings.takeSelfie')}
        onPress={openCamera}
      />
    ) : status ? (
      <Button title={t('common.done')} onPress={close} />
    ) : null;

  return (
    <Screen scroll={mode === 'info'} footer={footer} footerStyle="plain">
      {/* Cancel on its own row, so the title centers on the full width, not beside Cancel. */}
      <Rise index={0}>
        <View style={styles.bar}>
          <Button title={t('common.cancel')} variant="plain" fullWidth={false} onPress={close} />
        </View>
        <ThemedText type="display" accessibilityRole="header" style={styles.checkTitle}>
          {t('settings.verifyCheckTitle')}
        </ThemedText>
      </Rise>

      {mode === 'info' ? (
        <>
          <Rise index={1}>
            <ThemedText type="heading" style={styles.title}>
              {t('settings.verifyTitle')}
            </ThemedText>
            <ThemedText type="callout" themeColor="textSecondary" style={styles.intro}>
              {t('settings.verifyIntro')}
            </ThemedText>
            <ThemedText type="callout" themeColor="textSecondary" style={styles.private}>
              {t('settings.verifyPrivate')}
            </ThemedText>
          </Rise>

          {current ? (
            <Rise index={2}>
              <View
                accessible
                style={[styles.status, { backgroundColor: theme.field, borderColor: theme.border }]}>
                <View style={styles.statusLine}>
                  <ThemedText type="callout" themeColor="textSecondary">
                    {t('settings.status')}
                  </ThemedText>
                  <ThemedText type="row" themeColor={current.color}>
                    {t(current.label)}
                  </ThemedText>
                </View>
                {current.body ? (
                  <ThemedText type="callout" themeColor="textSecondary">
                    {t(current.body)}
                  </ThemedText>
                ) : null}
              </View>
            </Rise>
          ) : null}

          <Rise index={3}>
            <View style={[styles.perk, { backgroundColor: theme.field, borderColor: theme.border }]}>
              <View style={[styles.perkMark, { backgroundColor: theme.inverse }]}>
                <VerifiedCheck size={20} />
              </View>
              <View style={styles.flex}>
                <ThemedText type="headline">{t('settings.verifyPerkTitle')}</ThemedText>
                <ThemedText type="footnote" themeColor="textSecondary">
                  {t('settings.verifyPerkBody')}
                </ThemedText>
              </View>
            </View>
          </Rise>

          {isWeb && canTake ? (
            <ThemedText type="callout" themeColor="textSecondary" style={styles.note}>
              {t('settings.cameraWeb')}
            </ThemedText>
          ) : null}

          {cameraDenied ? (
            <View style={styles.denied}>
              <ThemedText type="callout" themeColor="textSecondary">
                {t('settings.cameraDenied')}
              </ThemedText>
              <View style={styles.openSettings}>
                <Button
                  variant="tinted"
                  title={t('settings.openSettings')}
                  onPress={() => Linking.openSettings()}
                />
              </View>
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.frameWrap}>
          <ThemedText type="callout" themeColor="textSecondary" style={styles.face}>
            {mode === 'camera' ? t('settings.verifyFace') : t('settings.previewTitle')}
          </ThemedText>
          <Oval scanning={mode === 'camera'}>
            {mode === 'camera' ? (
              <CameraView
                ref={camera}
                style={StyleSheet.absoluteFill}
                facing="front"
                mirror
                onCameraReady={() => setCameraReady(true)}
                onMountError={() => {
                  setMode('info');
                  fail();
                }}
                accessible
                accessibilityLabel={t('settings.cameraLabel')}
              />
            ) : photo ? (
              <Image
                source={{ uri: photo }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                accessible
                accessibilityLabel={t('settings.selfieLabel')}
              />
            ) : null}
          </Oval>
        </View>
      )}

      <View style={styles.steps} accessible accessibilityLabel={t('settings.verifyStep', { step })}>
        <View style={styles.stepBars}>
          {[1, 2, 3].map((n) => (
            <View
              key={n}
              style={[styles.stepBar, { backgroundColor: theme.text, opacity: n <= step ? 1 : 0.3 }]}
            />
          ))}
        </View>
        <ThemedText type="callout" themeColor="textSecondary" style={styles.stepNote}>
          {t('settings.verifyStep', { step })}
        </ThemedText>
      </View>

      {error ? (
        <View style={styles.error}>
          <ErrorLine message={error} />
        </View>
      ) : null}
    </Screen>
  );
}

/** The oval's size in the mockup. */
const OVAL = { width: 260, height: 340 };
/** One pass of the scan line, and one flicker of the ring. */
const SCAN_MS = 2200;

/**
 * The selfie window: an oval (as near as React Native's corner radii get, a
 * rounded capsule) whose ring flickers from the text color to gold while a gold
 * scan line travels it. Still under Reduce Motion.
 */
function Oval({ children, scanning }: { children: ReactNode; scanning: boolean }) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const pass = useSharedValue(0);
  const animate = scanning && !reduced;
  useEffect(() => {
    if (!animate) {
      cancelAnimation(pass);
      pass.set(0);
      return;
    }
    pass.set(withRepeat(withTiming(1, { duration: SCAN_MS, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, [animate, pass]);
  const from = theme.text;
  const to = theme.textSecondary;
  const ring = useAnimatedStyle(() => ({
    borderColor: interpolateColor(pass.get(), [0, 1], [from, to]),
  }));
  const line = useAnimatedStyle(() => ({
    transform: [{ translateY: 20 + pass.get() * (OVAL.height - 40) }],
  }));
  return (
    <Animated.View style={[styles.oval, { backgroundColor: theme.surface }, ring]}>
      {children}
      {animate ? (
        <Animated.View pointerEvents="none" style={[styles.scan, line]}>
          <Svg width="100%" height={2}>
            <Defs>
              <LinearGradient id="scan" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={theme.gold} stopOpacity={0} />
                <Stop offset="0.5" stopColor={theme.gold} stopOpacity={0.9} />
                <Stop offset="1" stopColor={theme.gold} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height={2} fill="url(#scan)" />
          </Svg>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkTitle: {
    marginTop: Space.xs,
    textAlign: 'center',
  },
  title: {
    marginTop: Space.lg,
  },
  intro: {
    marginTop: Space.sm,
  },
  private: {
    marginTop: Space.xs,
  },
  status: {
    marginTop: Space.lg,
    padding: Space.md,
    gap: Space.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
  },
  statusLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Space.xs,
  },
  // The perk card: a 36 pt circle in the text color with the check, a title over a quiet line.
  perk: {
    marginTop: Space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingVertical: 14,
    paddingHorizontal: Space.md,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  perkMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    marginTop: Space.md,
  },
  denied: {
    marginTop: Space.md,
    gap: Space.sm,
  },
  openSettings: {
    alignSelf: 'flex-start',
  },
  frameWrap: {
    flex: 1,
    alignItems: 'center',
    gap: Space.lg,
    paddingTop: Space.xs,
  },
  face: {
    textAlign: 'center',
  },
  oval: {
    width: OVAL.width,
    maxWidth: '100%',
    aspectRatio: OVAL.width / OVAL.height,
    borderRadius: OVAL.width / 2,
    borderWidth: 2,
    overflow: 'hidden',
  },
  scan: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 2,
  },
  steps: {
    marginTop: Space.lg,
    alignItems: 'center',
    gap: Space.sm,
  },
  stepBars: {
    flexDirection: 'row',
    gap: Space.xs,
  },
  stepBar: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  stepNote: {
    textAlign: 'center',
  },
  shutterRow: {
    alignItems: 'center',
  },
  shutter: {
    width: SHUTTER,
    height: SHUTTER,
    borderRadius: SHUTTER / 2,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterPressed: {
    transform: [{ scale: 0.94 }],
  },
  shutterFill: {
    width: SHUTTER - 14,
    height: SHUTTER - 14,
    borderRadius: (SHUTTER - 14) / 2,
  },
  pair: {
    flexDirection: 'row',
    gap: Space.xs,
  },
  error: {
    marginTop: Space.sm,
  },
});
