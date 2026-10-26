import * as ImagePicker from 'expo-image-picker';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { Icon } from '@/components/icon';
import { Photo, type PhotoTone } from '@/components/photo';
import { PressableHighlight } from '@/components/pressable-highlight';
import { PressableScale } from '@/components/pressable-scale';
import { ProgressSegments } from '@/components/progress-segments';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Gutter, MaxContentWidth, MinTouch, Radius } from '@/constants/theme';
import { SETUP_STEPS, setupStepLabel } from '@/features/onboarding/setup-steps';
import { testPhotos } from '@/features/profile/test-profile';
import { useSeats, useTheme, youSeat } from '@/hooks/use-theme';
import { useSession } from '@/state/session';
import { haptics } from '@/utils/haptics';

const PHOTO_COUNT = 6;
/** The grid: three columns of 96pt rows; the lead photo spans two by two. */
const GRID_GAP = 8;
const ROW_HEIGHT = 96;
const LEAD_HEIGHT = ROW_HEIGHT * 2 + GRID_GAP;
const HEIGHT_MIN = 120;
const HEIGHT_MAX = 230;
const BIO_MAX = 300;

type SlotSize = { width: number; height: number };

function digitsOnly(text: string) {
  return text.replace(/\D/g, '');
}

function photoCount(count: number, more: boolean) {
  const noun = count === 1 ? 'photo' : 'photos';
  return more ? `${count} more ${noun}` : `${count} ${noun}`;
}

function heightIsValid(height: string) {
  const cm = Number(height);
  return Number.isInteger(cm) && cm >= HEIGHT_MIN && cm <= HEIGHT_MAX;
}

/** Wait for three digits or for the field to lose focus before calling a height wrong. */
function heightErrorShows(height: string, blurred: boolean) {
  return height !== '' && !heightIsValid(height) && (blurred || height.length >= 3);
}

