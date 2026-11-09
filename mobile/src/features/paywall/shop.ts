import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import {
  catalogFrom,
  formatMoney,
  PACK_IDS,
  placeholderCatalog,
  PLAN_IDS,
  type Catalog,
} from '@/features/paywall/catalog';
import { deviceRegion, useLocale } from '@/i18n';
import { loadStoreProducts, purchasesAvailable } from '@/utils/purchases';

export type ShopResult = { outcome: 'bought' | 'closed'; productId?: string };

/** Whoever opened the buy sheet and waits for how it ended. */
let waiting: ((result: ShopResult) => void) | null = null;

/**
 * Opens the buy-balloons sheet over the current screen. Resolves when it closes:
 * 'bought' with the product, a pack or Popdate+ from the Plus paywall on top.
 */
export function openBalloonShop(): Promise<ShopResult> {
  settleShop({ outcome: 'closed' });
  router.push('/balloons' as Href);
  return new Promise((resolve) => {
    waiting = resolve;
  });
}

/** Tells whoever opened the sheet how it ended. Only the first call counts. */
export function settleShop(result: ShopResult) {
  const resolve = waiting;
  waiting = null;
  resolve?.(result);
}

/** Opens the Popdate+ paywall. `fromShop`: over the buy sheet, which closes with it after a purchase. */
export function openPlus(fromShop = false) {
  router.push((fromShop ? '/plus?from=shop' : '/plus') as Href);
}

export type CatalogState =
  { status: 'loading' } | { status: 'ready'; catalog: Catalog } | { status: 'failed' };

/** The store's answer, kept for the session: prices don't change while the app runs. */
let cached: Catalog | null = null;

async function fetchCatalog(): Promise<Catalog | null> {
  if (!purchasesAvailable) return placeholderCatalog();
  const [packs, plans] = await Promise.all([
    loadStoreProducts(PACK_IDS, 'oneTime'),
    loadStoreProducts(PLAN_IDS, 'subscription'),
  ]);
  if (!packs || !plans) return null;
  return catalogFrom([...packs, ...plans]);
}

/** The packs and plans with the store's prices. `retry` asks the store again after a failure. */
export function useCatalog(): [CatalogState, () => void] {
  const [state, setState] = useState<CatalogState>(
    cached ? { status: 'ready', catalog: cached } : { status: 'loading' },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cached) return;
    let active = true;
    fetchCatalog().then((catalog) => {
      if (!active) return;
      if (catalog && !catalog.placeholder) cached = catalog;
      setState(catalog ? { status: 'ready', catalog } : { status: 'failed' });
    });
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((count) => count + 1);
  }, []);
  return [state, retry];
}

/** Formats an amount in a currency for your language and the phone's region: "CHF 15.00" in Switzerland. */
export function useMoney() {
  const language = useLocale();
  const region = deviceRegion();
  const locale = region ? `${language}-${region}` : language;
  return (amount: number, currency: string) => formatMoney(amount, currency, locale);
}
