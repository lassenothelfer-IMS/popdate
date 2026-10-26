import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { api, type VerificationStatus } from '@/api';
import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { MinTouch, PhotoAspect, Radius, Space } from '@/constants/theme';
import { goBackOr, SETTINGS_PAGE } from '@/features/settings/settings-ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { haptics } from '@/utils/haptics';

const POLL_MS = 2000;
const SHUTTER = 72;
const isWeb = Platform.OS === 'web';

const STATUS: Record<
  VerificationStatus,
  { label: string; body: string | null; color: 'text' | 'success' | 'danger' }
> = {
  none: { label: 'settings.statusNone', body: null, color: 'text' },
  pending: { label: 'settings.statusPending', body: 'settings.verifyPendingBody', color: 'text' },
  verified: { label: 'settings.statusVerified', body: 'settings.verifyVerifiedBody', color: 'success' },
  rejected: { label: 'settings.statusRejected', body: 'settings.verifyRejectedBody', color: 'danger' },
};

/** Selfie verification, as a modal: why, where it stands, and the camera to take one. */
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
        else haptics.error();
        AccessibilityInfo.announceForAccessibility(t(STATUS[next].label));
      }, () => {});
    }, POLL_MS);
    return () => clearInterval(timer);
    // The status is the only thing that starts or stops the poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function fail(message = t('common.somethingWrong')) {
    setError(message);
    haptics.error();
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
      haptics.success();
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
            { borderColor: theme.inverse },
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
          <Button variant="secondary" title={t('settings.retake')} disabled={busy} onPress={retake} />
        </View>
        <View style={styles.flex}>
          <Button title={t('settings.usePhoto')} loading={busy} onPress={submit} />
        </View>
      </View>
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
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={close}
          style={({ pressed }) => [styles.close, { backgroundColor: theme.surface }, pressed && styles.pressed]}>
          <Icon name="close" size={15} color={theme.text} />
        </Pressable>
      </View>

      {mode === 'info' ? (
        <>
          <ThemedText type="display" accessibilityRole="header">
            {t('settings.verifyTitle')}
          </ThemedText>
          <ThemedText type="body" themeColor="textSecondary" style={styles.intro}>
            {t('settings.verifyIntro')}
          </ThemedText>
          <ThemedText type="callout" themeColor="textSecondary" style={styles.private}>
            {t('settings.verifyPrivate')}
          </ThemedText>

          {current ? (
            <View
              accessible
              style={[styles.status, { backgroundColor: theme.field, borderColor: theme.outline }]}>
              <View style={styles.statusLine}>
                <ThemedText type="footnote" themeColor="textSecondary">
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
          ) : null}

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
                  variant="secondary"
                  title={t('settings.openSettings')}
                  onPress={() => Linking.openSettings()}
                />
              </View>
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.frameWrap}>
          <ThemedText type="headline" accessibilityRole="header" style={styles.frameTitle}>
            {mode === 'camera' ? t('settings.cameraTitle') : t('settings.previewTitle')}
          </ThemedText>
          <View style={[styles.frame, { backgroundColor: theme.surface }]}>
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
          </View>
        </View>
      )}

      {error ? (
        <View style={styles.error}>
          <ErrorLine message={error} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  top: {
    alignItems: 'flex-end',
    marginBottom: Space.xs,
  },
  close: {
    width: MinTouch,
    height: MinTouch,
    borderRadius: MinTouch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
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
    borderWidth: 1,
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
  },
  frameTitle: {
    alignSelf: 'stretch',
    marginBottom: Space.sm,
  },
  // A portrait 3:4 window, as tall as the space allows.
  frame: {
    flex: 1,
    maxWidth: '100%',
    aspectRatio: PhotoAspect,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  shutterRow: {
    alignItems: 'center',
  },
  shutter: {
    width: SHUTTER,
    height: SHUTTER,
    borderRadius: SHUTTER / 2,
    borderWidth: 3,
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
