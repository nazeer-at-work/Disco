import { getFeedbackDeviceId } from '../native/LauncherBridge';
import { postToSupabaseFunction } from '../api/submitIconFeedback';
import { name as packName } from '../../../package.json';

export async function logAnalyticsEvent(eventName: string, properties: Record<string, any> = {}) {
  try {
    const deviceId = await getFeedbackDeviceId();
    await postToSupabaseFunction(
      {
        action: 'log_event',
        eventName,
        properties,
        pack: packName,
      },
      deviceId,
    );
  } catch (error) {
    console.warn(`Analytics: failed to log ${eventName}`, error);
  }
}

export const Analytics = {
  trackPaywallViewed: () => logAnalyticsEvent('paywall_viewed'),
  trackPurchaseIntent: (sku: string) => logAnalyticsEvent('purchase_intent', { sku }),
  trackPurchasePending: (sku: string) => logAnalyticsEvent('purchase_pending', { sku }),
  trackPurchaseSuccess: (sku: string, token: string) => logAnalyticsEvent('purchase_success', { sku, token }),
  trackPurchaseError: (sku: string, error: string) => logAnalyticsEvent('purchase_error', { sku, error }),
};
