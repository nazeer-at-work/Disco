import { Platform } from 'react-native';
import {
  initConnection,
  fetchProducts,
  requestPurchase,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  Purchase,
  endConnection,
  getAvailablePurchases,
} from 'react-native-iap';
import { Analytics } from '../analytics/AnalyticsManager';

// Product SKUs configured on Google Play Console
export const COIN_PRODUCTS = Platform.select({
  android: ['disco_30_icons', 'disco_100_icons'],
  default: [],
});

let purchaseUpdateSubscription: any = null;
let purchaseErrorSubscription: any = null;
let isConnected = false;

export async function initializeBilling(
  onPurchaseSuccess: (purchase: Purchase) => Promise<void>,
  onPurchaseError: (error: any) => void,
): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    const result = await initConnection();
    isConnected = result;
    if (!result) {
      console.warn('IAP: initConnection returned false');
      return false;
    }

    // Clear previous subscriptions just in case
    clearBillingListeners();

    purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase: Purchase) => {
      try {
        const token = purchase.purchaseToken;
        if (token) {
          if ((purchase as any).purchaseStateAndroid === 2) {
            console.log('IAP: Purchase is pending. Ignoring for now.');
            Analytics.trackPurchasePending(purchase.productId);
            onPurchaseError(new Error('purchase_pending'));
            return;
          }

          try {
            // Send to backend to verify and credit coins
            await onPurchaseSuccess(purchase);
            Analytics.trackPurchaseSuccess(purchase.productId, token);
          } catch (backendErr: any) {
            const msg = backendErr?.message || String(backendErr);
            Analytics.trackPurchaseError(purchase.productId, `backend_error: ${msg}`);
            // If already processed, we can safely consume it locally
            if (msg.includes('already processed')) {
              console.log('IAP: Purchase already processed on backend. Clearing local receipt.');
            } else {
              // Any other error (network, down, etc), DO NOT consume!
              throw backendErr;
            }
          }
          // Acknowledge and consume the purchase so Google doesn't block re-purchases
          await finishTransaction({ purchase, isConsumable: true });
        }
      } catch (err) {
        console.warn('IAP: Error processing purchase update:', err);
        onPurchaseError(err);
      }
    });

    purchaseErrorSubscription = purchaseErrorListener((error) => {
      console.warn('IAP: purchaseErrorListener error:', error);
      Analytics.trackPurchaseError('unknown', error?.message || String(error));
      onPurchaseError(error);
    });

    return true;
  } catch (err) {
    console.warn('IAP: Failed to initialize billing:', err);
    isConnected = false;
    return false;
  }
}

export async function consumeExistingPurchases(
  onPurchaseSuccess?: (purchase: Purchase) => Promise<void>
): Promise<void> {
  if (!isConnected || Platform.OS !== 'android') {
    return;
  }
  try {
    console.log('IAP: Checking for stuck/unconsumed purchases...');
    const purchases = await getAvailablePurchases();
    console.log(`IAP: Found ${purchases.length} available purchases`);
    for (const purchase of purchases) {
      if (COIN_PRODUCTS.includes(purchase.productId)) {
        if ((purchase as any).purchaseStateAndroid === 2) {
          console.log(`IAP: Skipping pending stuck purchase: ${purchase.productId}`);
          continue;
        }

        console.log(`IAP: Consuming stuck purchase: ${purchase.productId}`);
        if (onPurchaseSuccess) {
          try {
            await onPurchaseSuccess(purchase);
            await finishTransaction({ purchase, isConsumable: true });
          } catch (backendErr: any) {
            const msg = backendErr?.message || String(backendErr);
            if (msg.includes('already processed')) {
              console.log('IAP: Stuck purchase already processed on backend. Consuming.');
              await finishTransaction({ purchase, isConsumable: true });
            } else {
              console.warn('IAP: Failed to credit unconsumed purchase on backend (keeping receipt):', backendErr);
            }
          }
        } else {
           await finishTransaction({ purchase, isConsumable: true });
        }
      }
    }
  } catch (err) {
    console.warn('IAP: Failed to consume existing purchases:', err);
  }
}

export async function fetchCoinProducts() {
  if (!isConnected || Platform.OS !== 'android') {
    return [];
  }
  try {
    const products = await fetchProducts({ skus: COIN_PRODUCTS });
    return products || [];
  } catch (err) {
    console.warn('IAP: Failed to fetch products:', err);
    return [];
  }
}

export async function requestCoinPurchase(sku: string): Promise<void> {
  if (!isConnected || Platform.OS !== 'android') {
    throw new Error('Google Play Billing connection is not active.');
  }
  try {
    Analytics.trackPurchaseIntent(sku);
    await requestPurchase({
      request: {
        google: {
          skus: [sku],
        },
      },
      type: 'in-app',
    });
  } catch (err: any) {
    console.warn(`IAP: requestPurchase failed for ${sku}:`, err);
    Analytics.trackPurchaseError(sku, err?.message || String(err));
    throw err;
  }
}

export function clearBillingListeners() {
  if (purchaseUpdateSubscription) {
    purchaseUpdateSubscription.remove();
    purchaseUpdateSubscription = null;
  }
  if (purchaseErrorSubscription) {
    purchaseErrorSubscription.remove();
    purchaseErrorSubscription = null;
  }
}

export async function disconnectBilling() {
  clearBillingListeners();
  if (isConnected) {
    try {
      await endConnection();
    } catch {
      // Ignore cleanup error
    }
    isConnected = false;
  }
}
