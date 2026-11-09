import { useEffect, useState } from 'react';

import { api, isMockServer, setMockPlus, type Balloons } from '@/api';
import { showNotice } from '@/features/settings/settings-ui';
import { useLocale, useT } from '@/i18n';
import { BALLOON_PACKS, balloonCount } from '@/shared/balloons';
import { haptics } from '@/utils/haptics';
import { showBalloonShop, usePlus } from '@/utils/purchases';

export type BalloonState = {
  /** How many you have: null for unlimited, undefined until known. */
  count: number | null | undefined;
  /** When the free ones top up next, in epoch ms; null until known. */
  refillsAt: number | null;
  /**
   * The store says Popdate+, but the server, which decides, still counts none:
   * RevenueCat's webhook hasn't reached it yet. Joining has to wait for it.
   */
  syncing: boolean;
};

/**
 * Your balloons, live. Popdate+ counts as unlimited as soon as the store says so,
 * before the server has heard from RevenueCat. Past midnight the free ones count
 * as topped up, as the server will see them.
 */
export function useBalloons(): BalloonState {
  const plus = usePlus();

  // The mock never hears from RevenueCat: tell it, so it stops spending too.
  useEffect(() => {
    if (isMockServer && plus !== null) setMockPlus(plus);
  }, [plus]);

  // The count depends on the time, so it's worked out when the server's view
  // arrives, and again when the free ones top up.
  const [state, setState] = useState<{ view: Balloons | null; count: number | null | undefined }>({
    view: null,
    count: undefined,
  });

  useEffect(
    () =>
      api.watchBalloons((view) =>
        setState({ view, count: view ? balloonCount(view, Date.now()) : undefined }),
      ),
    [],
  );

  const { view } = state;
  useEffect(() => {
    if (!view) return;
    const wait = view.refillsAt - Date.now();
    if (wait <= 0) return;
    const timer = setTimeout(() => setState({ view, count: balloonCount(view, Date.now()) }), wait + 1000);
    return () => clearTimeout(timer);
  }, [view]);

  return {
    count: plus ? null : state.count,
    refillsAt: view?.refillsAt ?? null,
    syncing: plus === true && state.count === 0,
  };
}

/** "1:00" or "1:00 AM", in your language. */
export function refillTime(refillsAt: number, locale: string) {
  return new Date(refillsAt).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

/** How long to wait for a purchase to reach the server before saying it's on the way. */
const CREDIT_WAIT_MS = 60_000;
/** A purchase the server hasn't shown yet: until then the shop isn't offered again. */
let creditPendingUntil = 0;

/** Resolves true once the server shows a balloon or Popdate+, false after `ms`. */
function untilServerHasBalloon(ms: number) {
  return new Promise<boolean>((resolve) => {
    let done = false;
    let stop: (() => void) | undefined;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      stop?.();
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), ms);
    stop = api.watchBalloons((view) => {
      if (view && balloonCount(view, Date.now()) !== 0) finish(true);
    });
    // The first value can arrive during watchBalloons itself, before `stop` was set.
    if (done) stop();
  });
}

/**
 * Run before joining the line. With balloons, it lets you straight through. With
 * none: the balloon packs from the store, or, where they can't be bought (the web,
 * or before the shop is set up), when the free ones come back. Resolves true once
 * the server will let you in. The real server hears about a purchase from
 * RevenueCat's webhook, usually within seconds, so this waits for it.
 */
export function useBalloonCheck() {
  const t = useT();
  const locale = useLocale();

  function stillOnTheWay(pack: boolean) {
    if (pack) showNotice(t('balloons.onTheWayTitle'), t('balloons.onTheWayBody'));
    else showNotice(t('balloons.plusSyncingTitle'), t('balloons.plusSyncingBody'));
  }

  /** Resolves true when the server will let you into the line. */
  return async function ready({ count, refillsAt, syncing }: BalloonState): Promise<boolean> {
    // Popdate+ in the store, not on the server yet: wait for it rather than sell anything.
    if (syncing) {
      if (await untilServerHasBalloon(CREDIT_WAIT_MS)) return true;
      stillOnTheWay(false);
      return false;
    }
    if (count !== 0) return true;
    // Bought a moment ago and not landed yet: don't sell a second pack.
    if (Date.now() < creditPendingUntil) {
      if (await untilServerHasBalloon(5_000)) return true;
      stillOnTheWay(true);
      return false;
    }
    const { outcome, productId } = await showBalloonShop();
    if (outcome === 'bought') {
      haptics.success();
      const pack = productId !== undefined && BALLOON_PACKS[productId] !== undefined;
      creditPendingUntil = Date.now() + 2 * CREDIT_WAIT_MS;
      if (productId) await api.balloonsBought(productId).catch(() => {});
      if (await untilServerHasBalloon(CREDIT_WAIT_MS)) {
        creditPendingUntil = 0;
        return true;
      }
      stillOnTheWay(pack);
      return false;
    }
    if (outcome === 'failed') {
      const time = refillsAt ? refillTime(refillsAt, locale) : '0:00';
      showNotice(t('balloons.outTitle'), t('balloons.outBody', { time }));
    }
    return false;
  };
}
