/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, SeatColors, type Seat } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOptionalSettings } from '@/state/settings';

/** Light or dark: your Appearance setting, or the phone's when it follows the system. */
export function useScheme(): 'light' | 'dark' {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const appearance = useOptionalSettings()?.settings.appearance ?? 'system';
  return appearance === 'system' ? system : appearance;
}

export function useTheme() {
  return Colors[useScheme()];
}

/** The five seat hues for the current mode, in seat order. */
export function useSeats(): readonly Seat[] {
  return SeatColors[useScheme()];
}

/** The hue for a seat index, wrapping past five. */
export function seatAt(seats: readonly Seat[], index: number): Seat {
  return seats[((index % seats.length) + seats.length) % seats.length];
}

/** Your own hue outside a room (your profile, Home): plum, as the canvas draws you. */
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
