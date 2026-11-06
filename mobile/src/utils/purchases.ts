import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type CustomerInfo } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

import { PLUS_ENTITLEMENT } from '@/shared/balloons';

/**
 * Popdate+, sold through RevenueCat. The paywall and the products are set up in
 * the RevenueCat dashboard; the app only shows them and reads what you own.
 *
 * iOS only for now: Android has no store key yet, and the web sells nothing
 * (purchases.web.ts). The server keeps its own record later, through a webhook.
 */

/** RevenueCat's public keys. They are meant to ship inside the app. */
const KEYS = {
  /** Test Store: fake products and purchases, no App Store needed. RevenueCat refuses it in a release build. */
  test: 'test_AXNNdmKamfVHLnDpUxJxYSSKZCj',
  /** The App Store app `com.goodn8s.popdate`: sandbox in development and TestFlight, real money in the store. */
  appStore: 'appl_tPRduzQnNdgpWCgpAOvYtQDOdvP',
};

/** The RevenueCat offering with the balloon packs (and Popdate+ next to them). */
export const BALLOONS_OFFERING = 'balloons';

/** Whether this build can buy anything. */
export const purchasesAvailable = Platform.OS === 'ios';

/**
 * Development uses the Test Store, so purchases work before App Store Connect has
 * products. `EXPO_PUBLIC_PURCHASES_STORE=app-store` tries the App Store sandbox instead.
 */
function apiKey() {
  if (!__DEV__ || process.env.EXPO_PUBLIC_PURCHASES_STORE === 'app-store') return KEYS.appStore;
  return KEYS.test;
}

let configured = false;

/**
 * Sets the SDK up once. False where nothing can be bought, and when setup throws:
 * a build made before RevenueCat was added has no native module, and that must
 * cost Popdate+ only, never sign-in. The next call tries again.
 */
function ensureConfigured() {
  if (!purchasesAvailable) return false;
  if (!configured) {
    try {
      Purchases.configure({ apiKey: apiKey() });
      configured = true;
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN).catch(() => {});
    } catch {
      return false;
    }
  }
  return true;
}

/** The account last handed to RevenueCat: undefined when unknown (first call, or a failed log-in), null after a sign-out. */
let currentUser: string | null | undefined;
/** The Popdate account purchases must land on, kept even when its log-in failed. */
let wantedUser: string | null = null;

/**
 * Ties purchases to the Popdate account, so Popdate+ follows you to a new phone,
 * and a different account on this phone doesn't get yours. Null on sign-out.
 * Quiet on failure: the next call for that account tries again.
 */
export function setPurchasesUser(userId: string | null) {
  wantedUser = userId;
  if (!ensureConfigured() || userId === currentUser) return;
  currentUser = userId;
  if (userId) {
    Purchases.logIn(userId).catch(() => {
      if (currentUser === userId) currentUser = undefined;
    });
  } else {
    // Always, even after a failed log-in: RevenueCat keeps the last account on the
    // device, and the next person on this phone must not inherit it. Rejects, harmlessly,
    // when nobody was logged in.
    Purchases.logOut().catch(() => {});
  }
}

/**
 * Makes sure RevenueCat is on the signed-in Popdate account before anything is
 * sold: a purchase made on an anonymous RevenueCat id never reaches the server,
 * which credits it by account. Tries a failed log-in again; false if it still fails.
 */
async function onAccount() {
  if (!wantedUser) return false;
  if ((await Purchases.getAppUserID()) === wantedUser) return true;
  try {
    await Purchases.logIn(wantedUser);
    currentUser = wantedUser;
    return true;
  } catch {
    return false;
  }
}

function hasPlus(info: CustomerInfo) {
  return info.entitlements.active[PLUS_ENTITLEMENT] !== undefined;
}

/** Whether you have Popdate+: null until known, and false where nothing can be bought. Follows purchases live. */
export function usePlus(): boolean | null {
  const [plus, setPlus] = useState<boolean | null>(purchasesAvailable ? null : false);

  useEffect(() => {
    if (!ensureConfigured()) return;
    let active = true;
    const listener = (info: CustomerInfo) => {
      if (active) setPlus(hasPlus(info));
    };
    Purchases.getCustomerInfo().then(listener, () => {
      if (active) setPlus(false);
    });
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      active = false;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  return plus;
}

export type PaywallOutcome = 'bought' | 'closed' | 'failed';

/** Shows the Popdate+ paywall from the dashboard. */
export async function showPaywall(): Promise<PaywallOutcome> {
  if (!ensureConfigured()) return 'failed';
  try {
    if (!(await onAccount())) return 'failed';
    const result = await RevenueCatUI.presentPaywall({ displayCloseButton: true });
    if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) return 'bought';
    if (result === PAYWALL_RESULT.ERROR) return 'failed';
    return 'closed';
  } catch {
    return 'failed';
  }
}

/**
 * Shows the balloon packs: the paywall of the `balloons` offering. Resolves with
 * the store product bought, if any, so the mock can credit it; the real server
 * credits packs from RevenueCat's webhook. 'failed' also means no offering is set up yet.
 */
export async function showBalloonShop(): Promise<{ outcome: PaywallOutcome; productId?: string }> {
  if (!ensureConfigured()) return { outcome: 'failed' };
  try {
    if (!(await onAccount())) return { outcome: 'failed' };
    const offering = (await Purchases.getOfferings()).all[BALLOONS_OFFERING];
    if (!offering) return { outcome: 'failed' };
    let productId: string | undefined;
    let restoredPlus = false;
    const result = await RevenueCatUI.presentPaywall({
      offering,
      displayCloseButton: true,
      callbacks: {
        onPurchaseCompleted: ({ storeTransaction }) => {
          productId = storeTransaction.productIdentifier;
        },
        onRestoreCompleted: ({ customerInfo }) => {
          restoredPlus = hasPlus(customerInfo);
        },
      },
    });
    // A restore only counts when it brought back Popdate+: packs are used up, so they don't come back.
    if (
      result === PAYWALL_RESULT.PURCHASED ||
      productId !== undefined ||
      (result === PAYWALL_RESULT.RESTORED && restoredPlus)
    ) {
      return { outcome: 'bought', productId };
    }
    return { outcome: result === PAYWALL_RESULT.ERROR ? 'failed' : 'closed' };
  } catch {
    return { outcome: 'failed' };
  }
}

/** Apple's own place to see, change or cancel the subscription, from RevenueCat's Customer Center. */
export async function manageSubscription() {
  if (!ensureConfigured()) return;
  await RevenueCatUI.presentCustomerCenter();
}

/** Restores earlier purchases on this Apple ID. Resolves with whether Popdate+ is active now; rejects on failure. */
export async function restorePurchases(): Promise<boolean> {
  if (!ensureConfigured()) return false;
  return hasPlus(await Purchases.restorePurchases());
}
