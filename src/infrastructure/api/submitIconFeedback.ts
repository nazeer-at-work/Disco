import { supabaseConfig } from '../../config/supabase';
import { FeedbackMode } from '../../presentation/screens/IconGalleryScreen.types';
import { getFeedbackDeviceId } from '../native/LauncherBridge';
import { HomeLauncherDetails, LaunchableApp } from '../native/LauncherBridge';

type IconFeedbackPayload = {
  type: FeedbackMode;
  selectedApps: LaunchableApp[];
  launcherDetails: {
    currentHomeLauncher: HomeLauncherDetails | null;
  };
  submittedAt: string;
};

type SubmitFeedbackResponse = {
  ok: boolean;
  submissionId?: string;
  error?: string;
  free_coins?: number;
  paid_coins?: number;
};

export interface CoinBalance {
  freeCoins: number;
  paidCoins: number;
}

export async function postToSupabaseFunction(
  body: unknown,
  deviceId: string,
): Promise<SubmitFeedbackResponse> {
  const base = supabaseConfig.baseUrl.replace(/\/+$/, '');
  const path = supabaseConfig.feedbackFunctionPath.replace(/^\/+/, '');
  const response = await fetch(`${base}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseConfig.apiKey,
      Authorization: `Bearer ${supabaseConfig.apiKey}`,
      'x-device-id': deviceId,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Supabase function call failed (${response.status}): ${details}`,
    );
  }

  return response.json() as Promise<SubmitFeedbackResponse>;
}

export async function getCoinBalance(): Promise<CoinBalance> {
  const deviceId = await getFeedbackDeviceId();
  const response = await postToSupabaseFunction(
    { action: 'get_coins' },
    deviceId,
  );
  return {
    freeCoins: response.free_coins ?? 0,
    paidCoins: response.paid_coins ?? 0,
  };
}

export async function verifyPurchaseOnBackend(
  purchaseToken: string,
  productId: string,
  packageName?: string,
): Promise<CoinBalance> {
  const deviceId = await getFeedbackDeviceId();
  const response = await postToSupabaseFunction(
    { action: 'buy_coins', purchaseToken, productId, packageName },
    deviceId,
  );
  return {
    freeCoins: response.free_coins ?? 0,
    paidCoins: response.paid_coins ?? 0,
  };
}

export async function buyMockCoinBundle(
  bundle: 'bundle_30' | 'bundle_100',
): Promise<CoinBalance> {
  const deviceId = await getFeedbackDeviceId();
  const response = await postToSupabaseFunction(
    { action: 'buy_coins', bundle },
    deviceId,
  );
  return {
    freeCoins: response.free_coins ?? 0,
    paidCoins: response.paid_coins ?? 0,
  };
}

/**
 * Deduct paid coins for a refunded purchase.
 * The backend verifies the token exists, wasn't already refunded,
 * deducts the correct amount (floors at 0), and logs idempotently.
 */
export async function refundCoins(
  purchaseToken: string,
): Promise<CoinBalance & { coinsDeducted: number }> {
  const deviceId = await getFeedbackDeviceId();
  const response = await postToSupabaseFunction(
    { action: 'refund_coins', purchaseToken },
    deviceId,
  ) as SubmitFeedbackResponse & { coins_deducted?: number };
  return {
    freeCoins: response.free_coins ?? 0,
    paidCoins: response.paid_coins ?? 0,
    coinsDeducted: response.coins_deducted ?? 0,
  };
}

/**
 * DEV-ONLY: Directly set the coin balance for the current device.
 * Requires IS_DEV_MODE=true on the edge function — will 403 in production.
 */
export async function setDeviceCoins(
  freeCoins: number,
  paidCoins: number,
): Promise<CoinBalance> {
  const deviceId = await getFeedbackDeviceId();
  const response = await postToSupabaseFunction(
    { action: 'set_coins', freeCoins, paidCoins },
    deviceId,
  );
  return {
    freeCoins: response.free_coins ?? 0,
    paidCoins: response.paid_coins ?? 0,
  };
}

export async function submitIconFeedback(
  payload: IconFeedbackPayload,
): Promise<{ submissionId: string; freeCoins: number; paidCoins: number }> {
  const deviceId = await getFeedbackDeviceId();
  const response = await postToSupabaseFunction(
    { ...payload, pack: 'disco' },
    deviceId,
  );
  const submissionId = response.submissionId;
  if (!submissionId) {
    throw new Error('Supabase function succeeded but submission id is missing.');
  }

  return {
    submissionId,
    freeCoins: response.free_coins ?? 0,
    paidCoins: response.paid_coins ?? 0,
  };
}