export function ProfileSetupScreen() {
  const { onboarding, saveProfile } = useSession();
  const seats = useSeats();
  const { width: windowWidth } = useWindowDimensions();
  const [photos, setPhotos] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [height, setHeight] = useState('');
  const [heightBlurred, setHeightBlurred] = useState(false);
  const [job, setJob] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Measured, so the columns line up exactly around the two-by-two lead slot.
  // Until the first layout, the window gives a close estimate, so the grid doesn't jump.
  const [gridWidth, setGridWidth] = useState(0);
  const width = gridWidth > 0 ? gridWidth : Math.min(windowWidth, MaxContentWidth) - Gutter * 2;
  const column = (width - GRID_GAP * 2) / 3;
  const smallSize = { width: column, height: ROW_HEIGHT };
  const leadSize = { width: column * 2 + GRID_GAP, height: LEAD_HEIGHT };
  // Your own hue, the same one Home gives you (the match and the role reveal put
  // you on the neutral tile instead).
  const tone = youSeat(seats);

  if (!onboarding) return <Redirect href="/onboarding" />;

  const heightCm = Number(height);
  const heightValid = heightIsValid(height);
  const showHeightError = heightErrorShows(height, heightBlurred);
  const missingDetails = [
    !name.trim() && 'first name',
    !city.trim() && 'city',
    !heightValid && 'height',
    !job.trim() && 'job or school',
    !bio.trim() && 'bio',
  ].filter((detail) => detail !== false);
  const detailsDone = missingDetails.length === 0;
  const photosLeft = PHOTO_COUNT - photos.length;
  const complete = photosLeft === 0 && detailsDone;
  const bioLeft = BIO_MAX - bio.length;
  const showTestPhotos = __DEV__ && photos.length < PHOTO_COUNT;

  let missing: string | null = null;
  if (photosLeft > 0) {
    const add = `Add ${photoCount(photosLeft, photos.length > 0)}`;
    missing = detailsDone ? `${add}.` : `${add} and fill in your details.`;
  } else if (missingDetails.length === 1) {
    const [detail] = missingDetails;
    // Same gate as the field: while you're still typing a height, it's only missing.
    missing = detail === 'height' && showHeightError ? 'Check your height.' : `Add your ${detail}.`;
  } else if (!detailsDone) {
    missing = 'Fill in your details to start.';
  }

  async function addPhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: PHOTO_COUNT - photos.length,
      orderedSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    const picked = result.assets.map((asset) => asset.uri);
    setPhotos((current) => [...current, ...picked].slice(0, PHOTO_COUNT));
  }

  function removePhoto(index: number) {
    setPhotos((current) => current.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveProfile({
        name: name.trim(),
        city: city.trim(),
        heightCm,
        job: job.trim(),
        bio: bio.trim(),
        photos,
      });
      router.replace('/home');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Saving failed. Try again.';
      setError(message);
      haptics.error();
      AccessibilityInfo.announceForAccessibility(message);
      setSaving(false);
    }
  }

  function slot(index: number) {
    return (
      <PhotoSlot
        key={index}
        index={index}
        size={index === 0 ? leadSize : smallSize}
        uri={photos[index]}
        isNext={index === photos.length}
        name={name.trim()}
        tone={tone}
        onAdd={addPhotos}
        onRemove={() => removePhoto(index)}
      />
    );
  }

  return (
    <Screen
      scroll
      footer={
        <>
          {error ? (
            <ErrorLine message={error} />
          ) : missing ? (
            <ThemedText type="footnote" themeColor="textSecondary" style={styles.footerNote}>
              {missing}
            </ThemedText>
          ) : null}
          <Button
            title="Start playing"
            disabled={!complete}
            loading={saving}
            onPress={handleSave}
            accessibilityHint={complete ? undefined : (missing ?? undefined)}
          />
        </>
      }>
      <View style={styles.segments}>
        <ProgressSegments
          total={SETUP_STEPS}
          filled={SETUP_STEPS}
          accessibilityLabel={setupStepLabel(SETUP_STEPS)}
        />
      </View>

      <ThemedText type="display" accessibilityRole="header" style={styles.title}>
        Your profile
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.intro}>
        People meet you one photo per round, in this order. Lead with one that looks like you on a
        good day.
      </ThemedText>

      <Section
        title="Photos"
        aside={`${photos.length} of ${PHOTO_COUNT}`}
        style={styles.photosSection}>
        <View style={styles.grid} onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}>
          <View style={styles.gridRow}>
            {slot(0)}
            <View style={styles.grid}>
              {slot(1)}
              {slot(2)}
            </View>
          </View>
          <View style={styles.gridRow}>
            {slot(3)}
            {slot(4)}
            {slot(5)}
          </View>
        </View>
      </Section>
      {showTestPhotos ? (
        <View style={styles.testPhotos}>
          <Button title="Use test photos" variant="ghost" onPress={() => setPhotos(testPhotos())} />
        </View>
      ) : null}

      <Section
        title="About you"
        style={[styles.aboutSection, showTestPhotos && styles.aboutAfterTestPhotos]}>
        <View style={styles.fields}>
          <TextField
            label="First name"
            value={name}
            onChangeText={setName}
            maxLength={30}
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
          />
          <TextField
            label="City"
            value={city}
            onChangeText={setCity}
            maxLength={40}
            autoCapitalize="words"
            textContentType="addressCity"
          />
          {/* Checked inline by the ring, icon and message. No error haptic: that's for the save. */}
          <TextField
            label="Height"
            accessibilityLabel="Height in centimeters"
            value={height}
            onChangeText={(text) => setHeight(digitsOnly(text))}
            onBlur={() => setHeightBlurred(true)}
            keyboardType="number-pad"
            maxLength={3}
            suffix="cm"
            error={showHeightError}
            hint={
              showHeightError ? `Enter a height between ${HEIGHT_MIN} and ${HEIGHT_MAX} cm.` : undefined
            }
          />
          <TextField label="Job or school" value={job} onChangeText={setJob} maxLength={60} />
          <TextField
            label="Bio"
            value={bio}
            onChangeText={setBio}
            maxLength={BIO_MAX}
            multiline
            placeholder="What should someone know before a first date?"
            counter={bioLeft === 1 ? '1 character left' : `${bioLeft} characters left`}
          />
        </View>
      </Section>
    </Screen>
  );
}

