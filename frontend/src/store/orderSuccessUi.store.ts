const STORAGE_PREFIX = "yd_order_success_celebrated:";

function storageKey(orderId: string) {
  return `${STORAGE_PREFIX}${orderId}`;
}

/** True if the bike celebration already ran for this order in this browser session. */
export function hasCelebratedOrderSuccess(orderId: string): boolean {
  if (!orderId) return true;
  try {
    return sessionStorage.getItem(storageKey(orderId)) === "1";
  } catch {
    return false;
  }
}

/** Mark celebration as consumed so refresh / remounts do not replay it. */
export function markOrderSuccessCelebrated(orderId: string): void {
  if (!orderId) return;
  try {
    sessionStorage.setItem(storageKey(orderId), "1");
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearOrderSuccessCelebrated(orderId: string): void {
  if (!orderId) return;
  try {
    sessionStorage.removeItem(storageKey(orderId));
  } catch {
    /* ignore */
  }
}

export type OrderSuccessNavigateState = {
  celebrateOrderId?: string;
};

export function shouldCelebrateOrderSuccess(input: {
  orderId: string;
  navigateCelebrateOrderId?: string;
  isConfirmedSuccess: boolean;
}): boolean {
  const { orderId, navigateCelebrateOrderId, isConfirmedSuccess } = input;
  if (!orderId || !isConfirmedSuccess) return false;
  if (navigateCelebrateOrderId !== orderId) return false;
  if (hasCelebratedOrderSuccess(orderId)) return false;
  return true;
}
