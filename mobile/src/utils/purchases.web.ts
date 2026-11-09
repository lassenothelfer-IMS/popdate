/**
 * The web sells nothing: Popdate+ is bought in the iOS app. Same shape as
 * purchases.ts, so screens don't need to check the platform.
 */

export const purchasesAvailable = false;

export function setPurchasesUser(_userId: string | null) {}

export function usePlus(): boolean | null {
  return false;
}

export type PaywallOutcome = 'bought' | 'closed' | 'failed';

export async function showPaywall(): Promise<PaywallOutcome> {
  return 'failed';
}

export async function showBalloonShop(): Promise<{ outcome: PaywallOutcome; productId?: string }> {
  return { outcome: 'failed' };
}

export async function manageSubscription() {}

export async function restorePurchases(): Promise<boolean> {
  return false;
}
