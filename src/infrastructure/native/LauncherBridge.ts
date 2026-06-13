import { NativeModules, Platform } from 'react-native';

export type SupportedLauncher = {
  id: string;
  name: string;
  packageName: string;
  installed: boolean;
};

type LauncherIntegrationModule = {
  getSupportedLaunchers(): Promise<SupportedLauncher[]>;
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
