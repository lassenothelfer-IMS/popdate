import { Anonymous } from '@convex-dev/auth/providers/Anonymous';
import { convexAuth } from '@convex-dev/auth/server';

/**
 * Anonymous accounts for now: the phone keeps the session token, and signing
 * out ends that account. Sign in with Apple (Elias) replaces this before submission.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Anonymous],
});
