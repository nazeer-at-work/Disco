import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Dimensions,
  Easing,
  FlatList,
  ImageStyle,
  Linking,
  Modal,
  Platform,
  Image,
  Pressable,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconCard } from '../components/IconCard';
import { DiscoIcon } from '../components/DiscoIcon';
import { SystemIconDescriptor } from '../../domain/entities/SystemIcon';
import { appLinks } from '../../config/app-links';
import { isSupabaseConfigured } from '../../config/supabase';
import iconVersionsConfig from '../../config/icon-versions.json';
import { iconImageMap } from '../../config/icon-image-map.generated';
import { launcherManualPaths } from '../../config/launcher-manual-paths';
import { styles } from './IconGalleryScreen.styles';
import { MoonLogo } from '../components/MoonLogo';
import { SettingsTabScreen } from './SettingsTabScreen';
import {
  CheckSquareIcon,
  HomeTabIcon,
  SettingsTabIcon,
} from '../assets/icons/IconGalleryIcons';
import {
  FeedbackMode,
  IconGalleryScreenProps,
} from './IconGalleryScreen.types';
import {
  addSubmittedFeedbackPackages,
  getCurrentHomeLauncher,
  getSupportedLaunchers,
  getSubmittedFeedbackPackages,
  getLaunchableApps,
  LaunchableApp,
  openLauncherSettings,
  SupportedLauncher,
} from '../../infrastructure/native/LauncherBridge';
import { submitIconFeedback } from '../../infrastructure/api/submitIconFeedback';
const notFoundImageSource = require('../../../assets/images/not-found.webp');
const successImageSource = require('../../../assets/images/success.webp');
const errorImageSource = require('../../../assets/images/error.webp');

const parsedConfig = iconVersionsConfig as {
  defaultVersionId?: string;
  versions?: Array<{
    id: string;
    label: string;
    source?: 'system';
    icons?: SystemIconDescriptor[];
  }>;
};
const versionOptions = parsedConfig.versions ?? [];
const fallbackVersionId = versionOptions[0]?.id ?? 'system';
const initialScope = parsedConfig.defaultVersionId ?? fallbackVersionId;

const previewIconImageStyle: ImageStyle = {
  width: 92,
  height: 92,
  borderRadius: 26,
};


