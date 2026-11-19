import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'SHARK Investment Network',
  slug: 'shark-investment-network',
  version: '0.1.0',
  scheme: 'shark',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/images/icon.png',
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#142B49',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.sharknetwork.app',
  },
  android: {
    package: 'com.sharknetwork.app',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#142B49',
    },
  },
  web: {
    bundler: 'metro',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-localization',
    [
      'expo-notifications',
      {
        color: '#142B49',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    supportsRTL: true,
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? '',
    },
  },
});
