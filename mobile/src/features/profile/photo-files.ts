import { Directory, File, Paths } from 'expo-file-system';

/**
 * Picked photos, kept in the app's documents until the profile is saved. The
 * picker hands back files in a cache the system may clear at any time (and does
 * after an app update), which would leave the setup draft with dead photos.
 */
const FOLDER = 'profile-photos';

function folder() {
  return new Directory(Paths.document, FOLDER);
}

/** Only real files on the phone are copied; `mock://` photos and the web's blobs stay as they are. */
function isLocalFile(uri: string) {
  return uri.startsWith('file://');
}

/** The file's name, the last part of its URI. */
function nameOf(uri: string) {
  return uri.split('?')[0].split('/').pop() ?? '';
}

/**
 * Copies a photo the picker just handed back into the app's documents and
 * returns the copy's URI. If it can't be copied, the original is kept.
 */
export async function keepPickedPhoto(uri: string): Promise<string> {
  if (!isLocalFile(uri)) return uri;
  try {
    const target = folder();
    target.create({ intermediates: true, idempotent: true });
    const source = new File(uri);
    const copy = new File(target, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${source.extension}`);
    await source.copy(copy);
    return copy.uri;
  } catch {
    return uri;
  }
}

/**
 * A kept photo's current URI, or null when its file is gone. iOS moves the
 * app's folder on an update, so a copy is looked up again by its name.
 */
export function livePhoto(uri: string): string | null {
  if (!isLocalFile(uri)) return uri;
  try {
    if (new File(uri).exists) return uri;
    const moved = new File(folder(), nameOf(uri));
    return moved.exists ? moved.uri : null;
  } catch {
    return null;
  }
}

/**
 * Deletes the kept copies a saved profile no longer uses. On Convex the saved
 * photos are server URLs, so every copy goes; the mock keeps using the ones it saved.
 */
export function removeUnusedPhotos(keep: readonly string[]) {
  try {
    const target = folder();
    if (!target.exists) return;
    const used = new Set(keep.filter(isLocalFile).map(nameOf));
    for (const entry of target.list()) {
      if (entry instanceof File && !used.has(entry.name)) entry.delete();
    }
  } catch {
    // Left for the next save to clean up.
  }
}
