import { Colors, SeatColors, type Seat } from '@/constants/theme';

/** The app's one palette: light. */
export function useTheme() {
  return Colors;
}

/** The five seat hues, in seat order. */
export function useSeats(): readonly Seat[] {
  return SeatColors;
}

/** The hue for a seat index, wrapping past five. */
export function seatAt(seats: readonly Seat[], index: number): Seat {
  return seats[((index % seats.length) + seats.length) % seats.length];
}

/** Your own hue outside a room (your profile, Home): crimson, as your balloon always is. */
export function youSeat(seats: readonly Seat[]): Seat {
  return seats[seats.length - 1];
}

/** A stable hue for someone outside a room (Home, your profile, a match), from their id. */
export function seatFor(seats: readonly Seat[], id: string | null | undefined): Seat {
  if (!id) return seats[seats.length - 1];
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return seatAt(seats, Math.abs(hash));
}
