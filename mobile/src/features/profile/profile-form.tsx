import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextInputInstance,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { api, convexServer, type Units } from '@/api';
import { MAX_PHOTOS, MIN_PHOTOS } from '@/api/types';
import { ErrorIcon, ErrorLine, errorEnter } from '@/components/error-line';
import { Icon } from '@/components/icon';
import { Photo, type PhotoTone } from '@/components/photo';
import { PressableHighlight } from '@/components/pressable-highlight';
import { PressableScale } from '@/components/pressable-scale';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Gutter, MaxContentWidth, MinTouch, PhotoGlass, Radius, Velvet } from '@/constants/theme';
import { useChoice } from '@/features/chat/prompts';
import { asSexuality, type Sexuality } from '@/features/profile/identity';
import { keepPickedPhoto, livePhoto } from '@/features/profile/photo-files';
import { useSeats, useTheme, youSeat } from '@/hooks/use-theme';
import { useT, type Translate, type TranslationKey } from '@/i18n';
import {
  cleanInterests,
  cleanLanguages,
  MAX_INTERESTS,
  MAX_LANGUAGES,
  type InterestTag,
  type LanguageTag,
} from '@/shared/profile-tags';
import type { ProfileDetails } from '@/state/session';
import { useSettings } from '@/state/settings';
import { readJson, writeJson } from '@/utils/device-store';
import { haptics } from '@/utils/haptics';
import { cmToFeetInches, feetInchesToCm, formatHeight } from '@/utils/units';

/** Slots in the grid. Four photos are enough to play; the last two are optional. */
export const PHOTO_COUNT = MAX_PHOTOS;
/** One photo per round, in order. Photos past these are extras no round reveals. */
const ROUND_PHOTOS = MIN_PHOTOS;
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

