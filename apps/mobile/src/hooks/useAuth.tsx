import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type {
  DeleteOwnAccountRequest,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  SelectAccountRoleRequest,
} from '@shark/shared-types';
import { createAuthRepository } from '@/repositories/auth.repository';
import { registerRevokedAccessHandler, type RevokedAccessReason } from '@/services/service-client';
import { getMobileSupabaseClient, tryGetMobileSupabaseClient } from '@/services/supabase';
import {
  createInitialGuestAuthState,
  reconcileLiveAuthSession,
  type MobileAuthState,
} from './auth-state';

export interface AuthContextValue extends MobileAuthState {
  readonly isReady: boolean;
  readonly refreshAuthState: (forcedReason?: RevokedAccessReason) => Promise<MobileAuthState>;
  readonly signIn: (input: LoginRequest) => Promise<MobileAuthState>;
  readonly signUp: (input: RegisterRequest) => Promise<MobileAuthState>;
  readonly selectAccountRole: (input: SelectAccountRoleRequest) => Promise<MobileAuthState>;
  readonly resetPasswordForEmail: (input: ForgotPasswordRequest) => Promise<void>;
  readonly updatePassword: (input: ResetPasswordRequest) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly deleteOwnAccount: (input: DeleteOwnAccountRequest) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const queryClient = useQueryClient();
  const [authState, setAuthState] = useState<MobileAuthState>(() =>
    createInitialGuestAuthState({ status: 'loading' }),
  );
  const statusRef = useRef<MobileAuthState['status']>('loading');

  useEffect(() => {
    statusRef.current = authState.status;
  }, [authState.status]);

  const refreshAuthState = useCallback(
    async (forcedReason?: RevokedAccessReason): Promise<MobileAuthState> => {
      const client = tryGetMobileSupabaseClient();
      if (!client) {
        const guest = createInitialGuestAuthState({ status: 'guest' });
        statusRef.current = guest.status;
        setAuthState(guest);
        return guest;
      }

      const repo = createAuthRepository(client);
      const next = await reconcileLiveAuthSession({
        priorStatus: statusRef.current,
        getCurrentSession: () => repo.getCurrentSession(),
        getVerifiedUser: () => repo.getVerifiedUser(),
        fetchOwnProfile: (userId) => repo.fetchOwnProfile(userId),
        clearProtectedCache: () => {
          queryClient.clear();
        },
        localSignOut: () => repo.signOut(),
        forcedRevocationReason: forcedReason,
      });

      statusRef.current = next.status;
      setAuthState(next);
      return next;
    },
    [queryClient],
  );

  useEffect(() => {
    let active = true;
    void refreshAuthState();

    const unregisterInterceptor = registerRevokedAccessHandler((reason) => {
      if (active) {
        void refreshAuthState(reason);
      }
    });

    const client = tryGetMobileSupabaseClient();
    const authSub = client
      ? client.auth.onAuthStateChange((event) => {
          if (!active) {
            return;
          }
          if (event === 'SIGNED_OUT') {
            queryClient.clear();
            const fallbackStatus = statusRef.current === 'suspended' ? 'suspended' : 'guest';
            const nextGuest = createInitialGuestAuthState({
              status: fallbackStatus,
              recommendedRoute:
                fallbackStatus === 'suspended' ? '/(auth)/suspended' : '/(auth)/welcome',
              revocationReasonKey:
                fallbackStatus === 'suspended' ? 'errors.accountSuspended' : null,
            });
            statusRef.current = nextGuest.status;
            setAuthState(nextGuest);
            return;
          }
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            void refreshAuthState();
          }
        })
      : null;

    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active' && active && statusRef.current !== 'guest') {
        void refreshAuthState();
      }
    });

    return () => {
      active = false;
      unregisterInterceptor();
      authSub?.data.subscription.unsubscribe();
      appStateSub.remove();
    };
  }, [queryClient, refreshAuthState]);

  const userId = authState.user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      return;
    }
    const client = tryGetMobileSupabaseClient();
    if (!client) {
      return;
    }

    const channel = client
      .channel(`profile-status-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        () => {
          void refreshAuthState();
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [refreshAuthState, userId]);

  const signIn = useCallback(
    async (input: LoginRequest): Promise<MobileAuthState> => {
      await createAuthRepository(getMobileSupabaseClient()).signIn(input);
      return refreshAuthState();
    },
    [refreshAuthState],
  );

  const signUp = useCallback(
    async (input: RegisterRequest): Promise<MobileAuthState> => {
      await createAuthRepository(getMobileSupabaseClient()).signUp(input);
      return refreshAuthState();
    },
    [refreshAuthState],
  );

  const selectAccountRole = useCallback(
    async (input: SelectAccountRoleRequest): Promise<MobileAuthState> => {
      await createAuthRepository(getMobileSupabaseClient()).selectAccountRole(input);
      return refreshAuthState();
    },
    [refreshAuthState],
  );

  const resetPasswordForEmail = useCallback(async (input: ForgotPasswordRequest): Promise<void> => {
    await createAuthRepository(getMobileSupabaseClient()).resetPasswordForEmail(input);
  }, []);

  const updatePassword = useCallback(async (input: ResetPasswordRequest): Promise<void> => {
    await createAuthRepository(getMobileSupabaseClient()).updatePassword(input);
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    queryClient.clear();
    const client = tryGetMobileSupabaseClient();
    if (client) {
      await createAuthRepository(client).signOut();
    }
    const guest = createInitialGuestAuthState({ status: 'guest' });
    statusRef.current = guest.status;
    setAuthState(guest);
  }, [queryClient]);

  const deleteOwnAccount = useCallback(
    async (input: DeleteOwnAccountRequest): Promise<void> => {
      await createAuthRepository(getMobileSupabaseClient()).deleteOwnAccount(input);
      queryClient.clear();
      const guest = createInitialGuestAuthState({ status: 'guest' });
      statusRef.current = guest.status;
      setAuthState(guest);
    },
    [queryClient],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ...authState,
      isReady: authState.status !== 'loading',
      refreshAuthState,
      signIn,
      signUp,
      selectAccountRole,
      resetPasswordForEmail,
      updatePassword,
      signOut,
      deleteOwnAccount,
    }),
    [
      authState,
      deleteOwnAccount,
      refreshAuthState,
      resetPasswordForEmail,
      selectAccountRole,
      signIn,
      signOut,
      signUp,
      updatePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
