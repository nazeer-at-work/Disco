import { SupportedLauncher } from '../../infrastructure/native/LauncherBridge';

export type SettingsTabScreenProps = {
  launchersExpanded: boolean;
  onToggleLaunchers: () => void;
  launchersLoading: boolean;
  launchers: SupportedLauncher[];
  openingLauncherId: string | null;
  onApply: () => void;
  onOpenLauncher: (launcher: SupportedLauncher) => void;
  onOpenRequest: () => void;
  onOpenReport: () => void;
  onCheckForUpdates: () => void;
  onRateAndReview: () => void;
  onShareApp: () => void;
  freeCoins: number;
  paidCoins: number;
  onBuyCoins: () => void;
};

export type ChevronDownIconProps = {
  expanded: boolean;
};
