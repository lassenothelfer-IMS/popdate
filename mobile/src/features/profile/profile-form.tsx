import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';

import type { Units } from '@/api';
import { ErrorIcon, ErrorLine, errorEnter } from '@/components/error-line';
import { Icon } from '@/components/icon';
import { Photo, type PhotoTone } from '@/components/photo';
import { PressableHighlight } from '@/components/pressable-highlight';
import { PressableScale } from '@/components/pressable-scale';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Gutter, MaxContentWidth, MinTouch, PhotoGlass, Radius, Velvet } from '@/constants/theme';
import { asSexuality, type Sexuality } from '@/features/profile/identity';
import { useSeats, useTheme, youSeat } from '@/hooks/use-theme';
import { useT, type Translate } from '@/i18n';
import type { ProfileDetails } from '@/state/session';
import { useSettings } from '@/state/settings';
import { cmToFeetInches, feetInchesToCm, formatHeight } from '@/utils/units';

export const PHOTO_COUNT = 6;
/** The grid: three columns of 108 pt rows, 10 apart; the lead photo spans two by two. */
const GRID_GAP = 10;
const ROW_HEIGHT = 108;
/** The "Photo n" tag's dark glass, the same on every photo in both themes. */
const TAG_GLASS = PhotoGlass.tag;
const LEAD_HEIGHT = ROW_HEIGHT * 2 + GRID_GAP;
const HEIGHT_MIN = 120;
const HEIGHT_MAX = 230;
const BIO_MAX = 300;

type SlotSize = { width: number; height: number };
type Detail = 'name' | 'city' | 'height' | 'job' | 'bio';

const ADD_DETAIL: Record<Detail, string> = {
  name: 'profile.addName',
  city: 'profile.addCity',
  height: 'profile.addHeight',
  job: 'profile.addJob',
  bio: 'profile.addBio',
};

/** A height as typed, in the units it was typed in. Heights are stored in cm. */
type HeightEntry = { units: Units; cm: string; feet: string; inches: string };

function digitsOnly(text: string) {
  return text.replace(/\D/g, '');
}

function cmIsValid(cm: number | null) {
  return cm !== null && Number.isInteger(cm) && cm >= HEIGHT_MIN && cm <= HEIGHT_MAX;
}

function heightEntry(cm: number | null, units: Units): HeightEntry {
  if (cm === null) return { units, cm: '', feet: '', inches: '' };
  const { feet, inches } = cmToFeetInches(cm);
  return { units, cm: String(cm), feet: String(feet), inches: String(inches) };
}

function sameEntry(a: HeightEntry, b: HeightEntry) {
  return a.units === b.units && a.cm === b.cm && a.feet === b.feet && a.inches === b.inches;
}

/** The typed height in cm, or null while it's missing or can't be a height (like 5 ft 14 in). */
function enteredCm(entry: HeightEntry): number | null {
  if (entry.units === 'metric') return entry.cm === '' ? null : Number(entry.cm);
  if (entry.feet === '') return null;
  // "5 ft" with the inches left empty reads as 5 ft 0 in.
  const inches = entry.inches === '' ? 0 : Number(entry.inches);
  if (inches > 11) return null;
  return feetInchesToCm(Number(entry.feet), inches);
}

/** The shortest or tallest whole-inch height that still lands inside the cm range. */
function imperialBound(edge: 'min' | 'max') {
  const step = edge === 'min' ? 1 : -1;
  let total = edge === 'min' ? 0 : 120;
  while (!cmIsValid(feetInchesToCm(0, total))) total += step;
  return feetInchesToCm(0, total);
}

const IMPERIAL_MIN_CM = imperialBound('min');
const IMPERIAL_MAX_CM = imperialBound('max');

/** True when no number of inches could make these feet a valid height. */
function feetAreHopeless(feet: string) {
  if (feet === '') return false;
  return !Array.from({ length: 12 }, (_, inches) => inches).some((inches) =>
    cmIsValid(feetInchesToCm(Number(feet), inches)),
  );
}

