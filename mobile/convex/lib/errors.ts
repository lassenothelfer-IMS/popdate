import { ConvexError } from 'convex/values';

/**
 * Stops the function with a message the player may see. Convex hides the
 * message of a plain `Error` from clients in production; a `ConvexError` keeps it.
 */
export function fail(message: string): never {
  throw new ConvexError(message);
}