type PhotoSlotProps = {
  index: number;
  /** Measured from the grid: one column by one row, or two by two for the lead. */
  size: SlotSize;
  uri: string | undefined;
  /** The first empty slot: where the next photo goes. */
  isNext: boolean;
  /** Your first name, for a mock photo's initial. */
  name: string;
  tone: PhotoTone;
  onAdd: () => void;
  onRemove: () => void;
};

/** One slot of the photo grid: filled, the next one to add, or a quiet numbered placeholder. */
function PhotoSlot({ index, size, uri, isNext, name, tone, onAdd, onRemove }: PhotoSlotProps) {
  const theme = useTheme();
  const position = index + 1;
  const lead = index === 0;

  if (uri) {
    return (
      <View style={[styles.slot, size]}>
        <Photo
          uri={uri}
          name={name}
          tone={tone}
          initialSize={lead ? 56 : 32}
          style={StyleSheet.absoluteFill}
          accessibilityLabel={`Your photo ${position}`}
        />
        {/* The order is the point of this grid, so every photo wears its number. */}
        <View
          style={[styles.number, { backgroundColor: theme.field }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <ThemedText type="captionStrong" maxFontSizeMultiplier={1.2}>
            {position}
          </ThemedText>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Remove photo ${position}`}
          onPress={onRemove}
          containerStyle={styles.removeTarget}
          style={[styles.removeCircle, { backgroundColor: theme.inverse }]}>
          <Icon name="close" size={10} color={theme.onInverse} />
        </PressableScale>
      </View>
    );
  }

  if (isNext) {
    const title = lead ? 'Add your lead photo' : 'Add';
    return (
      <PressableHighlight
        accessibilityRole="button"
        accessibilityLabel={lead ? title : 'Add photos'}
        accessibilityHint={`Opens your photo library. Your next pick becomes photo ${position}.`}
        onPress={onAdd}
        background={theme.field}
        style={[styles.slot, styles.addSlot, size, { borderColor: theme.borderStrong }]}>
        <Icon name="add" size={lead ? 28 : 22} color={theme.text} />
        {/* The slot keeps its size, so the label shrinks rather than overflow it. */}
        <ThemedText
          type="headline"
          numberOfLines={lead ? 2 : 1}
          adjustsFontSizeToFit
          style={styles.addLabel}>
          {title}
        </ThemedText>
      </PressableHighlight>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={`Photo ${position}, empty`}
      style={[styles.slot, size, { backgroundColor: theme.surface }]}>
      <ThemedText type="label" themeColor="textSecondary" numberOfLines={1} adjustsFontSizeToFit>
        {position}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  segments: {
    paddingTop: 4,
  },
  title: {
    marginTop: 28,
  },
  intro: {
    marginTop: 10,
  },
  photosSection: {
    marginTop: 24,
    gap: 10,
  },
  grid: {
    gap: GRID_GAP,
  },
  gridRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  slot: {
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSlot: {
    gap: 8,
    padding: 8,
    borderWidth: 1,
  },
  addLabel: {
    textAlign: 'center',
  },
  number: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeTarget: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: MinTouch,
    height: MinTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeCircle: {
    width: 24,
    height: 24,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testPhotos: {
    marginTop: 6,
  },
  aboutSection: {
    marginTop: 24,
    gap: 10,
  },
  aboutAfterTestPhotos: {
    marginTop: 18,
  },
  fields: {
    gap: 12,
  },
  footerNote: {
    textAlign: 'center',
  },
});