function heightRangeMessage(t: Translate, units: Units) {
  return units === 'metric'
    ? t('profile.heightRangeCm', { min: HEIGHT_MIN, max: HEIGHT_MAX })
    : t('profile.heightRangeImperial', {
        min: formatHeight(IMPERIAL_MIN_CM, 'imperial'),
        max: formatHeight(IMPERIAL_MAX_CM, 'imperial'),
      });
}

/**
 * The profile's photos and details as you edit them, shared by profile setup
 * (empty to start) and editing your profile (prefilled). Height follows your
 * units setting and is always handed back in cm.
 */
export function useProfileForm(initial: ProfileDetails | null) {
  const t = useT();
  const { units } = useSettings().settings;
  const [start] = useState(() => ({
    details: initial,
    height: heightEntry(initial?.heightCm ?? null, units),
  }));
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? []);
  const [name, setName] = useState(initial?.name ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [typedHeight, setTypedHeight] = useState(start.height);
  const [heightBlurred, setHeightBlurred] = useState(false);
  const [job, setJob] = useState(initial?.job ?? '');
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [genderDetails, setGenderDetails] = useState(initial?.genderDetails ?? '');
  const [sexuality, setSexuality] = useState<Sexuality | null>(asSexuality(initial?.sexuality));
  // The picker is open, or iCloud is still handing over the photos you chose.
  const [picking, setPicking] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // If the units setting changes under the form, show the same height in the new units.
  const height =
    typedHeight.units === units ? typedHeight : heightEntry(enteredCm(typedHeight), units);
  // Untouched, the stored height comes back exactly, without a round trip through inches.
  const heightCm =
    start.details && sameEntry(height, start.height) ? start.details.heightCm : enteredCm(height);
  const heightValid = cmIsValid(heightCm);
  const heightTyped = height.units === 'metric' ? height.cm !== '' : height.feet + height.inches !== '';
  // Wait until the height can't become right by typing on, or the field loses focus.
  const heightDone =
    height.units === 'metric'
      ? height.cm.length >= 3
      : height.inches.length >= 2 || feetAreHopeless(height.feet);
  const showHeightError = heightTyped && !heightValid && (heightBlurred || heightDone);

  const missingDetails = (
    [
      !name.trim() && 'name',
      !city.trim() && 'city',
      !heightValid && 'height',
      !job.trim() && 'job',
      !bio.trim() && 'bio',
    ] as const
  ).filter((detail) => detail !== false);
  const detailsDone = missingDetails.length === 0;
  const photosLeft = PHOTO_COUNT - photos.length;
  const complete = photosLeft === 0 && detailsDone;

  const details: ProfileDetails | null =
    complete && heightCm !== null
      ? {
          name: name.trim(),
          city: city.trim(),
          heightCm,
          job: job.trim(),
          bio: bio.trim(),
          genderDetails: genderDetails.trim() || undefined,
          sexuality: sexuality ?? undefined,
          photos,
        }
      : null;

  const before = start.details;
  const changed =
    !before ||
    photos.join('\n') !== before.photos.join('\n') ||
    name.trim() !== before.name.trim() ||
    city.trim() !== before.city.trim() ||
    heightCm !== before.heightCm ||
    job.trim() !== before.job.trim() ||
    bio.trim() !== before.bio.trim() ||
    genderDetails.trim() !== (before.genderDetails ?? '').trim() ||
    sexuality !== asSexuality(before.sexuality);

  /** What still stands between you and the footer's action, or null when nothing does. */
  function missing(purpose: 'start' | 'save'): string | null {
    if (photosLeft > 0) {
      const more = photos.length > 0;
      const key = detailsDone
        ? more
          ? 'profile.addMorePhotos'
          : 'profile.addPhotos'
        : more
          ? 'profile.addMorePhotosAndDetails'
          : 'profile.addPhotosAndDetails';
      return t(key, { count: photosLeft });
    }
    if (missingDetails.length === 1) {
      const [detail] = missingDetails;
      // Same gate as the field: while you're still typing a height, it's only missing.
      return detail === 'height' && showHeightError
        ? t('profile.checkHeight')
        : t(ADD_DETAIL[detail]);
    }
    if (!detailsDone) {
      return purpose === 'start' ? t('profile.fillDetailsToStart') : t('profile.fillDetailsToSave');
    }
    return null;
  }

  async function addPhotos() {
    // A second tap while photos are still loading would open a second picker.
    if (picking) return;
    setPicking(true);
    setPhotoError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: PHOTO_COUNT - photos.length,
        orderedSelection: true,
        quality: 0.8,
        // Most iPhone photos are Live Photos, often kept in iCloud only. Without this
        // the first pick of one fails, and only a second try finds it downloaded.
        shouldDownloadFromNetwork: true,
      });
      if (result.canceled) return;
      const picked = result.assets.map((asset) => asset.uri);
      setPhotos((current) => [...current, ...picked].slice(0, PHOTO_COUNT));
    } catch {
      const message = t('profile.photosFailed');
      setPhotoError(message);
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      setPicking(false);
    }
  }

  function removePhoto(index: number) {
    setPhotoError(null);
    setPhotos((current) => current.filter((_, i) => i !== index));
  }

  function changeHeight(part: 'cm' | 'feet' | 'inches', text: string) {
    setTypedHeight({ ...height, [part]: digitsOnly(text) });
  }

  return {
    photos,
    setPhotos,
    addPhotos,
    picking,
    photoError,
    removePhoto,
    name,
    setName,
    city,
    setCity,
    height,
    changeHeight,
    blurHeight: () => setHeightBlurred(true),
    showHeightError,
    heightError: heightRangeMessage(t, height.units),
    job,
    setJob,
    bio,
    setBio,
    genderDetails,
    setGenderDetails,
    sexuality,
    setSexuality,
    complete,
    details,
    changed,
    missing,
  };
}

