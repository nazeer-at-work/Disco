import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  Pressable,
  Text,
  StyleSheet,
  View,
  ActivityIndicator,
  Animated,
  Image,
  TextInput,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { typography } from '../theme/typography';
import {
  requestCoinPurchase,
  fetchCoinProducts,
  consumeExistingPurchases,
} from '../../infrastructure/billing/CoinBillingManager';
import {
  buyMockCoinBundle,
  refundCoins,
  setDeviceCoins,
} from '../../infrastructure/api/submitIconFeedback';
import { CustomAlertModal } from './CustomAlertModal';
import { Analytics } from '../../infrastructure/analytics/AnalyticsManager';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  freeCoins: number;
  paidCoins: number;
  onBalanceUpdated: (freeCoins: number, paidCoins: number) => void;
  onPurchaseSuccess: (purchase: any) => Promise<void>;
}

export function PaywallModal({
  visible,
  onClose,
  freeCoins,
  paidCoins,
  onBalanceUpdated,
  onPurchaseSuccess,
}: PaywallModalProps) {
  const [, setLoading] = useState(false);
  const [purchasePhase, setPurchasePhase] = useState<'idle' | 'connecting' | 'authorizing' | 'success'>('idle');
  const [iapProducts, setIapProducts] = useState<any[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [syncing, setSyncing] = useState(false);
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(600)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Dev tools state (__DEV__ only)
  const [devFreeCoins, setDevFreeCoins] = useState('10');
  const [devPaidCoins, setDevPaidCoins] = useState('40');
  const [devRefundToken, setDevRefundToken] = useState('');
  const [devLastToken, setDevLastToken] = useState<string | null>(null);
  const [devBusy, setDevBusy] = useState(false);
  
  const [customAlertVisible, setCustomAlertVisible] = useState(false);
  const [customAlertConfig, setCustomAlertConfig] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({
    title: '',
    message: '',
    type: 'info',
  });

  const showCustomAlert = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'warning' | 'info',
  ) => {
    setCustomAlertConfig({ title, message, type });
    setCustomAlertVisible(true);
  };

  useEffect(() => {
    if (visible) {
      Analytics.trackPaywallViewed();
      setPurchasePhase('idle');
      setLoading(false);
      setSyncing(false);
      
      // Animate slide-up from bottom
      slideAnim.setValue(600);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 22,
          stiffness: 200,
          mass: 0.9,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Load products and run automatic self-healing on mount to consume any previously stuck test billing purchases
      const loadAndSelfHeal = async () => {
        try {
          const products = await fetchCoinProducts();
          console.log('IAP: Fetched products:', JSON.stringify(products));
          setIapProducts(products);
          
          console.log('IAP: Running background self-healing on paywall open...');
          await consumeExistingPurchases(onPurchaseSuccess);
        } catch (err) {
          console.warn('Could not fetch products or self-heal on mount:', err);
        }
      };
      loadAndSelfHeal();
    } else {
      slideAnim.setValue(600);
      opacityAnim.setValue(0);
    }
  }, [visible, slideAnim, opacityAnim, onPurchaseSuccess]);
 
  const getProductPrice = (productId: string, defaultPrice: string) => {
    const product = iapProducts.find(
      (p) => p.productId === productId || p.id === productId
    );
    if (!product) {
      return defaultPrice;
    }
    if (product.oneTimePurchaseOfferDetails) {
      return product.oneTimePurchaseOfferDetails.formattedPrice ?? defaultPrice;
    }
    return product.localizedPrice ?? product.displayPrice ?? defaultPrice;
  };

  const handlePurchase = async (productId: string, amount: number) => {
    setLoading(true);
    setPurchasePhase('connecting');
    setStatusMessage('Connecting to Google Play...');

    try {
      if (iapProducts.length > 0) {
        // Real Google Play purchase
        await requestCoinPurchase(productId);
        // Note: The global purchaseUpdateListener in CoinBillingManager handles the transaction completion,
        // which calls handlePurchaseSuccess to update state and calls finishTransaction with isConsumable: true.
        setLoading(false);
        onClose();
      } else {
        // Fallback to simulated/sandbox flow
        console.log('No Google Play products active. Running mock billing...');
        simulatePurchase(amount);
      }
    } catch (error: any) {
      setLoading(false);
      setPurchasePhase('idle');
      showCustomAlert(
        'Purchase Failed',
        error?.message || 'Could not complete Google Play transaction.',
        'error',
      );
    }
  };

  const simulatePurchase = async (amount: number) => {
    // Stage 1: Connecting (2 seconds)
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 1200));
    setPurchasePhase('authorizing');
    setStatusMessage('Authorizing simulated charge...');

    // Stage 2: Authorizing (2 seconds)
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 1200));
    setStatusMessage('Syncing with backend...');

    try {
      const bundleType = amount === 30 ? 'bundle_30' : 'bundle_100';
      const result = await buyMockCoinBundle(bundleType);

      // Track the simulated token so dev tools "Refund Last" works
      const mockToken = `mock_${bundleType}_${Date.now()}`;
      setDevLastToken(mockToken);
      setDevRefundToken(mockToken);

      setPurchasePhase('success');
      onBalanceUpdated(result.freeCoins, result.paidCoins);

      // Stage 3: Success message (1.5 seconds)
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 1500));
      setPurchasePhase('idle');
      setLoading(false);
      onClose();
    } catch (err) {
      setLoading(false);
      setPurchasePhase('idle');
      console.warn('Simulated purchase error:', err);
      showCustomAlert(
        'Server Sync Error',
        'Simulated payment succeeded but backend synchronization failed.',
        'error',
      );
    }
  };

  // ---- Dev Tool Handlers (__DEV__ only) ----
  const handleDevSetBalance = async () => {
    const free = parseInt(devFreeCoins, 10);
    const paid = parseInt(devPaidCoins, 10);
    if (isNaN(free) || isNaN(paid) || free < 0 || paid < 0) {
      showCustomAlert('Invalid Input', 'Enter valid non-negative integers for both fields.', 'error');
      return;
    }
    setDevBusy(true);
    try {
      const result = await setDeviceCoins(free, paid);
      onBalanceUpdated(result.freeCoins, result.paidCoins);
      showCustomAlert(
        'Balance Updated',
        `Set to ${result.freeCoins} free + ${result.paidCoins} paid coins.`,
        'success',
      );
    } catch (err: any) {
      showCustomAlert(
        'Set Balance Failed',
        err?.message || 'Could not set balance. Is IS_DEV_MODE=true on the edge function?',
        'error',
      );
    } finally {
      setDevBusy(false);
    }
  };

  const handleDevRefund = async (token: string) => {
    if (!token || token.length < 4) {
      showCustomAlert('Invalid Token', 'Enter a valid purchase token to refund.', 'error');
      return;
    }
    setDevBusy(true);
    try {
      const result = await refundCoins(token);
      onBalanceUpdated(result.freeCoins, result.paidCoins);
      showCustomAlert(
        'Refund Processed',
        `Deducted ${result.coinsDeducted} paid coins.\nNew balance: ${result.freeCoins} free + ${result.paidCoins} paid.`,
        'success',
      );
      // Clear the token after a successful refund
      if (token === devLastToken) setDevLastToken(null);
      setDevRefundToken('');
    } catch (err: any) {
      const msg = err?.message || 'Refund failed.';
      const isAlreadyRefunded = msg.includes('already_refunded');
      showCustomAlert(
        isAlreadyRefunded ? 'Already Refunded' : 'Refund Failed',
        isAlreadyRefunded ? 'This purchase token has already been refunded.' : msg,
        'warning',
      );
    } finally {
      setDevBusy(false);
    }
  };

  const handleSyncPurchases = async () => {
    setSyncing(true);
    try {
      console.log('IAP: Manual sync triggered...');
      await consumeExistingPurchases(onPurchaseSuccess);
      showCustomAlert(
        'Billing Synced',
        'Your transaction receipts have been refreshed. Any stuck or pending purchases have been completed.',
        'success',
      );
    } catch (err: any) {
      showCustomAlert(
        'Sync Failed',
        err?.message || 'Could not refresh transactions.',
        'error',
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <Modal
      animationType="none"
      transparent
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <Animated.View
          style={[
            styles.container,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* ── Handle bar drag indicator ── */}
          <View style={styles.handleBar} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
          {purchasePhase !== 'idle' ? (
            <View style={styles.loadingContainer}>
              {purchasePhase === 'success' ? (
                <View style={styles.successWrapper}>
                  <MaterialIcons name="check-circle" size={80} color="#2CDA86" />
                  <Text style={styles.successTitle}>Payment Successful!</Text>
                  <Text style={styles.successSubtitle}>Your coin balance has been updated.</Text>
                </View>
              ) : (
                <View style={styles.loaderWrapper}>
                  <ActivityIndicator size="large" color="#304AA0" />
                  <Text style={styles.loadingText}>{statusMessage}</Text>
                  <Text style={styles.loadingSubtext}>Please do not close the app.</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.content}>
              <View style={styles.header}>
                <Text style={styles.title}>Need More Requests? 🪙</Text>
                <Pressable onPress={onClose} style={styles.closeBtn}>
                  <MaterialIcons name="close" size={24} color="#94A3B8" />
                </Pressable>
              </View>

              <View style={styles.illustrationWrapper}>
                <Image
                  source={require('../assets/images/fluffy_coins_chest.png')}
                  style={styles.chestImage}
                  resizeMode="contain"
                />
              </View>

              <Text style={styles.subtitle}>
                Each icon request costs 1 coin. Buy a coin pack to request more custom icons. Paid requests are prioritised.
              </Text>

              <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>Current Balance</Text>
                <View style={styles.balanceValWrap}>
                  <Text style={styles.balanceCoin}>🪙</Text>
                  <Text style={styles.balanceVal}>{freeCoins + paidCoins}</Text>
                </View>
              </View>

              <View style={styles.bundlesContainer}>
                {/* Bundle 30 */}
                <Pressable
                  style={({ pressed }) => [
                    styles.bundleCard,
                    pressed && styles.bundleCardPressed,
                  ]}
                  onPress={() => handlePurchase('disco_30_icons', 30)}
                >
                  <View style={styles.bundleLeft}>
                    <View style={styles.bundleIconBg}>
                      <Text style={styles.bundleIconEmoji}>🪙</Text>
                    </View>
                    <View style={styles.bundleDetails}>
                      <Text style={styles.bundleTitle}>30 Coins Pack</Text>
                      <Text style={styles.bundleSubtitle}>Priority delivery for requests</Text>
                    </View>
                  </View>
                  <View style={styles.bundlePriceTag}>
                    <Text style={styles.bundlePrice}>{getProductPrice('disco_30_icons', '$0.99')}</Text>
                  </View>
                </Pressable>

                {/* Bundle 100 */}
                <Pressable
                  style={({ pressed }) => [
                    styles.bundleCard,
                    styles.bundleCardHot,
                    pressed && styles.bundleCardPressed,
                  ]}
                  onPress={() => handlePurchase('disco_100_icons', 100)}
                >
                  <View style={styles.badgeHot}>
                    <Text style={styles.badgeHotText}>Popular</Text>
                  </View>
                  <View style={styles.bundleLeft}>
                    <View style={[styles.bundleIconBg, styles.bundleIconBgHot]}>
                      <Text style={styles.bundleIconEmoji}>✨</Text>
                    </View>
                    <View style={styles.bundleDetails}>
                      <Text style={[styles.bundleTitle, styles.bundleTitleHot]}>100 Coins Pack</Text>
                      <Text style={styles.bundleSubtitle}>Super priority delivery + Dev love</Text>
                    </View>
                  </View>
                  <View style={[styles.bundlePriceTag, styles.bundlePriceTagHot]}>
                    <Text style={styles.bundlePriceHot}>{getProductPrice('disco_100_icons', '$1.99')}</Text>
                  </View>
                </Pressable>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.syncBtn,
                  pressed && styles.syncBtnPressed,
                ]}
                onPress={handleSyncPurchases}
                disabled={syncing}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color="#94A3B8" />
                ) : (
                  <Text style={styles.syncBtnText}>Sync Purchases 🔄</Text>
                )}
              </Pressable>

              <Text style={styles.footerNote}>
                Transactions are secured by Google Play Billing. If you already completed a payment but it is not credited, click "Sync Purchases".
              </Text>

              {/* ========== DEV TOOLS (only in __DEV__ builds) ========== */}
              {__DEV__ && (
                <View style={styles.devPanel}>
                  <Text style={styles.devPanelTitle}>🛠 Dev Tools</Text>

                  {/* Set Balance */}
                  <Text style={styles.devSectionLabel}>Set Balance</Text>
                  <View style={styles.devRow}>
                    <View style={styles.devInputGroup}>
                      <Text style={styles.devInputLabel}>Free</Text>
                      <TextInput
                        style={styles.devInput}
                        value={devFreeCoins}
                        onChangeText={setDevFreeCoins}
                        keyboardType="number-pad"
                        maxLength={5}
                        placeholderTextColor="#475569"
                        placeholder="10"
                      />
                    </View>
                    <View style={styles.devInputGroup}>
                      <Text style={styles.devInputLabel}>Paid</Text>
                      <TextInput
                        style={styles.devInput}
                        value={devPaidCoins}
                        onChangeText={setDevPaidCoins}
                        keyboardType="number-pad"
                        maxLength={5}
                        placeholderTextColor="#475569"
                        placeholder="40"
                      />
                    </View>
                    <Pressable
                      style={({ pressed }) => [styles.devBtn, pressed && styles.devBtnPressed]}
                      onPress={handleDevSetBalance}
                      disabled={devBusy}
                    >
                      {devBusy
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.devBtnText}>Apply</Text>
                      }
                    </Pressable>
                  </View>

                  {/* Simulate Refund */}
                  <Text style={styles.devSectionLabel}>Simulate Refund</Text>
                  <View style={styles.devRow}>
                    <TextInput
                      style={[styles.devInput, styles.devInputFlex]}
                      value={devRefundToken}
                      onChangeText={setDevRefundToken}
                      placeholder="purchase_token"
                      placeholderTextColor="#475569"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Pressable
                      style={({ pressed }) => [styles.devBtn, styles.devBtnDanger, pressed && styles.devBtnPressed]}
                      onPress={() => handleDevRefund(devRefundToken)}
                      disabled={devBusy || !devRefundToken}
                    >
                      <Text style={styles.devBtnText}>Refund</Text>
                    </Pressable>
                  </View>
                  {devLastToken && (
                    <Pressable
                      style={({ pressed }) => [styles.devLastTokenBtn, pressed && styles.devBtnPressed]}
                      onPress={() => handleDevRefund(devLastToken)}
                      disabled={devBusy}
                    >
                      <Text style={styles.devLastTokenText}>
                        ↩ Refund last mock purchase
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          )}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>

    <CustomAlertModal
      visible={customAlertVisible}
      title={customAlertConfig.title}
      message={customAlertConfig.message}
      type={customAlertConfig.type}
      onClose={() => setCustomAlertVisible(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 16, 28, 0.80)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: '#1E293B',
    elevation: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  content: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: typography.bold,
  },
  closeBtn: {
    padding: 4,
  },
  illustrationWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  chestImage: {
    width: 280,
    height: 140,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontFamily: typography.regular,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  balanceCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  balanceLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: typography.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceValWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceCoin: {
    fontSize: 22,
    marginRight: 6,
  },
  balanceVal: {
    color: '#FFFFFF',
    fontSize: 26,
    fontFamily: typography.extraBold,
  },
  bundlesContainer: {
    gap: 14,
    marginBottom: 16,
  },
  bundleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  bundleCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  bundleCardHot: {
    borderColor: '#304AA0',
    backgroundColor: '#1E1B4B',
    position: 'relative',
    overflow: 'visible',
  },
  badgeHot: {
    position: 'absolute',
    top: -10,
    right: 18,
    backgroundColor: '#304AA0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  badgeHotText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: typography.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bundleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bundleIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bundleIconBgHot: {
    backgroundColor: '#312E81',
  },
  bundleIconEmoji: {
    fontSize: 20,
  },
  bundleDetails: {
    flex: 1,
  },
  bundleTitle: {
    color: '#E2E8F0',
    fontSize: 15,
    fontFamily: typography.bold,
  },
  bundleTitleHot: {
    color: '#C7D2FE',
  },
  bundleSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: typography.regular,
    marginTop: 2,
  },
  bundlePriceTag: {
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bundlePriceTagHot: {
    backgroundColor: '#304AA0',
  },
  bundlePrice: {
    color: '#E2E8F0',
    fontSize: 14,
    fontFamily: typography.bold,
  },
  bundlePriceHot: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: typography.bold,
  },
  syncBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#475569',
    marginTop: 6,
    marginBottom: 16,
  },
  syncBtnPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  syncBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontFamily: typography.bold,
  },
  footerNote: {
    color: '#475569',
    fontSize: 11,
    fontFamily: typography.regular,
    textAlign: 'center',
    lineHeight: 15,
    paddingHorizontal: 10,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 320,
  },
  loaderWrapper: {
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: typography.bold,
    marginTop: 16,
  },
  loadingSubtext: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: typography.regular,
    marginTop: 6,
  },
  successWrapper: {
    alignItems: 'center',
  },
  successTitle: {
    color: '#2CDA86',
    fontSize: 20,
    fontFamily: typography.bold,
    marginTop: 16,
  },
  successSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    fontFamily: typography.regular,
    textAlign: 'center',
    marginTop: 6,
  },
  // ---- Dev Tools styles ----
  devPanel: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 14,
  },
  devPanelTitle: {
    color: '#FBBF24',
    fontSize: 12,
    fontFamily: typography.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  devSectionLabel: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: typography.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  devInputGroup: {
    flex: 1,
  },
  devInputLabel: {
    color: '#475569',
    fontSize: 10,
    fontFamily: typography.medium,
    marginBottom: 3,
  },
  devInput: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#E2E8F0',
    fontSize: 13,
    fontFamily: typography.regular,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minHeight: 36,
  },
  devInputFlex: {
    flex: 1,
  },
  devBtn: {
    backgroundColor: '#304AA0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    alignSelf: 'flex-end',
  },
  devBtnDanger: {
    backgroundColor: '#7F1D1D',
  },
  devBtnPressed: {
    opacity: 0.75,
  },
  devBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: typography.bold,
  },
  devLastTokenBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  devLastTokenText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontFamily: typography.medium,
  },
});

