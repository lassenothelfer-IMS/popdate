import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Contestant } from '@/api';
import { Gutter, type Seat } from '@/constants/theme';
import { AnswerCarousel } from '@/features/game/answer-carousel';
import { TIGHT_SPACING, CANVAS_SPACING } from '@/features/game/reveal-layout';
import { MyPhoto } from '@/features/game/room-blocks';
import { questionIn } from '@/features/game/room-motion';
import { photoKey } from '@/features/game/use-photo-develop';

type RevealSectionProps = {
  /** Your own photo, while it shows to the chooser. */
  myPhoto: Contestant | null;
  /** The chooser's answer cards are showing. */
  revealing: boolean;
  /** Balloons still up: the cards. */
  up: Contestant[];
  seatOf: (contestant: Contestant) => Seat;
  developed: ReadonlySet<string> | null;
  cardWidth: number;
  tight: boolean;
  markedId: string | null;
  onSelect: ((id: string) => void) | undefined;
  onCardsInView: (ids: string[]) => void;
  onCardsLayout: (event: LayoutChangeEvent) => void;
  onMyPhotoLayout: (event: LayoutChangeEvent) => void;
};

/** The popping phase's photos: yours for a contestant, the answer cards for the chooser. */
export function RevealSection(props: RevealSectionProps) {
  const { myPhoto, up, seatOf, developed } = props;
  return (
    <>
      {myPhoto ? (
        <View key="my-photo" style={styles.myPhoto} onLayout={props.onMyPhotoLayout}>
          <Animated.View entering={questionIn}>
            <MyPhoto
              uri={myPhoto.photos[myPhoto.photos.length - 1]}
              name={myPhoto.name}
              tone={seatOf(myPhoto)}
              position={myPhoto.photos.length}
              developed={!!developed?.has(photoKey(myPhoto))}
            />
          </Animated.View>
        </View>
      ) : null}

      {props.revealing ? (
        // The cards run edge to edge, so the next one peeks in from the side.
        <View
          key="cards"
          style={[styles.cards, props.tight && styles.cardsTight]}
          onLayout={props.onCardsLayout}>
          <Animated.View entering={questionIn}>
            <AnswerCarousel
              cards={up.map((contestant) => ({
                contestant,
                seat: seatOf(contestant),
                developed: !!developed?.has(photoKey(contestant)),
              }))}
              width={props.cardWidth}
              markedId={props.markedId}
              onSelect={props.onSelect}
              onVisibleChange={props.onCardsInView}
              pair={up.length === 2}
            />
          </Animated.View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  myPhoto: {
    marginTop: 14,
  },
  /** Edge to edge; the carousel keeps 2pt above its cards for the marked ring. */
  cards: {
    marginTop: CANVAS_SPACING.cards,
    marginHorizontal: -Gutter,
  },
  cardsTight: {
    marginTop: TIGHT_SPACING.cards,
  },
});