export type ProfileForm = ReturnType<typeof useProfileForm>;

type PhotoSectionProps = {
  form: ProfileForm;
  style?: StyleProp<ViewStyle>;
  /** Just the grid, for a screen whose title already says "photos" (profile setup). */
  bare?: boolean;
};

/** "Photos" and the six-slot grid: the lead photo two by two, then five more, in order. */
export function PhotoSection({ form, style, bare = false }: PhotoSectionProps) {
  const t = useT();
  const seats = useSeats();
  const { width: windowWidth } = useWindowDimensions();
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
  const { photos } = form;

  function slot(index: number) {
    return (
      <PhotoSlot
        key={index}
        index={index}
        size={index === 0 ? leadSize : smallSize}
        uri={photos[index]}
        isNext={index === photos.length}
        busy={form.picking}
        name={form.name.trim()}
        tone={tone}
        onAdd={form.addPhotos}
        onRemove={() => form.removePhoto(index)}
      />
    );
  }

  const grid = (
    <View
      style={[styles.grid, bare && style]}
      onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}>
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
      {form.photoError ? <ErrorLine message={form.photoError} /> : null}
    </View>
  );
  if (bare) return grid;

  return (
    <Section
      title={t('profile.photos')}
      aside={t('profile.photosCount', { filled: photos.length, total: PHOTO_COUNT })}
      style={[styles.section, style]}>
      {grid}
    </Section>
  );
}

type PhotoSlotProps = {
  index: number;
  /** Measured from the grid: one column by one row, or two by two for the lead. */
  size: SlotSize;
  uri: string | undefined;
  /** The first empty slot: where the next photo goes. */
  isNext: boolean;
  /** Photos are on their way in: the next slot spins and taps wait. */
  busy: boolean;
  /** Your first name, for a mock photo's initial. */
  name: string;
  tone: PhotoTone;
  onAdd: () => void;
  onRemove: () => void;
};

