import { useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import type { Contestant, Room } from '@/api';
import { PhotoAspect } from '@/constants/theme';
import { cardPhotoBox } from '@/features/game/answer-carousel';
import { MY_PHOTO_FRAME } from '@/features/game/room-blocks';

/** One key per revealed photo, so each new photo develops once. */
export function photoKey(contestant: Contestant) {
  return `${contestant.id}:${contestant.photos.length}`;
}

/** The photos showing in the room right now. */
function shownPhotoKeys(room: Room) {
  if (room.status !== 'popping' && room.status !== 'finished') return [];
  return room.contestants.filter((c) => !c.popped && c.photos.length > 0).map(photoKey);
}

/** Where the photos are this render, for working out which are in view. */
type PhotoGeometry = {
  room: Room;
  /** The chooser's answer cards are showing. */
  revealing: boolean;
  cardWidth: number;
  /** Where the cards start before they are measured. */
  cardsAt: number;
  /** Your own photo, while it shows. */
  myPhoto: Contestant | null;
  /** The page as the window leaves it, before the scroll is measured. */
  fallbackViewport: number;
};

/**
 * The photo reveal: each new photo develops once at least half of it is in view,
 * so the reveal happens where the eye is. Photos already out when the room loads
 * (a reload) render still. Also keeps where the answer cards are, and which of
 * them are in view, per round.
 */
export function usePhotoDevelop(room: Room | null | undefined) {
  /** Photos that have developed. Null until the room first loads. */
  const [developed, setDeveloped] = useState<ReadonlySet<string> | null>(null);
  /** Where the answer cards start on the page, per round. */
  const [cardsTop, setCardsTop] = useState<{ round: number; y: number } | null>(null);
  /** The answer cards at least half in view, per round. The rail dims the others. */
  const [inView, setInView] = useState<{ round: number; ids: string[] } | null>(null);
  // Where things are in the scroll, for the photo reveal.
  // Written and read in effects and event handlers only.
  const scrollY = useRef(0);
  const viewport = useRef(0);
  const cardsY = useRef<number | null>(null);
  const visibleCards = useRef<string[]>([]);
  const myPhotoBox = useRef<{ y: number; width: number } | null>(null);

  // Only the photos revealed while you are here develop.
  if (room && developed === null) {
    setDeveloped(new Set(shownPhotoKeys(room)));
  }

  /** The room comes back as it is now: photos already out don't develop again. */
  function keepShown(current: Room) {
    setDeveloped((keys) => new Set([...(keys ?? []), ...shownPhotoKeys(current)]));
  }

  /** The handlers for this render's layout. Only sets state when a photo crosses the line. */
  function handlers(geometry: PhotoGeometry) {
    const { room: shown, revealing, cardWidth, cardsAt, myPhoto } = geometry;

    function developVisible() {
      // Before the first measure, the page as the window leaves it, so a photo never
      // waits on a layout event to show.
      const view = viewport.current || geometry.fallbackViewport;
      const top = scrollY.current;
      const bottom = top + view;
      const fresh: string[] = [];
      const consider = (key: string, photoTop: number, photoHeight: number) => {
        if (developed?.has(key)) return;
        const seen = Math.min(photoTop + photoHeight, bottom) - Math.max(photoTop, top);
        if (seen >= Math.min(photoHeight, view) / 2) fresh.push(key);
      };
      if (revealing) {
        const box = cardPhotoBox(cardWidth);
        const cardsStart = cardsY.current ?? cardsAt;
        for (const id of visibleCards.current) {
          const contestant = shown.contestants.find((c) => c.id === id);
          if (contestant && contestant.photos.length > 0) {
            consider(photoKey(contestant), cardsStart + box.top, box.height);
          }
        }
      }
      if (myPhoto && myPhotoBox.current) {
        const { y, width } = myPhotoBox.current;
        consider(photoKey(myPhoto), y + MY_PHOTO_FRAME, (width - 2 * MY_PHOTO_FRAME) / PhotoAspect);
      }
      if (fresh.length === 0) return;
      setDeveloped((current) => {
        if (fresh.every((key) => current?.has(key))) return current;
        return new Set([...(current ?? []), ...fresh]);
      });
    }

    return {
      onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
        const { contentOffset, layoutMeasurement } = event.nativeEvent;
        scrollY.current = contentOffset.y;
        viewport.current = layoutMeasurement.height;
        developVisible();
      },
      onScrollLayout(event: LayoutChangeEvent) {
        viewport.current = event.nativeEvent.layout.height;
        developVisible();
      },
      onCardsInView(ids: string[]) {
        visibleCards.current = ids;
        setInView({ round: shown.round, ids });
        developVisible();
      },
      onCardsLayout(event: LayoutChangeEvent) {
        const { y } = event.nativeEvent.layout;
        cardsY.current = y;
        if (cardsTop?.round !== shown.round || cardsTop.y !== y) {
          setCardsTop({ round: shown.round, y });
        }
        developVisible();
      },
      onMyPhotoLayout(event: LayoutChangeEvent) {
        const { y, width } = event.nativeEvent.layout;
        myPhotoBox.current = { y, width };
        developVisible();
      },
    };
  }

  const round = room?.round;
  return {
    developed,
    keepShown,
    /** The scroll offset, which the screen also moves. */
    scrollYRef: scrollY,
    /** Where the cards start, once measured. */
    cardsYRef: cardsY,
    cardsTop: cardsTop && cardsTop.round === round ? cardsTop.y : null,
    inView: inView && inView.round === round ? inView.ids : null,
    handlers,
  };
}
