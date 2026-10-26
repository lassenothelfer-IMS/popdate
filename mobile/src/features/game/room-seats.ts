/**
 * A player's balloon color in a room. Colors go out in join order (gold, coral,
 * blush, garnet, crimson), and your own balloon is crimson whenever you hold
 * one: you take the last seat color, and the others share the first four.
 */
export function roomSeatIndex(
  contestants: readonly { id: string }[],
  index: number,
  meId: string | null | undefined,
): number {
  const youHold = contestants.some((c) => c.id === meId);
  if (!youHold) return index;
  if (contestants[index]?.id === meId) return 4;
  return contestants.slice(0, index).filter((c) => c.id !== meId).length;
}