const ADD_DETAIL: Record<Detail, TranslationKey> = {
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
/** What profile setup keeps on the device while you fill it in. */
type SetupDraft = {
  photos: string[];
  name: string;
  city: string;
  height: HeightEntry;
  job: string;
  bio: string;
  genderDetails: string;
  sexuality: Sexuality | null;
  interests: InterestTag[];
  languages: LanguageTag[];
};

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

/**
 * A draft read back from the device, checked field by field: an older app
 * version (or a broken write) may have left anything there. A missing field
 * comes back empty, and photos whose file is gone are dropped.
 */
function checkedDraft(value: unknown, units: Units): SetupDraft | null {
  if (!value || typeof value !== 'object') return null;
  const draft = value as Partial<Record<keyof SetupDraft, unknown>>;
  const height = (draft.height && typeof draft.height === 'object' ? draft.height : {}) as Partial<
    Record<keyof HeightEntry, unknown>
  >;
  const photos = Array.isArray(draft.photos) ? draft.photos : [];
  return {
    photos: photos
      .map((uri) => (typeof uri === 'string' ? livePhoto(uri) : null))
      .filter((uri) => uri !== null)
      .slice(0, PHOTO_COUNT),
    name: text(draft.name),
    city: text(draft.city),
    height: {
      units: height.units === 'metric' || height.units === 'imperial' ? height.units : units,
      cm: digitsOnly(text(height.cm)).slice(0, 3),
      feet: digitsOnly(text(height.feet)).slice(0, 1),
      inches: digitsOnly(text(height.inches)).slice(0, 2),
    },
    job: text(draft.job),
    bio: text(draft.bio).slice(0, BIO_MAX),
    genderDetails: text(draft.genderDetails),
    sexuality: asSexuality(typeof draft.sexuality === 'string' ? draft.sexuality : undefined),
    interests: cleanInterests(draft.interests),
    languages: cleanLanguages(draft.languages),
  };
}

/**
 * A failed save in words: the server's own message when it wrote one for you
 * (like "You need to be 18 or older."), and the generic line for anything else,
 * like a dropped connection.
 */
export function saveFailedMessage(t: Translate, error: unknown) {
  // Server and mock messages are plain Errors; a TypeError and the like are the app's own faults.
  if (error instanceof Error && error.name === 'Error' && error.message && error.message !== GENERIC_ERROR) {
    return error.message;
  }
  return t('profile.saveFailed');
}

/** What the Convex server says when its error wasn't written for you. */
const GENERIC_ERROR = 'Something went wrong. Try again.';

/**
 * `draftKey`: keep the form on the device as you go and bring it back on the
 * next launch, for profile setup, where nothing is saved to the server yet.
 */
export function useProfileForm(initial: ProfileDetails | null, { draftKey }: { draftKey?: string } = {}) {
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
  const [interests, setInterests] = useState(() => cleanInterests(initial?.interests));
  const [languages, setLanguages] = useState(() => cleanLanguages(initial?.languages));
  // Bring back a draft from an earlier launch, then keep it up to date.
  const draftRestored = useRef(!draftKey);
  // Set by every change you make. A draft that arrives after you started typing doesn't overwrite it.
  const touched = useRef(false);
  useEffect(() => {
    if (!draftKey) return;
    let live = true;
    void readJson<unknown>(draftKey).then((stored) => {
      if (!live) return;
      const draft = checkedDraft(stored, units);
      if (draft && !touched.current) {
        setPhotos(draft.photos);
        setName(draft.name);
        setCity(draft.city);
        setTypedHeight(draft.height);
        setJob(draft.job);
        setBio(draft.bio);
        setGenderDetails(draft.genderDetails);
        setSexuality(draft.sexuality);
        setInterests(draft.interests);
        setLanguages(draft.languages);
      }
      draftRestored.current = true;
    });
    return () => {
      live = false;
    };
  }, [draftKey, units]);

  /** A setter that also marks the form as changed by you. */
  function touching<T>(set: (value: T) => void) {
    return (value: T) => {
      touched.current = true;
      set(value);
    };
  }
  useEffect(() => {
    if (!draftKey) return;
    const timer = setTimeout(() => {
      if (!draftRestored.current) return;
      const draft: SetupDraft = {
        photos,
        name,
        city,
        height: typedHeight,
        job,
        bio,
        genderDetails,
        sexuality,
        interests,
        languages,
      };
      void writeJson(draftKey, draft);
    }, 400);
    return () => clearTimeout(timer);
  }, [draftKey, photos, name, city, typedHeight, job, bio, genderDetails, sexuality, interests, languages]);

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

  // Height, job and bio are optional; a height you start typing has to make sense.
  const missingDetails = (
    [
      !name.trim() && 'name',
      !city.trim() && 'city',
      heightTyped && !heightValid && 'height',
    ] as const
  ).filter((detail) => detail !== false);
  const detailsDone = missingDetails.length === 0;
  /** Photos still needed to play (the minimum, not every slot). */
  const photosLeft = Math.max(0, MIN_PHOTOS - photos.length);
  const complete = photosLeft === 0 && detailsDone;
  const savedHeight = heightTyped ? heightCm : null;

  const details: ProfileDetails | null = complete
      ? {
          name: name.trim(),
          city: city.trim(),
          heightCm: savedHeight,
          job: job.trim(),
          bio: bio.trim(),
          genderDetails: genderDetails.trim() || undefined,
          sexuality: sexuality ?? undefined,
          interests,
          languages,
          photos,
        }
      : null;

  const before = start.details;
  const changed =
    !before ||
    photos.join('\n') !== before.photos.join('\n') ||
    name.trim() !== before.name.trim() ||
    city.trim() !== before.city.trim() ||
    savedHeight !== before.heightCm ||
    job.trim() !== before.job.trim() ||
    bio.trim() !== before.bio.trim() ||
    genderDetails.trim() !== (before.genderDetails ?? '').trim() ||
    sexuality !== asSexuality(before.sexuality) ||
    interests.join() !== cleanInterests(before.interests).join() ||
    languages.join() !== cleanLanguages(before.languages).join();

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
        // Hand back each photo as stored, without decoding and re-saving it as a JPEG:
        // the picker then only copies the files, which is what makes picking six fast.
        quality: 1,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
        // Most iPhone photos are Live Photos, often kept in iCloud only. Without this
        // the first pick of one fails, and only a second try finds it downloaded.
        shouldDownloadFromNetwork: true,
      });
      if (result.canceled) return;
      touched.current = true;
      // Only as many as there are free slots; the picker's limit isn't kept everywhere.
      const picked = result.assets.slice(0, PHOTO_COUNT - photos.length);
      // Copied out of the picker's cache, which the system may clear before the profile is saved.
      const kept = await Promise.all(picked.map((asset) => keepPickedPhoto(asset.uri)));
      // Start the uploads now, so saving the profile has little left to wait for.
      kept.forEach((uri) => api.preparePhoto(uri));
      setPhotos((current) => [...current, ...kept].slice(0, PHOTO_COUNT));
    } catch {
      const message = t('profile.photosFailed');
      setPhotoError(message);
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      setPicking(false);
    }
  }

  function removePhoto(index: number) {
    touched.current = true;
    setPhotoError(null);
    const next = photos.filter((_, i) => i !== index);
    setPhotos(next);
    // Its early upload is no longer needed.
    convexServer?.forgetPhotos(next);
  }

  /**
   * Moves a photo to another place in the order. Its upload is keyed by its file, so nothing restarts.
   * From the current list, since the menu that asks for it waits while photos may still arrive.
   */
  function movePhoto(from: number, to: number) {
    if (from === to || to < 0 || to >= photos.length) return;
    touched.current = true;
    setPhotoError(null);
    setPhotos((current) => {
      if (from >= current.length || to >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  /** Picks a tag, or takes a picked one off again. A sixth isn't added. */
  function toggled<T>(picked: T[], tag: T, max: number) {
    if (picked.includes(tag)) return picked.filter((other) => other !== tag);
    return picked.length < max ? [...picked, tag] : picked;
  }
  function toggleInterest(tag: InterestTag) {
    touched.current = true;
    setInterests((picked) => toggled(picked, tag, MAX_INTERESTS));
  }
  function toggleLanguage(tag: LanguageTag) {
    touched.current = true;
    setLanguages((picked) => toggled(picked, tag, MAX_LANGUAGES));
  }

  function changeHeight(part: 'cm' | 'feet' | 'inches', value: string) {
    touched.current = true;
    setTypedHeight({ ...height, [part]: digitsOnly(value) });
  }

  return {
    photos,
    setPhotos: touching(setPhotos),
    addPhotos,
    picking,
    photoError,
    removePhoto,
    movePhoto,
    name,
    setName: touching(setName),
    city,
    setCity: touching(setCity),
    height,
    changeHeight,
    blurHeight: () => setHeightBlurred(true),
    showHeightError,
    heightError: heightRangeMessage(t, height.units),
    job,
    setJob: touching(setJob),
    bio,
    setBio: touching(setBio),
    genderDetails,
    setGenderDetails: touching(setGenderDetails),
    sexuality,
    setSexuality: touching(setSexuality),
    interests,
    toggleInterest,
    languages,
    toggleLanguage,
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
  const { choose, sheet } = useChoice();

  /** The menu for one photo: the moves that make sense from where it is. */
  async function arrange(index: number) {
    const moves = photoMoves(index, photos.length);
    if (moves.length === 0) return;
    const picked = await choose({
      title: t('profile.photoMenuTitle', { position: index + 1 }),
      choices: moves.map((move) => ({ label: t(MOVE_LABEL[move.name]) })),
    });
    if (picked !== null) form.movePhoto(index, moves[picked].to);
  }

  function slot(index: number) {
    return (
      <PhotoSlot
        key={index}
        index={index}
        size={index === 0 ? leadSize : smallSize}
        uri={photos[index]}
        count={photos.length}
        isNext={index === photos.length}
        busy={form.picking}
        name={form.name.trim()}
        tone={tone}
        onAdd={form.addPhotos}
        onRemove={() => form.removePhoto(index)}
        onArrange={() => void arrange(index)}
        onMove={(to) => {
          // The menu already ticks when you pick; VoiceOver's actions skip it, so they tick here.
          haptics.light();
          form.movePhoto(index, to);
        }}
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
      {photos.length > 1 ? (
        <ThemedText type="footnote" themeColor="textSecondary">
          {t('profile.reorderHint')}
        </ThemedText>
      ) : null}
      {form.photoError ? <ErrorLine message={form.photoError} /> : null}
      {sheet}
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

type MoveName = 'makeFirst' | 'moveEarlier' | 'moveLater';

const MOVE_LABEL: Record<MoveName, TranslationKey> = {
  makeFirst: 'profile.makeFirst',
  moveEarlier: 'profile.moveEarlier',
  moveLater: 'profile.moveLater',
};

/**
 * Where the photo at `index` can go: to the front, one earlier, one later.
 * Photo 2 only gets "Make first", which is the same as one earlier.
 */
function photoMoves(index: number, count: number): { name: MoveName; to: number }[] {
  const moves: { name: MoveName; to: number }[] = [];
  if (index >= 1) moves.push({ name: 'makeFirst', to: 0 });
  if (index >= 2) moves.push({ name: 'moveEarlier', to: index - 1 });
  if (index < count - 1) moves.push({ name: 'moveLater', to: index + 1 });
  return moves;
}

type PhotoSlotProps = {
  index: number;
  /** How many photos are in the grid, for the moves this one can make. */
  count: number;
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
  /** Opens the menu to move this photo: a tap or a long press. */
  onArrange: () => void;
  /** Moves it straight away, for VoiceOver's actions. */
  onMove: (to: number) => void;
};

/** One slot of the photo grid: filled, the next one to add, or a quiet numbered placeholder. */
function PhotoSlot({
  index,
  count,
  size,
  uri,
  isNext,
  busy,
  name,
  tone,
  onAdd,
  onRemove,
  onArrange,
  onMove,
}: PhotoSlotProps) {
  const t = useT();
  const theme = useTheme();
  const position = index + 1;
  const lead = index === 0;

  if (uri) {
    const round = index < ROUND_PHOTOS ? index + 1 : null;
    const moves = photoMoves(index, count);
    return (
      <View style={[styles.slot, size]}>
        {/* The photo itself opens the menu to move it; VoiceOver gets the moves as actions. */}
        <PressableScale
          accessibilityRole={moves.length > 0 ? 'button' : 'image'}
          accessibilityLabel={
            round
              ? t('profile.yourPhotoRound', { position, round })
              : t('profile.yourPhotoExtra', { position })
          }
          accessibilityHint={moves.length > 0 ? t('profile.reorderA11yHint') : undefined}
          accessibilityActions={moves.map((move) => ({ name: move.name, label: t(MOVE_LABEL[move.name]) }))}
          onAccessibilityAction={(event) => {
            const move = moves.find((option) => option.name === event.nativeEvent.actionName);
            if (move) onMove(move.to);
          }}
          // A lone photo has nowhere to go: no menu, but no "dimmed" for VoiceOver either.
          onPress={moves.length > 0 ? onArrange : undefined}
          onLongPress={moves.length > 0 ? onArrange : undefined}
          containerStyle={StyleSheet.absoluteFill}
          style={StyleSheet.absoluteFill}>
          <Photo
            uri={uri}
            name={name}
            tone={tone}
            initialSize={lead ? 56 : 32}
            style={StyleSheet.absoluteFill}
          />
          {/* The order is the point of this grid, so every photo says which round sees it,
              or that it's an extra; the lead also says it's your face. The lead on the text
              color; the rest on dark glass. */}
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
              numberOfLines={1}
              style={[styles.tagText, { color: lead ? theme.onInverse : Velvet.cream }]}>
              {lead
                ? t('profile.faceTag')
                : round
                  ? t('profile.roundTag', { round })
                  : t('profile.extraTag')}
            </ThemedText>
          </View>
        </PressableScale>
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
    // The first photo, your face for round 1: the one place to tap, on accent soft with a coral edge.
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
          {t('profile.facePhoto')}
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
      <Text style={[styles.emptyNumber, { color: theme.textSecondary }]} maxFontSizeMultiplier={1.2}>
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
  // Next on the keyboard walks name, city, height, job, then the bio.
  const cityRef = useRef<TextInputInstance>(null);
  const heightRef = useRef<TextInputInstance>(null);
  const jobRef = useRef<TextInputInstance>(null);
  const bioRef = useRef<TextInputInstance>(null);
  const job = (
    <TextField
      ref={jobRef}
      label={t('profile.optionalLabel', { label: t('profile.jobOrSchool') })}
      value={form.job}
      onChangeText={form.setJob}
      maxLength={60}
      returnKeyType="next"
      submitBehavior="submit"
      onSubmitEditing={() => bioRef.current?.focus()}
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
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => cityRef.current?.focus()}
      />
      <TextField
        ref={cityRef}
        label={t('profile.city')}
        value={form.city}
        onChangeText={form.setCity}
        maxLength={40}
        autoCapitalize="words"
        textContentType="addressCity"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => (metric ? heightRef : jobRef).current?.focus()}
      />
      {/* Checked inline by the ring, icon and message. No error haptic: that's for the save.
          Centimeters fit beside the job; feet and inches need the whole row. */}
      {metric ? (
        <View style={styles.pair}>
          <View style={styles.pairPart}>
            <TextField
              ref={heightRef}
              label={t('profile.optionalLabel', { label: t('profile.height') })}
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
        ref={bioRef}
        label={t('profile.optionalLabel', { label: t('profile.bio') })}
        value={form.bio}
        onChangeText={form.setBio}
        maxLength={BIO_MAX}
        multiline
        placeholder={t('profile.bioPlaceholder')}
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
