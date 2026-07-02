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
  onCheckForUpdates: () => void;
  onRateAndReview: () => void;
  onShareApp: () => void;
};

export type ChevronDownIconProps = {
  expanded: boolean;
};
