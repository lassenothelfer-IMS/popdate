/**
 * The chat's rules, shared by the app, the mock server and the Convex backend:
 * which reactions exist, how long "typing" lasts, when a reply hangs on the
 * message it answers, and how a link's preview is read from its page.
 */

/** The reactions a message can get. One per person per message. */
export const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'] as const;
export type Reaction = (typeof REACTIONS)[number];

export function isReaction(value: string): value is Reaction {
  return (REACTIONS as readonly string[]).includes(value);
}

/** "Typing" shows for this long after the last keystroke the server heard of. */
export const TYPING_MS = 6000;
/** While you type, the app tells the server at most this often. */
export const TYPING_PING_MS = 2500;

/**
 * A reply hangs on the corner of the message it answers while that message is
 * still close by: at most this many other messages between the two. Further
 * apart, nobody would see it up there, so it is a bubble of its own with the
 * answered line quoted over it.
 */
export const REPLY_REACH = 8;

/** A chat is "your turn" once their last message has waited this long; the nudge goes out once. */
export const NUDGE_AFTER_MS = 24 * 60 * 60_000;

/** A voice message is at most this long, and at least long enough to say something. */
export const MAX_VOICE_MS = 60_000;
export const MIN_VOICE_MS = 800;
/** How many bars a voice message's waveform has. */
export const VOICE_BARS = 32;
/** A minute of speech at the app's recording quality is well under this. */
export const MAX_VOICE_BYTES = 3 * 1024 * 1024;

/** A voice message as the app plays it: where the audio is, how long, and its loudness over time, 0 to 1. */
export type VoiceNote = { url: string; durationMs: number; waveform: number[] };

/** Loudness samples (0 to 1) thinned to the waveform's bars, each bar the loudest of its stretch. */
export function waveformFrom(levels: readonly number[], bars = VOICE_BARS): number[] {
  if (levels.length === 0) return Array.from({ length: bars }, () => 0.2);
  return Array.from({ length: bars }, (_, i) => {
    const from = Math.floor((i * levels.length) / bars);
    const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / bars));
    const peak = Math.max(...levels.slice(from, to));
    return Math.round(Math.min(1, Math.max(0.08, peak)) * 100) / 100;
  });
}

/** "0:07", "1:00". */
export function voiceTime(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** What a link shows under the message that holds it. */
export type LinkPreview = {
  url: string;
  /** The page's title, or its host when the page gives none. */
  title: string;
  description?: string;
  image?: string;
  /** The site's name or host, like "youtube.com". */
  site: string;
};

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/i;

/** The first web link in a message, without the punctuation a sentence ends on. */
export function firstUrl(text: string): string | null {
  const match = URL_PATTERN.exec(text);
  return match ? match[0].replace(/[.,!?;:]+$/, '') : null;
}

/** A message cut into plain text and links, in order, for drawing the links tappable. */
export function splitLinks(text: string): { text: string; url?: string }[] {
  const parts: { text: string; url?: string }[] = [];
  let rest = text;
  for (;;) {
    const match = URL_PATTERN.exec(rest);
    if (!match) break;
    const url = match[0].replace(/[.,!?;:]+$/, '');
    if (match.index > 0) parts.push({ text: rest.slice(0, match.index) });
    parts.push({ text: url, url });
    rest = rest.slice(match.index + url.length);
  }
  if (rest) parts.push({ text: rest });
  return parts;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Only public web addresses are fetched: no local names, no bare IP addresses. */
export function isPublicUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  // A bare IPv4 or IPv6 address is never a page someone means to share.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return false;
  return true;
}

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The `content` of a page's `<meta property="og:title">`, or of `name="description"`, and so on. */
function metaContent(html: string, key: string) {
  const tag = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i').exec(html)?.[0];
  if (!tag) return undefined;
  const content = /content=["']([^"']*)["']/i.exec(tag)?.[1];
  return content ? decodeEntities(content) : undefined;
}

/** A link's preview with nothing fetched: just the host. */
export function bareLinkPreview(url: string): LinkPreview {
  const site = hostOf(url);
  return { url, title: site, site };
}

/** Reads a page's title, description and image from its HTML. */
export function linkPreviewFromHtml(url: string, html: string): LinkPreview {
  const site = metaContent(html, 'og:site_name') ?? hostOf(url);
  const pageTitle = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1];
  const title = metaContent(html, 'og:title') ?? (pageTitle ? decodeEntities(pageTitle) : '') ?? '';
  const description = metaContent(html, 'og:description') ?? metaContent(html, 'description');
  let image = metaContent(html, 'og:image');
  if (image) {
    try {
      image = new URL(image, url).toString();
    } catch {
      image = undefined;
    }
  }
  return {
    url,
    title: (title || site).slice(0, 140),
    description: description?.slice(0, 200),
    image: image && isPublicUrl(image) ? image : undefined,
    site: site.slice(0, 60),
  };
}

/** How much of a page is read for its preview, and how long it may take. */
const PREVIEW_BYTES = 200_000;
const PREVIEW_TIMEOUT_MS = 5000;

/**
 * Fetches a link's preview. Null when the link isn't a public page, takes too
 * long, or isn't HTML: the message then shows without a card.
 */
export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  if (!isPublicUrl(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PREVIEW_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; PopdateLinkPreview/1.0)' },
    });
    if (!response.ok) return null;
    if (!(response.headers.get('content-type') ?? '').includes('text/html')) return null;
    const html = (await response.text()).slice(0, PREVIEW_BYTES);
    return linkPreviewFromHtml(url, html);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Whether a reply still hangs on the message it answers. `order` is the chat's
 * message ids, oldest first.
 */
export function replyHangs(order: readonly string[], replyId: string, targetId: string) {
  const at = order.indexOf(replyId);
  const target = order.indexOf(targetId);
  return target >= 0 && at > target && at - target - 1 <= REPLY_REACH;
}
