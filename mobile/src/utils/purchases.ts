import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PRODUCT_CATEGORY,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesStoreProduct,
} from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';

import { PLUS_ENTITLEMENT } from '@/shared/balloons';

/**
 * Balloon packs and Popdate+, sold through RevenueCat. The app draws its own
 * paywalls (`features/paywall`) from the store's products, by the ids in
 * `shared/balloons.ts`, and reads what you own.
 *
 * iOS only for now: Android has no store key yet, and the web sells nothing
 * (purchases.web.ts). The server keeps its own record, through a webhook.
 */

/** RevenueCat's public keys. They are meant to ship inside the app. */
const KEYS = {
  /** Test Store: fake products and purchases, no App Store needed. RevenueCat refuses it in a release build. */
  test: 'test_AXNNdmKamfVHLnDpUxJxYSSKZCj',
  /** The App Store app `com.goodn8s.popdate`: sandbox in development and TestFlight, real money in the store. */
  appStore: 'appl_tPRduzQnNdgpWCgpAOvYtQDOdvP',
};

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

/** A product as the store sells it, in the shopper's own currency. */
export type StoreProduct = {
  id: string;
  /** The price as a number, in `currency`. */
  price: number;
  /** ISO 4217, like CHF. */
  currency: string;
  /** The store's own label for the price, like "CHF 15.00". */
  priceLabel: string;
};

/** The store's products from the last load, to buy them by id. */
const loaded = new Map<string, PurchasesStoreProduct>();

/**
 * The store's products for these ids, in the order the store returns them. Ids
 * the store doesn't sell (yet) are left out. Null where nothing can be bought, or
 * when the store didn't answer. `kind` matters to Google Play and the Test Store.
 */
export async function loadStoreProducts(
  ids: string[],
  kind: 'subscription' | 'oneTime',
): Promise<StoreProduct[] | null> {
  if (!ensureConfigured()) return null;
  try {
    const category =
      kind === 'subscription' ? PRODUCT_CATEGORY.SUBSCRIPTION : PRODUCT_CATEGORY.NON_SUBSCRIPTION;
    const products = await Purchases.getProducts(ids, category);
    for (const product of products) loaded.set(product.identifier, product);
    return products.map((product) => ({
      id: product.identifier,
      price: product.price,
      currency: product.currencyCode,
      priceLabel: product.priceString,
    }));
  } catch {
    return null;
  }
}

export type BuyOutcome = 'bought' | 'cancelled' | 'failed';

/**
 * Buys a product loaded by `loadStoreProducts`, on the signed-in account. The
 * server hears about it from RevenueCat's webhook; Popdate+ also shows at once
 * through `usePlus`. 'cancelled' when you backed out of Apple's sheet.
 */
export async function buyProduct(id: string): Promise<BuyOutcome> {
  const product = loaded.get(id);
  if (!product || !ensureConfigured()) return 'failed';
  try {
    if (!(await onAccount())) return 'failed';
    await Purchases.purchaseStoreProduct(product);
    return 'bought';
  } catch (error) {
    return (error as Partial<PurchasesError> & { userCancelled?: boolean }).userCancelled
      ? 'cancelled'
      : 'failed';
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
