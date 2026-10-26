import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Says a line out loud on iOS, after whatever VoiceOver is saying already, so
 * neither cuts the other off. VoiceOver ignores accessibilityLiveRegion, which
 * Android and the web keep using for the same lines.
 */
export function announce(text: string) {
  if (Platform.OS === 'ios') {
    AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: true });
  }
}

/** Ends a phrase with a period unless it already ends a sentence. */
export function sentence(text: string) {
  return /[.!?…]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;
}

/**
 * Announces `text` each time it changes to a new line. Never the first one:
 * VoiceOver reads the screen itself when it opens. Null says nothing, as while
 * a pop holds the room and PopNews has the floor. A line that comes back after
 * such a pause, unchanged (a pop or a leave that failed), isn't said again.
 */
export function Announcer({ text }: { text: string | null }) {
  /** The last line said, or the one on screen when it opened. Undefined until then. */
  const said = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (said.current === undefined) {
      said.current = text;
      return;
    }
    if (text === null || text === said.current) return;
    said.current = text;
    announce(text);
  }, [text]);
  return null;
}
