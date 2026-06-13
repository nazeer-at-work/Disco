import { APP_NAME, APP_PACKAGE_NAME, PLAY_STORE_BASE_URL } from '@env';

const appPackageName = APP_PACKAGE_NAME || 'com.disco.iconpack';
const appName = APP_NAME || 'Disco';
const playStoreBaseUrl =
  PLAY_STORE_BASE_URL || 'https://play.google.com/store/apps/details';

export const appLinks = {
  appName,
  packageName: appPackageName,
  playStoreMarketUrl: `market://details?id=${appPackageName}`,
  playStoreWebUrl: `${playStoreBaseUrl}?id=${appPackageName}`,
  playStoreReviewMarketUrl: `market://details?id=${appPackageName}&showAllReviews=true`,
  playStoreReviewWebUrl: `${playStoreBaseUrl}?id=${appPackageName}&showAllReviews=true`,
};
