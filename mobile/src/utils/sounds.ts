import { requireOptionalNativeModule } from 'expo';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/**
 * The app's only two sounds (design/DESIGN.md section 7): the pop and the
 * match sting, played with their haptics. On unless you turn them off in
 * Settings, which is kept on this phone only. On an iPhone they follow the
 * ringer switch: in silent mode they stay quiet. An Expo Go without the audio
 * module plays nothing rather than crash.
 */
const KEY = 'popdate.sounds';

type Sound = 'pop' | 'match';

const SOURCES: Record<Sound, number> = {
  pop: require('../../assets/sounds/pop.wav') as number,
  match: require('../../assets/sounds/match.wav') as number,
};

const audioAvailable = Platform.OS === 'web' || requireOptionalNativeModule('ExpoAudio') !== null;

type AudioModule = typeof import('expo-audio');
type Player = ReturnType<AudioModule['createAudioPlayer']>;

/** Loaded on first use, and only where the module exists. */
let audio: AudioModule | null = null;
const players = new Map<Sound, Player>();
/** Set once per launch: effects mix with other apps' audio and respect the ringer switch. */
let modeSet = false;

function player(sound: Sound): Player | null {
  if (!audioAvailable) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only where the audio module exists, or the room would crash without it
    audio ??= require('expo-audio') as AudioModule;
    if (!modeSet) {
      modeSet = true;
      void audio
        .setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' })
        .catch(() => {});
    }
    let found = players.get(sound);
    if (!found) {
      found = audio.createAudioPlayer(SOURCES[sound]);
      players.set(sound, found);
    }
    return found;
  } catch {
    return null;
  }
}

let on: boolean | null = null;
const listeners = new Set<() => void>();

async function read(): Promise<boolean> {
  try {
    const raw =
      Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    return raw !== 'off';
  } catch {
    return true;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (on === null) {
    void read().then((value) => {
      on = value;
      emit();
    });
  }
  return () => listeners.delete(listener);
}

/** Whether the pop and match sounds are on. True until the stored choice has loaded. */
export function useSoundsOn() {
  return useSyncExternalStore(
    subscribe,
    () => on ?? true,
    () => true,
  );
}

export async function setSoundsOn(value: boolean) {
  on = value;
  emit();
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, value ? 'on' : 'off');
    else await SecureStore.setItemAsync(KEY, value ? 'on' : 'off');
  } catch {
    // Not saved: the choice holds until the app restarts.
  }
}

function play(sound: Sound) {
  if (on === false) return;
  const found = player(sound);
  if (!found) return;
  try {
    // Back to the start, so a pop right after the last one plays in full. Only
    // once the file is loaded: iOS throws on a seek before that, and the throw
    // takes the whole app down (it did, at the first pop of a room). Not loaded
    // yet, it hasn't played either, so it starts at the beginning anyway.
    if (found.isLoaded) void found.seekTo(0).catch(() => {});
    found.play();
  } catch {
    // A sound that can't play is never worth an error.
  }
}

export const sounds = {
  /** Loads both sounds ahead, so the first pop of a room is ready when it bursts. */
  prepare: () => {
    if (on === false) return;
    player('pop');
    player('match');
  },
  /** The burst of a balloon, with `haptics.pop()`. */
  pop: () => play('pop'),
  /** The match opening, with `haptics.success()`. */
  match: () => play('match'),
};

// Read the stored choice early, so the first pop of a session already knows it.
void read().then((value) => {
  if (on === null) {
    on = value;
    emit();
  }
});
