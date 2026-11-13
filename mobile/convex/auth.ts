import { Anonymous } from '@convex-dev/auth/providers/Anonymous';
import { ConvexCredentials } from '@convex-dev/auth/providers/ConvexCredentials';
import { convexAuth, createAccount, retrieveAccount } from '@convex-dev/auth/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/** Apple's public keys, which sign every identity token. Fetched and cached by jose. */
const appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

/**
 * Who an Apple identity token may be for: the app's bundle id, plus Expo Go's
 * while it is tested there. Set APPLE_AUDIENCES on a deployment to change it.
 */
function appleAudiences() {
  const set = process.env.APPLE_AUDIENCES;
  return set ? set.split(',').map((id) => id.trim()) : ['com.goodn8s.popdate', 'host.exp.Exponent'];
}

/**
 * Sign in with Apple, done natively on the phone: the app sends the identity
 * token Apple gave it, the server checks Apple signed it for this app, and
 * Apple's stable user id (`sub`) is the account. The same Apple ID always
 * comes back to the same account, so this is sign-up and log-in at once.
 */
const Apple = ConvexCredentials({
  id: 'apple',
  authorize: async (credentials, ctx) => {
    const token = credentials.identityToken;
    if (typeof token !== 'string' || !token) throw new Error('Missing Apple identity token.');
    const { payload } = await jwtVerify(token, appleKeys, {
      issuer: 'https://appleid.apple.com',
      audience: appleAudiences(),
    });
    const appleId = payload.sub;
    if (!appleId) throw new Error('Apple sent no user id.');
    try {
      const { user } = await retrieveAccount(ctx, { provider: 'apple', account: { id: appleId } });
      return { userId: user._id };
    } catch {
      // No account for this Apple ID yet: this is a sign-up.
      const { user } = await createAccount(ctx, {
        provider: 'apple',
        account: { id: appleId },
        profile: {},
      });
      return { userId: user._id };
    }
  },
});

/**
 * Sign in with Apple for everyone. Anonymous accounts stay for development
 * only: the app offers them in development builds and on the web preview.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Apple, Anonymous],
});