export function IconGalleryScreen({
  getSystemIconsUseCase,
}: IconGalleryScreenProps) {
  const insets = useSafeAreaInsets();
  const GRID_COLUMNS = 4;
  const [activeTab, setActiveTab] = useState<'icons' | 'settings'>('icons');
  const systemIcons = getSystemIconsUseCase.execute();
  const [searchQuery, setSearchQuery] = useState('');
  const [launchersExpanded, setLaunchersExpanded] = useState(false);
  const [launchers, setLaunchers] = useState<SupportedLauncher[]>([]);
  const [launchersLoading, setLaunchersLoading] = useState(false);
  const [openingLauncherId, setOpeningLauncherId] = useState<string | null>(
    null,
  );
  const [selectedIcon, setSelectedIcon] = useState<SystemIconDescriptor | null>(
    null,
  );
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [launchableApps, setLaunchableApps] = useState<LaunchableApp[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackSubmittingVisible, setFeedbackSubmittingVisible] =
    useState(false);
  const [feedbackSuccessVisible, setFeedbackSuccessVisible] = useState(false);
  const [feedbackErrorVisible, setFeedbackErrorVisible] = useState(false);
  const [feedbackErrorMessage, setFeedbackErrorMessage] = useState('');
  const [feedbackQuery, setFeedbackQuery] = useState('');
  const [selectedAppPackages, setSelectedAppPackages] = useState<string[]>([]);
  const [submittedAppPackages, setSubmittedAppPackages] = useState<string[]>(
    [],
  );
  const [bottomBarWidth, setBottomBarWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(
    () => Dimensions.get('window').width,
  );
  const bottomBarPillTranslateX = useRef(new Animated.Value(0)).current;
  const tabContentTranslateX = useRef(new Animated.Value(0)).current;
  const previewBackdropOpacity = useRef(new Animated.Value(0)).current;
  const previewSheetTranslateY = useRef(new Animated.Value(320)).current;
  const BOTTOM_BAR_HORIZONTAL_PADDING_TOTAL = 10;

  const versionIconMap = useMemo(() => {
    const map = new Map<string, SystemIconDescriptor[]>();
    versionOptions.forEach(version => {
      if (version.source === 'system') {
        map.set(version.id, systemIcons);
        return;
      }

      map.set(version.id, version.icons ?? []);
    });
    if (!map.size) {
      map.set('system', systemIcons);
    }
    return map;
  }, [systemIcons]);

  const universalIcons = useMemo<SystemIconDescriptor[]>(() => {
    const seen = new Set<string>();
    const merged: SystemIconDescriptor[] = [];
    versionIconMap.forEach(icons => {
      icons.forEach(icon => {
        const dedupeKey = `${icon.id}-${icon.label.toLowerCase()}`;
        if (seen.has(dedupeKey)) {
          return;
        }
        seen.add(dedupeKey);
        merged.push(icon);
      });
    });
    return merged;
  }, [versionIconMap]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const scope = initialScope;
  const scopedIcons = versionIconMap.get(scope) ?? systemIcons;
  const installedLaunchers = launchers.filter(launcher => launcher.installed);
  const iconsToShow =
    normalizedQuery.length > 0
      ? universalIcons.filter(icon =>
          `${icon.label} ${icon.id}`.toLowerCase().includes(normalizedQuery),
        )
      : scopedIcons;
  const sortedIconsToShow = useMemo(
    () =>
      [...iconsToShow].sort(
        (a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id),
      ),
    [iconsToShow],
  );
  const listRenderConfig = useMemo(
    () => ({
      initialNumToRender: 12,
      maxToRenderPerBatch: 6,
      updateCellsBatchingPeriod: 50,
      windowSize: 7,
    }),
    [],
  );
  const renderIconItem = ({ item }: { item: SystemIconDescriptor }) => (
    <IconCard icon={item} onPress={openIconPreview} />
  );
  const iconKeyExtractor = useCallback(
    (icon: SystemIconDescriptor) => `${icon.id}-${icon.label}`,
    [],
  );
  const animateBottomBarPill = useCallback(
    (tab: 'icons' | 'settings', width: number = bottomBarWidth) => {
      if (width <= 0) {
        return;
      }
      const targetValue =
        tab === 'icons' ? 0 : (width - BOTTOM_BAR_HORIZONTAL_PADDING_TOTAL) / 2;
      Animated.timing(bottomBarPillTranslateX, {
        toValue: targetValue,
        duration: 220,
        useNativeDriver: true,
      }).start();
    },
    [bottomBarWidth, bottomBarPillTranslateX],
  );
  const activePillDynamicStyle = {
    width:
      bottomBarWidth > 0
        ? (bottomBarWidth - BOTTOM_BAR_HORIZONTAL_PADDING_TOTAL) / 2
        : 0,
    transform: [{ translateX: bottomBarPillTranslateX }],
  };
  const tabPagerDynamicStyle = useMemo(
    () => ({
      width: contentWidth > 0 ? contentWidth * 2 : undefined,
      transform: [{ translateX: tabContentTranslateX }],
    }),
    [contentWidth, tabContentTranslateX],
  );
  const tabPageDynamicStyle = useMemo(
    () => (contentWidth > 0 ? { width: contentWidth } : undefined),
    [contentWidth],
  );
  const selectedImageSource = selectedIcon
    ? iconImageMap[selectedIcon.id]
    : undefined;
  const filteredLaunchableApps = useMemo(() => {
    const query = feedbackQuery.trim().toLowerCase();
    if (!query) {
      return launchableApps;
    }
    return launchableApps.filter(
      app =>
        app.label.toLowerCase().includes(query) ||
        app.packageName.toLowerCase().includes(query),
    );
  }, [feedbackQuery, launchableApps]);
  const submittedPackagesSet = useMemo(
    () => new Set(submittedAppPackages),
    [submittedAppPackages],
  );
  const switchTabWithReveal = useCallback(
    (nextTab: 'icons' | 'settings') => {
      if (nextTab === activeTab) {
        return;
      }

      setActiveTab(nextTab);
      animateBottomBarPill(nextTab);
      if (contentWidth <= 0) {
        return;
      }
      const targetValue = nextTab === 'icons' ? 0 : -contentWidth;
      Animated.timing(tabContentTranslateX, {
        toValue: targetValue,
        duration: 240,
        useNativeDriver: true,
      }).start();
    },
    [activeTab, animateBottomBarPill, contentWidth, tabContentTranslateX],
  );
  function openIconPreview(icon: SystemIconDescriptor) {
    setSelectedIcon(icon);
    setIsPreviewVisible(true);
    previewBackdropOpacity.setValue(0);
    previewSheetTranslateY.setValue(320);
    Animated.parallel([
      Animated.timing(previewBackdropOpacity, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
        isInteraction: false,
      }),
      Animated.spring(previewSheetTranslateY, {
        toValue: 0,
        damping: 22,
        stiffness: 210,
        mass: 0.8,
        useNativeDriver: true,
        isInteraction: false,
      }),
    ]).start();
  }
  function closeIconPreview() {
    Animated.parallel([
      Animated.timing(previewBackdropOpacity, {
        toValue: 0,
        duration: 120,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
        isInteraction: false,
      }),
      Animated.timing(previewSheetTranslateY, {
        toValue: 320,
        duration: 180,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
        isInteraction: false,
      }),
    ]).start(() => {
      setIsPreviewVisible(false);
      setSelectedIcon(null);
    });
  }

  const loadLaunchableApps = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return;
    }
    setAppsLoading(true);
    try {
      const apps = await getLaunchableApps();
      setLaunchableApps(apps);
    } catch {
      Alert.alert('Could not load apps', 'Please try again.');
    } finally {
      setAppsLoading(false);
    }
  }, []);

  const openFeedbackPicker = useCallback(
    async (initialQuery: string = '') => {
      setFeedbackQuery(initialQuery);
      setSelectedAppPackages([]);
      setFeedbackVisible(true);
      try {
        const submittedPackages = await getSubmittedFeedbackPackages('request');
        setSubmittedAppPackages(submittedPackages);
      } catch {
        setSubmittedAppPackages([]);
      }
      if (!launchableApps.length && !appsLoading) {
        await loadLaunchableApps();
      }
    },
    [appsLoading, launchableApps.length, loadLaunchableApps],
  );

  const toggleSelectedPackage = useCallback((packageName: string) => {
    setSelectedAppPackages(current =>
      current.includes(packageName)
        ? current.filter(item => item !== packageName)
        : [...current, packageName],
    );
  }, []);

  const submitFeedbackSelection = useCallback(async () => {
    const selectedApps = launchableApps.filter(app =>
      selectedAppPackages.includes(app.packageName),
    );
    if (!selectedApps.length) {
      Alert.alert('No apps selected', 'Select at least one app to continue.');
      return;
    }

    let currentHomeLauncher = null;
    try {
      currentHomeLauncher = await getCurrentHomeLauncher();
    } catch {
      currentHomeLauncher = null;
    }
    const payload = {
      type: 'request' as FeedbackMode,
      selectedApps,
      launcherDetails: {
        currentHomeLauncher,
      },
      submittedAt: new Date().toISOString(),
    };

    try {
      setFeedbackSubmittingVisible(true);
      await submitIconFeedback(payload);
      const selectedPackageNames = selectedApps.map(app => app.packageName);
      try {
        const mergedPackages = await addSubmittedFeedbackPackages(
          'request',
          selectedPackageNames,
        );
        setSubmittedAppPackages(mergedPackages);
      } catch {
        // Ignore local persistence failures when backend succeeded.
      }

      setFeedbackVisible(false);
      setFeedbackSuccessVisible(true);
      setFeedbackErrorVisible(false);
      setFeedbackErrorMessage('');
    } catch (error) {
      console.warn('feedback_submit_failed', error);
      const message = isSupabaseConfigured()
        ? 'Could not submit right now. Please try again.'
        : 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.';
      setFeedbackVisible(false);
      setFeedbackSuccessVisible(false);
      setFeedbackErrorMessage(message);
      setFeedbackErrorVisible(true);
    } finally {
      setFeedbackSubmittingVisible(false);
    }
  }, [launchableApps, selectedAppPackages]);

  const showIconSearchEmptyState =
    normalizedQuery.length > 0 && sortedIconsToShow.length === 0;

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const loadLaunchers = async () => {
      setLaunchersLoading(true);
      try {
        const supportedLaunchers = await getSupportedLaunchers();
        setLaunchers(supportedLaunchers);
      } catch {
        Alert.alert('Could not load launchers', 'Please try again.');
      } finally {
        setLaunchersLoading(false);
      }
    };

    loadLaunchers();
  }, []);

  const handleOpenLauncher = async (launcher: SupportedLauncher) => {
    if (Platform.OS !== 'android') {
      Alert.alert(
        'Android only',
        'Launcher icon packs can only be applied on Android.',
      );
      return;
    }

    if (!launcher.installed) {
      Alert.alert(
        `${launcher.name} not installed`,
        'Install this launcher first, then reopen the app.',
      );
      return;
    }

    setOpeningLauncherId(launcher.id);
    try {
      const opened = await openLauncherSettings(launcher.id);
      if (!opened) {
        const manualPath =
          launcherManualPaths[launcher.id] ??
          `${launcher.name} settings -> icon pack -> ${appLinks.appName}`;
        Alert.alert(
          'Could not open launcher settings',
          `Open ${launcher.name} and apply manually:\n${manualPath}`,
        );
      }
    } catch {
      const manualPath =
        launcherManualPaths[launcher.id] ??
        `${launcher.name} settings -> icon pack -> ${appLinks.appName}`;
      Alert.alert(
        'Could not open launcher settings',
        `Open ${launcher.name} and apply manually:\n${manualPath}`,
      );
    } finally {
      setOpeningLauncherId(null);
    }
  };

  const handleApply = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert(
        'Android only',
        'Launcher icon packs can only be applied on Android.',
      );
      return;
    }

    const preferredLauncher =
      installedLaunchers.find(launcher => launcher.id === 'nova') ??
      installedLaunchers[0];

    if (!preferredLauncher) {
      Alert.alert(
        'No supported launcher found',
        'Your current launcher may not support icon packs. Install a launcher that supports icon packs, then try again.',
      );
      return;
    }

    await handleOpenLauncher(preferredLauncher);
  };

  const handleCheckForUpdates = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert(
        'Not available',
        'Update check is available on Android builds only.',
      );
      return;
    }

    const playStoreUrl = appLinks.playStoreMarketUrl;
    const webStoreUrl = appLinks.playStoreWebUrl;

    try {
      const canOpenPlayStore = await Linking.canOpenURL(playStoreUrl);
      await Linking.openURL(canOpenPlayStore ? playStoreUrl : webStoreUrl);
    } catch {
      Alert.alert(
        'Unable to open store',
        `Please open Play Store and search for ${appLinks.appName}.`,
      );
    }
  };

  const handleRateAndReview = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert(
        'Not available',
        'Rate & review is available on Android builds only.',
      );
      return;
    }

    const playStoreReviewUrl = appLinks.playStoreReviewMarketUrl;
    const webReviewUrl = appLinks.playStoreReviewWebUrl;

    try {
      const canOpenPlayStore = await Linking.canOpenURL(playStoreReviewUrl);
      await Linking.openURL(
        canOpenPlayStore ? playStoreReviewUrl : webReviewUrl,
      );
    } catch {
      Alert.alert(
        'Unable to open store',
        `Please open Play Store and rate ${appLinks.appName}.`,
      );
    }
  };

  const handleShareApp = async () => {
    const webStoreUrl = appLinks.playStoreWebUrl;

    try {
      await Share.share({
        message: `Try ${appLinks.appName} icon pack: ${webStoreUrl}`,
      });
    } catch {
      Alert.alert('Unable to share', 'Please share the app link manually.');
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.blobPrimary} />
      <View style={styles.blobSecondary} />
      <View pointerEvents="none" style={styles.staticLogoWrap}>
        <MoonLogo />
      </View>

      <View
        style={styles.tabContent}
        onLayout={event => {
          const width = event.nativeEvent.layout.width;
          if (width <= 0 || width === contentWidth) {
            return;
          }
          setContentWidth(width);
          tabContentTranslateX.setValue(activeTab === 'icons' ? 0 : -width);
        }}
      >
        <Animated.View style={[styles.tabPager, tabPagerDynamicStyle]}>
          <View style={[styles.tabPage, tabPageDynamicStyle]}>
            <View style={styles.iconsTab}>
              <View style={styles.heroBlock}>
                <Text style={styles.subtitle}>
                  Choose, search and preview your icon pack
                </Text>
              </View>

              <View style={styles.searchShell}>
                <TextInput
                  placeholder="Search icons..."
                  placeholderTextColor="#5C6F91"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={styles.searchInput}
                />
              </View>

              <View style={styles.gridShell}>
                <FlatList
                  data={sortedIconsToShow}
                  keyExtractor={iconKeyExtractor}
                  renderItem={renderIconItem}
                  numColumns={GRID_COLUMNS}
                  style={styles.gridList}
                  contentContainerStyle={styles.gridListContent}
                  ListFooterComponent={<View style={styles.gridFooterSpacer} />}
                  initialNumToRender={listRenderConfig.initialNumToRender}
                  maxToRenderPerBatch={listRenderConfig.maxToRenderPerBatch}
                  updateCellsBatchingPeriod={
                    listRenderConfig.updateCellsBatchingPeriod
                  }
                  windowSize={listRenderConfig.windowSize}
                  ListEmptyComponent={
                    showIconSearchEmptyState ? (
                      <View style={styles.gridEmptyState}>
                        <Image
                          source={notFoundImageSource}
                          style={styles.gridEmptyImage}
                        />
                        <Text style={styles.gridEmptyTitle}>No icon found</Text>
                        <Text style={styles.gridEmptySubtitle}>
                          We can add this app icon in the next update.
                        </Text>
                        <Pressable
                          style={styles.gridEmptyActionButton}
                          onPress={() => openFeedbackPicker(searchQuery.trim())}
                        >
                          <Text style={styles.gridEmptyActionLabel}>
                            Request icon
                          </Text>
                        </Pressable>
                      </View>
                    ) : null
                  }
                />
              </View>
            </View>
          </View>
          <View style={[styles.tabPage, tabPageDynamicStyle]}>
            <SettingsTabScreen
              launchersExpanded={launchersExpanded}
              onToggleLaunchers={() =>
                setLaunchersExpanded(current => !current)
              }
              launchersLoading={launchersLoading}
              launchers={launchers}
              openingLauncherId={openingLauncherId}
              onApply={handleApply}
              onOpenLauncher={handleOpenLauncher}
              onOpenRequest={() => openFeedbackPicker()}
              onCheckForUpdates={handleCheckForUpdates}
              onRateAndReview={handleRateAndReview}
              onShareApp={handleShareApp}
            />
          </View>
        </Animated.View>
      </View>

      <Modal
        animationType="none"
        transparent
        visible={isPreviewVisible}
        onRequestClose={closeIconPreview}
        statusBarTranslucent
        hardwareAccelerated
      >
        <View style={[styles.previewOverlay, { paddingTop: insets.top }]}>
          <Pressable
            style={styles.previewBackdropTouch}
            onPress={closeIconPreview}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.previewBackdrop,
                { opacity: previewBackdropOpacity },
              ]}
            />
          </Pressable>
          <Animated.View
            renderToHardwareTextureAndroid
            style={[
              styles.previewSheet,
              {
                paddingBottom: 36 + insets.bottom,
                transform: [{ translateY: previewSheetTranslateY }],
              },
            ]}
          >
            <View style={styles.previewHandle} />
            <View style={styles.previewIconWrap}>
              {selectedImageSource ? (
                <Image
                  source={selectedImageSource}
                  style={previewIconImageStyle}
                />
              ) : selectedIcon ? (
                <DiscoIcon
                  id={selectedIcon.id}
                  hue={selectedIcon.hue}
                  size={92}
                />
              ) : null}
            </View>
            <Text style={styles.previewTitle}>{selectedIcon?.label}</Text>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={feedbackVisible}
        onRequestClose={() => setFeedbackVisible(false)}
        statusBarTranslucent
      >
        <View style={[styles.feedbackOverlay, { paddingTop: insets.top }]}>
          <Pressable
            style={styles.feedbackBackdrop}
            onPress={() => setFeedbackVisible(false)}
          />
          <View
            style={[
              styles.feedbackSheet,
              {
                paddingBottom: 22 + insets.bottom,
              },
            ]}
          >
            <View style={styles.previewHandle} />
            <Text style={styles.feedbackTitle}>Request New Icons</Text>
            <Text style={styles.feedbackSubtitle}>
              Select one or more installed apps.
            </Text>

            <View style={styles.feedbackSearchShell}>
              <TextInput
                placeholder="Search app name..."
                placeholderTextColor="#7086A8"
                value={feedbackQuery}
                onChangeText={setFeedbackQuery}
                style={styles.feedbackSearchInput}
              />
            </View>

            <View style={styles.feedbackListShell}>
              {appsLoading ? (
                <View style={styles.loaderWrap}>
                  <ActivityIndicator color="#304AA0" />
                </View>
              ) : filteredLaunchableApps.length === 0 ? (
                <View style={styles.feedbackEmptyState}>
                  <Text style={styles.feedbackEmptyTitle}>No apps found</Text>
                  <Pressable
                    style={styles.feedbackEmptyReload}
                    onPress={loadLaunchableApps}
                  >
                    <Text style={styles.feedbackEmptyReloadLabel}>
                      Reload apps
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <FlatList
                  data={filteredLaunchableApps}
                  keyExtractor={item => item.packageName}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const checked = selectedAppPackages.includes(
                      item.packageName,
                    );
                    const isSubmitted = submittedPackagesSet.has(
                      item.packageName,
                    );
                    return (
                      <Pressable
                        style={[
                          styles.feedbackRow,
                          isSubmitted && styles.feedbackRowDisabled,
                        ]}
                        onPress={() => toggleSelectedPackage(item.packageName)}
                        disabled={isSubmitted}
                      >
                        <View style={styles.feedbackRowMain}>
                          {item.iconUri ? (
                            <Image
                              source={{ uri: item.iconUri }}
                              style={styles.feedbackAppIcon}
                            />
                          ) : (
                            <View style={styles.feedbackAppIconFallback}>
                              <Text style={styles.feedbackAppIconFallbackText}>
                                {item.label.trim().charAt(0).toUpperCase() ||
                                  '?'}
                              </Text>
                            </View>
                          )}
                          <View style={styles.feedbackRowTitleWrap}>
                            <Text
                              style={[
                                styles.feedbackRowTitle,
                                isSubmitted && styles.feedbackRowTitleDisabled,
                              ]}
                            >
                              {item.label}
                            </Text>
                            {isSubmitted ? (
                              <Text style={styles.feedbackRowStatusLabel}>
                                Already sent
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        <View style={styles.feedbackCheckbox}>
                          <CheckSquareIcon checked={checked} />
                        </View>
                      </Pressable>
                    );
                  }}
                />
              )}
            </View>

            <View style={styles.feedbackActions}>
              <Pressable
                style={[
                  styles.feedbackActionButton,
                  styles.feedbackActionSecondary,
                ]}
                onPress={() => setFeedbackVisible(false)}
                disabled={feedbackSubmittingVisible}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <MaterialIcons name="close" size={22} color="#4B5567" />
              </Pressable>
              <Pressable
                style={[
                  styles.feedbackActionButton,
                  styles.feedbackActionPrimary,
                  selectedAppPackages.length === 0 &&
                    styles.feedbackActionPrimaryDisabled,
                ]}
                onPress={submitFeedbackSelection}
                disabled={
                  selectedAppPackages.length === 0 || feedbackSubmittingVisible
                }
                accessibilityRole="button"
                accessibilityLabel="Submit"
              >
                <MaterialIcons
                  name="send"
                  size={20}
                  color={
                    selectedAppPackages.length === 0 || feedbackSubmittingVisible
                      ? '#8FA0C0'
                      : '#304AA0'
                  }
                />
              </Pressable>
            </View>
            {feedbackSubmittingVisible ? (
              <View style={styles.feedbackSubmittingOverlay}>
                <View style={styles.feedbackOpeningCard}>
                  <ActivityIndicator color="#304AA0" size="large" />
                  <Text style={styles.feedbackOpeningText}>
                    Submitting icon request...
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={feedbackSuccessVisible}
        onRequestClose={() => setFeedbackSuccessVisible(false)}
        statusBarTranslucent
      >
        <View style={[styles.feedbackOverlay, { paddingTop: insets.top }]}>
          <Pressable
            style={styles.feedbackBackdrop}
            onPress={() => setFeedbackSuccessVisible(false)}
          />
          <View
            style={[
              styles.feedbackSuccessSheet,
              {
                paddingBottom: 28 + insets.bottom,
              },
            ]}
          >
            <Image source={successImageSource} style={styles.feedbackSuccessImage} />
            <Text style={styles.feedbackSuccessTitle}>
              Request sent successfully
            </Text>
            <Pressable
              style={styles.feedbackSuccessButton}
              onPress={() => setFeedbackSuccessVisible(false)}
            >
              <Text style={styles.feedbackSuccessButtonLabel}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={feedbackErrorVisible}
        onRequestClose={() => setFeedbackErrorVisible(false)}
        statusBarTranslucent
      >
        <View style={[styles.feedbackOverlay, { paddingTop: insets.top }]}>
          <Pressable
            style={styles.feedbackBackdrop}
            onPress={() => setFeedbackErrorVisible(false)}
          />
          <View
            style={[
              styles.feedbackSuccessSheet,
              {
                paddingBottom: 28 + insets.bottom,
              },
            ]}
          >
            <Image source={errorImageSource} style={styles.feedbackSuccessImage} />
            <Text style={styles.feedbackSuccessTitle}>Submission failed</Text>
            <Text style={styles.feedbackErrorMessage}>{feedbackErrorMessage}</Text>
            <Pressable
              style={styles.feedbackSuccessButton}
              onPress={() => setFeedbackErrorVisible(false)}
            >
              <Text style={styles.feedbackSuccessButtonLabel}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.bottomBarShell}>
        <View
          style={styles.bottomBar}
          onLayout={event => {
            const width = event.nativeEvent.layout.width;
            setBottomBarWidth(width);
            animateBottomBarPill(activeTab, width);
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.bottomBarActivePill, activePillDynamicStyle]}
          />
          <Pressable
            style={styles.tabButton}
            onPress={() => switchTabWithReveal('icons')}
            accessibilityRole="button"
            accessibilityLabel="Home"
          >
            <HomeTabIcon active={activeTab === 'icons'} />
          </Pressable>
          <Pressable
            style={styles.tabButton}
            onPress={() => switchTabWithReveal('settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <SettingsTabIcon active={activeTab === 'settings'} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
