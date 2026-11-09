/**
 * The web sells nothing: balloons and Popdate+ are bought in the iOS app. Same
 * shape as purchases.ts, so screens don't need to check the platform.
 */
export const purchasesAvailable = false;

export function setPurchasesUser(_userId: string | null) {}

export function usePlus(): boolean | null {
  return false;
}

export type StoreProduct = { id: string; price: number; currency: string; priceLabel: string };

export async function loadStoreProducts(
  _ids: string[],
  _kind: 'subscription' | 'oneTime',
): Promise<StoreProduct[] | null> {
  return null;
}

export type BuyOutcome = 'bought' | 'cancelled' | 'failed';

/** A stub: nothing is sold here. */
export async function buyProduct(_id: string): Promise<BuyOutcome> {
  return 'failed';
}

export async function manageSubscription() {}

export async function restorePurchases(): Promise<boolean> {
  return false;
}
