import { ConvexAuthProvider, useAuthActions, useConvexAuth } from '@convex-dev/auth/react';
import * as SecureStore from 'expo-secure-store';
import { useEffect, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { convexServer } from '@/api';

/** Convex Auth keeps its tokens in the phone's keychain; the web falls back to localStorage. */
const tokenStorage =
  Platform.OS === 'web'
    ? undefined
    : {
        getItem: SecureStore.getItemAsync,
        setItem: SecureStore.setItemAsync,
        removeItem: SecureStore.deleteItemAsync,
      };

/** Puts the Convex backend under the app when it's switched on; with the mock it adds nothing. */
export function ApiProvider({ children }: { children: ReactNode }) {
  if (!convexServer) return children;
  return (
    <ConvexAuthProvider client={convexServer.client} storage={tokenStorage}>
      <AuthBridge />
      {children}
    </ConvexAuthProvider>
  );
}

/** Hands Convex Auth's sign-in to `api`, which the session calls outside of React. */
function AuthBridge() {
  const actions = useAuthActions();
  const { isLoading, isAuthenticated } = useConvexAuth();

  useEffect(() => {
    convexServer?.attach(actions);
  }, [actions]);

  useEffect(() => {
    convexServer?.setAuthState(isLoading, isAuthenticated);
  }, [isLoading, isAuthenticated]);

  return null;
}
