import { NativeModules, Platform } from 'react-native';

export type SupportedLauncher = {
  id: string;
  name: string;
  packageName: string;
  installed: boolean;
};

export type LaunchableApp = {
  packageName: string;
  label: string;
  iconUri?: string | null;
  activityName?: string | null;
};

export type HomeLauncherDetails = {
  packageName: string;
  activityName: string;
  label?: string;
};

type LauncherIntegrationModule = {
  getSupportedLaunchers(): Promise<SupportedLauncher[]>;
  getLaunchableApps(): Promise<LaunchableApp[]>;
  getCurrentHomeLauncher(): Promise<HomeLauncherDetails | null>;
  getFeedbackDeviceId(): Promise<string>;
  getSubmittedFeedbackPackages(mode: string): Promise<string[]>;
  addSubmittedFeedbackPackages(mode: string, packages: string[]): Promise<string[]>;
  openLauncherSettings(launcherId: string): Promise<boolean>;
};

const nativeModule = NativeModules.LauncherIntegration as
  | LauncherIntegrationModule
  | undefined;

export async function getSupportedLaunchers(): Promise<SupportedLauncher[]> {
  if (Platform.OS !== 'android' || !nativeModule?.getSupportedLaunchers) {
    return [];
  }

  return nativeModule.getSupportedLaunchers();
}

export async function openLauncherSettings(launcherId: string): Promise<boolean> {
  if (Platform.OS !== 'android' || !nativeModule?.openLauncherSettings) {
    return false;
  }

  return nativeModule.openLauncherSettings(launcherId);
}

export async function getLaunchableApps(): Promise<LaunchableApp[]> {
  if (Platform.OS !== 'android' || !nativeModule?.getLaunchableApps) {
    return [];
  }

  return nativeModule.getLaunchableApps();
}

export async function getCurrentHomeLauncher(): Promise<HomeLauncherDetails | null> {
  if (Platform.OS !== 'android' || !nativeModule?.getCurrentHomeLauncher) {
    return null;
  }

  return nativeModule.getCurrentHomeLauncher();
}

export async function getSubmittedFeedbackPackages(mode: string): Promise<string[]> {
  if (Platform.OS !== 'android' || !nativeModule?.getSubmittedFeedbackPackages) {
    return [];
  }

  return nativeModule.getSubmittedFeedbackPackages(mode);
}

export async function addSubmittedFeedbackPackages(
  mode: string,
  packages: string[],
): Promise<string[]> {
  if (Platform.OS !== 'android' || !nativeModule?.addSubmittedFeedbackPackages) {
    return [];
  }

  return nativeModule.addSubmittedFeedbackPackages(mode, packages);
}

export async function getFeedbackDeviceId(): Promise<string> {
  if (Platform.OS !== 'android' || !nativeModule?.getFeedbackDeviceId) {
    return 'unknown-device';
  }

  return nativeModule.getFeedbackDeviceId();
}
