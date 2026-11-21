import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/ui';
import { AuthProvider } from '@/hooks/useAuth';
import { LocaleProvider } from '@/i18n';
import { mobileQueryClient } from '@/services/query-client';
import { initMobileSentry } from '@/services/sentry';
import { useSharkFonts } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

initMobileSentry();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useSharkFonts();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={mobileQueryClient}>
        <AuthProvider>
          <LocaleProvider>
            <ToastProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false }} />
            </ToastProvider>
          </LocaleProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