/** One slot of the photo grid: filled, the next one to add, or a quiet numbered placeholder. */
function PhotoSlot({ index, size, uri, isNext, busy, name, tone, onAdd, onRemove }: PhotoSlotProps) {
  const t = useT();
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
          accessibilityLabel={t('profile.yourPhoto', { position })}
        />
        {/* The order is the point of this grid, so every photo wears its number. The
            lead says which round sees it, on the text color; the rest on dark glass. */}
        <View
          style={[
            styles.number,
            lead ? styles.leadTag : styles.smallTag,
            { backgroundColor: lead ? theme.inverse : TAG_GLASS },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <ThemedText
            type="captionStrong"
            maxFontSizeMultiplier={1.2}
            style={[styles.tagText, { color: lead ? theme.onInverse : Velvet.cream }]}>
            {lead ? t('profile.roundTag', { round: 1 }) : position}
          </ThemedText>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('profile.removePhoto', { position })}
          onPress={onRemove}
          containerStyle={styles.removeTarget}
          style={[styles.removeCircle, { backgroundColor: theme.field }]}>
          <Icon name="close" size={10} color={theme.text} />
        </PressableScale>
      </View>
    );
  }

  if (isNext && lead) {
    // The first photo: the one place to tap, on accent soft with a coral edge.
    return (
      <PressableHighlight
        accessibilityRole="button"
        accessibilityLabel={t('profile.addLeadPhoto')}
        accessibilityHint={t('profile.addPhotoHint', { position })}
        accessibilityState={{ busy }}
        onPress={onAdd}
        disabled={busy}
        background={theme.accentWash}
        style={[styles.slot, styles.addSlot, size, { boxShadow: `inset 0 0 0 1.5px ${theme.accent}` }]}>
        {busy ? (
          <ActivityIndicator color={theme.accentText} />
        ) : (
          <Icon name="add" size={28} color={theme.accentText} />
        )}
        {/* The slot keeps its size, so the label shrinks rather than overflow it. */}
        <ThemedText
          type="headline"
          themeColor="accentText"
          numberOfLines={2}
          adjustsFontSizeToFit
          style={[styles.addLabel, styles.addTitle]}>
          {t('profile.firstPhoto')}
        </ThemedText>
        <ThemedText type="caption" themeColor="accentText" style={[styles.addLabel, styles.addNote]}>
          {t('profile.roundSees', { round: 1 })}
        </ThemedText>
      </PressableHighlight>
    );
  }

  if (isNext) {
    return (
      <PressableHighlight
        accessibilityRole="button"
        accessibilityLabel={t('profile.addPhotosLabel')}
        accessibilityHint={t('profile.addPhotoHint', { position })}
        accessibilityState={{ busy }}
        onPress={onAdd}
        disabled={busy}
        background={theme.surface}
        style={[styles.slot, styles.addSlot, size]}>
        {busy ? (
          <ActivityIndicator color={theme.textSecondary} />
        ) : (
          <Icon name="add" size={22} color={theme.textSecondary} />
        )}
      </PressableHighlight>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={t('profile.emptySlot', { position })}
      style={[styles.slot, size, { backgroundColor: theme.surface }]}>
      <Text style={[styles.emptyNumber, { color: theme.textTertiary }]} maxFontSizeMultiplier={1.2}>
        {position}
      </Text>
    </View>
  );
}

type DetailsSectionProps = {
  form: ProfileForm;
  style?: StyleProp<ViewStyle>;
  /** Just the fields, for a screen whose title already introduces them (profile setup). */
  bare?: boolean;
};

/**
 * "About you": first name and city, then height (in your units) beside job or
 * school, then the bio with what is left of its length.
 */
