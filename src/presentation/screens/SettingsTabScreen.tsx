import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { settingsStyles as styles } from './SettingsTabScreen.styles';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  RowBellIcon,
  RowMoonIcon,
  RowPenIcon,
  RowShareIcon,
  RowUserIcon,
} from '../assets/icons/SettingsTabIcons';
import { SettingsTabScreenProps } from './SettingsTabScreen.types';
import { GlowingApplyButton } from '../components/GlowingApplyButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
export function SettingsTabScreen({
  launchersExpanded,
  onToggleLaunchers,
  launchersLoading,
  launchers,
  openingLauncherId,
  onApply,
  onOpenLauncher,
  onOpenRequest,
  onCheckForUpdates,
  onRateAndReview,
  onShareApp,
  freeCoins,
  paidCoins,
  onBuyCoins,
}: SettingsTabScreenProps) {
  const insets = useSafeAreaInsets();
  
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.container, { paddingBottom: 92 + insets.bottom }]}>
      <View style={[styles.surface, { paddingBottom: 24 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Settings</Text>
          <GlowingApplyButton
            title="Apply"
            onPress={onApply}
            style={{ position: 'absolute', right: 0 }}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.launcherAccordion}>
            <Pressable style={styles.launcherAccordionHeader} onPress={onToggleLaunchers}>
              <View style={styles.rowLeadingIcon}>
                <RowMoonIcon />
              </View>
              <Text style={styles.launcherAccordionTitle}>Supported launchers</Text>
              <View style={styles.launcherAccordionChevron}>
                <ChevronDownIcon expanded={launchersExpanded} />
              </View>
            </Pressable>
            {launchersExpanded ? (
              launchersLoading ? (
                <View style={styles.loaderWrap}>
                  <ActivityIndicator color="#1D2A44" />
                </View>
              ) : (
                <View style={styles.launcherList}>
                  {launchers.map(launcher => {
                    const isBusy = openingLauncherId === launcher.id;
                    return (
                      <View
                        key={launcher.id}
                        style={styles.launcherRow}
                      >
                        <View style={styles.launcherHeader}>
                          <Text style={styles.launcherName}>{launcher.name}</Text>
                          <Pressable
                            style={styles.launcherOpenButton}
                            onPress={() => onOpenLauncher(launcher)}
                            disabled={isBusy}
                          >
                            <Text style={styles.launcherOpenButtonLabel}>
                              {isBusy ? 'Wait...' : launcher.installed ? 'Apply' : 'Get'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Coins</Text>
          <View style={styles.coinCard}>
            <View style={styles.coinCardLeft}>
              <Text style={styles.coinCardEmoji}>🪙</Text>
              <View>
                <Text style={styles.coinCardBalance}>{freeCoins + paidCoins} Coins</Text>
              </View>
            </View>
            <Pressable style={styles.coinCardButton} onPress={onBuyCoins}>
              <Text style={styles.coinCardButtonText}>Get Coins</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Feedback</Text>
          <Pressable style={styles.row} onPress={onOpenRequest}>
            <View style={styles.rowLeadingIcon}>
              <RowPenIcon />
            </View>
            <Text style={styles.rowLabel}>Request new icon</Text>
            <View style={styles.rowChevron}>
              <ChevronRightIcon />
            </View>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Updates</Text>
          <Pressable style={styles.row} onPress={onCheckForUpdates}>
            <View style={styles.rowLeadingIcon}>
              <RowBellIcon />
            </View>
            <Text style={styles.rowLabel}>Check for updates</Text>
            <View style={styles.rowChevron}>
              <ChevronRightIcon />
            </View>
          </Pressable>
          <Pressable style={styles.row} onPress={onRateAndReview}>
            <View style={styles.rowLeadingIcon}>
              <RowUserIcon />
            </View>
            <Text style={styles.rowLabel}>Rate & review</Text>
            <View style={styles.rowChevron}>
              <ChevronRightIcon />
            </View>
          </Pressable>
          <Pressable style={styles.row} onPress={onShareApp}>
            <View style={styles.rowLeadingIcon}>
              <RowShareIcon />
            </View>
            <Text style={styles.rowLabel}>Share app</Text>
            <View style={styles.rowChevron}>
              <ChevronRightIcon />
            </View>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
