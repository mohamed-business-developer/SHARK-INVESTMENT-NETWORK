import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/ui';
import { LocaleProvider } from '@/i18n';
import { initMobileSentry } from '@/services/sentry';
import { useSharkFonts } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

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
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <ToastProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }} />
          </ToastProvider>
        </LocaleProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