export function DetailsSection({ form, style, bare = false }: DetailsSectionProps) {
  const t = useT();
  const bioLeft = BIO_MAX - form.bio.length;
  const metric = form.height.units === 'metric';
  const job = (
    <TextField
      label={t('profile.jobOrSchool')}
      value={form.job}
      onChangeText={form.setJob}
      maxLength={60}
    />
  );

  const fields = (
    <View style={[styles.fields, bare && style]}>
      <TextField
        label={t('profile.firstName')}
        value={form.name}
        onChangeText={form.setName}
        maxLength={30}
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
      />
      <TextField
        label={t('profile.city')}
        value={form.city}
        onChangeText={form.setCity}
        maxLength={40}
        autoCapitalize="words"
        textContentType="addressCity"
      />
      {/* Checked inline by the ring, icon and message. No error haptic: that's for the save.
          Centimeters fit beside the job; feet and inches need the whole row. */}
      {metric ? (
        <View style={styles.pair}>
          <View style={styles.pairPart}>
            <TextField
              label={t('profile.height')}
              accessibilityLabel={t('profile.heightCmLabel')}
              value={form.height.cm}
              onChangeText={(text) => form.changeHeight('cm', text)}
              onBlur={form.blurHeight}
              keyboardType="number-pad"
              maxLength={3}
              suffix={t('profile.cm')}
              error={form.showHeightError}
              hint={form.showHeightError ? form.heightError : undefined}
            />
          </View>
          <View style={styles.pairPart}>{job}</View>
        </View>
      ) : (
        <>
          <ImperialHeight form={form} />
          {job}
        </>
      )}
      <TextField
        label={t('profile.bio')}
        value={form.bio}
        onChangeText={form.setBio}
        maxLength={BIO_MAX}
        multiline
        placeholder={t('profile.bioPlaceholder')}
        hint={t('profile.bioShown')}
        counter={t('profile.charactersLeft', { count: bioLeft })}
      />
    </View>
  );
  if (bare) return fields;

  return (
    <Section title={t('profile.aboutYou')} style={[styles.section, style]}>
      {fields}
    </Section>
  );
}

/** Height in feet and inches: two fields side by side, under one label and one error. */
function ImperialHeight({ form }: { form: ProfileForm }) {
  const t = useT();
  const error = form.showHeightError ? form.heightError : undefined;

  // The fields don't carry the message themselves, so say a new error once, like TextField does.
  useEffect(() => {
    if (error && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibilityWithOptions(error, { queue: true });
    }
  }, [error]);

  return (
    <View style={styles.heightGroup}>
      {/* Each field says "Height" in its own label, so this one is for the eyes only. */}
      <ThemedText
        type="footnote"
        themeColor="textSecondary"
        accessibilityElementsHidden
        importantForAccessibility="no">
        {t('profile.height')}
      </ThemedText>
      <View style={styles.heightRow}>
        <View style={styles.heightPart}>
          <TextField
            accessibilityLabel={t('profile.heightFeetLabel')}
            value={form.height.feet}
            onChangeText={(text) => form.changeHeight('feet', text)}
            onBlur={form.blurHeight}
            keyboardType="number-pad"
            maxLength={1}
            suffix={t('profile.ft')}
            error={error !== undefined}
            accessibilityHint={error}
          />
        </View>
        <View style={styles.heightPart}>
          <TextField
            accessibilityLabel={t('profile.heightInchesLabel')}
            value={form.height.inches}
            onChangeText={(text) => form.changeHeight('inches', text)}
            onBlur={form.blurHeight}
            keyboardType="number-pad"
            maxLength={2}
            suffix={t('profile.in')}
            error={error !== undefined}
            accessibilityHint={error}
          />
        </View>
      </View>
      {error ? (
        // Keyed, so the error fades in once as it appears, like every other error.
        <Animated.View
          key="error"
          entering={errorEnter}
          accessibilityLiveRegion="polite"
          style={styles.heightError}>
          <ErrorIcon />
          <ThemedText type="footnote" themeColor="danger" style={styles.heightErrorText}>
            {error}
          </ThemedText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
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
  // The next slot to fill: the place to tap.
  addSlot: {
    gap: 8,
    padding: 8,
  },
  addLabel: {
    textAlign: 'center',
  },
  addTitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  addNote: {
    opacity: 0.8,
  },
  emptyNumber: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    lineHeight: 24,
  },
  number: {
    position: 'absolute',
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadTag: {
    top: 10,
    left: 10,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  smallTag: {
    top: 8,
    left: 8,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  tagText: {
    fontSize: 11,
    lineHeight: 13,
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
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fields: {
    gap: 16,
  },
  pair: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  pairPart: {
    flex: 1,
  },
  // Matches TextField's own label-to-box spacing.
  heightGroup: {
    gap: 6,
  },
  heightRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heightPart: {
    flex: 1,
  },
  heightError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  heightErrorText: {
    flexShrink: 1,
  },
});
