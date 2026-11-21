import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  FounderProfileRow,
  InvestorProfileRow,
  PortfolioCompanyRow,
  ProfileRow,
} from '@shark/shared-types';
import {
  createProfileRepository,
  type UpdateOwnProfileInput,
  type UpsertFounderProfileInput,
  type UpsertInvestorProfileInput,
  type UpsertPortfolioCompanyInput,
} from '../repositories/profile.repository';
import { getMobileSupabaseClient } from '../services/supabase';
import { discoveryKeys } from './useDiscovery';
import { useAuth } from './useAuth';

export const profileKeys = {
  all: ['profile'] as const,
  self: (userId: string) => [...profileKeys.all, 'self', userId] as const,
  investor: (userId: string) => [...profileKeys.all, 'investor', userId] as const,
  founder: (userId: string) => [...profileKeys.all, 'founder', userId] as const,
  publicFounder: (userId: string) => [...profileKeys.all, 'public-founder', userId] as const,
  portfolio: (userId: string) => [...profileKeys.all, 'portfolio', userId] as const,
};

function getRepo() {
  return createProfileRepository(getMobileSupabaseClient());
}

async function invalidatePortfolioRelatedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  ownerId?: string | null,
): Promise<void> {
  if (!ownerId) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: profileKeys.all }),
      queryClient.invalidateQueries({ queryKey: discoveryKeys.investorsAll() }),
    ]);
    return;
  }

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: profileKeys.portfolio(ownerId) }),
    queryClient.invalidateQueries({ queryKey: profileKeys.investor(ownerId) }),
    queryClient.invalidateQueries({ queryKey: discoveryKeys.publicPortfolio(ownerId) }),
    queryClient.invalidateQueries({ queryKey: discoveryKeys.investorsAll() }),
  ]);
}

export function useOwnProfileQuery() {
  const { user, isAuthenticated, status } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<ProfileRow | null>({
    queryKey: profileKeys.self(userId || 'anonymous'),
    queryFn: () => getRepo().getOwnProfile(),
    enabled: Boolean(userId) && isAuthenticated && status !== 'suspended',
  });
}

export function useOwnInvestorProfileQuery() {
  const { user, profile, isAuthenticated, status } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<InvestorProfileRow | null>({
    queryKey: profileKeys.investor(userId || 'anonymous'),
    queryFn: () => getRepo().getOwnInvestorProfile(),
    enabled:
      Boolean(userId) && isAuthenticated && status !== 'suspended' && profile?.role === 'investor',
  });
}

export function useOwnFounderProfileQuery() {
  const { user, profile, isAuthenticated, status } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<FounderProfileRow | null>({
    queryKey: profileKeys.founder(userId || 'anonymous'),
    queryFn: () => getRepo().getOwnFounderProfile(),
    enabled:
      Boolean(userId) && isAuthenticated && status !== 'suspended' && profile?.role === 'founder',
  });
}

export function usePublicFounderProfileQuery(founderUserId: string | null | undefined) {
  const { isApproved } = useAuth();
  const safeId = founderUserId?.trim() ?? '';

  return useQuery<FounderProfileRow | null>({
    queryKey: profileKeys.publicFounder(safeId || 'none'),
    queryFn: () => getRepo().getPublicFounderByUserId(safeId),
    enabled: Boolean(safeId) && isApproved,
  });
}

export function useOwnPortfolioCompaniesQuery(limit = 50) {
  const { user, profile, isApproved } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<readonly PortfolioCompanyRow[]>({
    queryKey: profileKeys.portfolio(userId || 'anonymous'),
    queryFn: () => getRepo().listOwnPortfolioCompanies(limit),
    enabled: Boolean(userId) && isApproved && profile?.role === 'investor',
  });
}

export function useUpdateOwnProfileMutation() {
  const queryClient = useQueryClient();
  const { refreshAuthState } = useAuth();

  return useMutation<ProfileRow, Error, UpdateOwnProfileInput>({
    mutationFn: (input) => getRepo().updateOwnProfile(input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(profileKeys.self(updated.id), updated);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: discoveryKeys.investorsAll() }),
        refreshAuthState(),
      ]);
    },
  });
}

export function useUpsertInvestorProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation<InvestorProfileRow, Error, UpsertInvestorProfileInput>({
    mutationFn: (input) => getRepo().upsertInvestorProfile(input),
    onSuccess: async (saved) => {
      queryClient.setQueryData(profileKeys.investor(saved.user_id), saved);
      await queryClient.invalidateQueries({ queryKey: discoveryKeys.investorsAll() });
    },
  });
}

export function useUpsertFounderProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation<FounderProfileRow, Error, UpsertFounderProfileInput>({
    mutationFn: (input) => getRepo().upsertFounderProfile(input),
    onSuccess: async (saved) => {
      queryClient.setQueryData(profileKeys.founder(saved.user_id), saved);
      await queryClient.invalidateQueries({ queryKey: profileKeys.publicFounder(saved.user_id) });
    },
  });
}

export function useCreatePortfolioCompanyMutation() {
  const queryClient = useQueryClient();

  return useMutation<PortfolioCompanyRow, Error, UpsertPortfolioCompanyInput>({
    mutationFn: (input) => getRepo().createPortfolioCompany(input),
    onSuccess: async (created) => {
      await invalidatePortfolioRelatedQueries(queryClient, created.investor_user_id);
    },
  });
}

export function useUpdatePortfolioCompanyMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    PortfolioCompanyRow,
    Error,
    { readonly id: string; readonly input: UpsertPortfolioCompanyInput }
  >({
    mutationFn: ({ id, input }) => getRepo().updatePortfolioCompany(id, input),
    onSuccess: async (updated) => {
      await invalidatePortfolioRelatedQueries(queryClient, updated.investor_user_id);
    },
  });
}

export function useDeletePortfolioCompanyMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<void, Error, string>({
    mutationFn: (portfolioCompanyId) => getRepo().deletePortfolioCompany(portfolioCompanyId),
    onSuccess: async () => {
      await invalidatePortfolioRelatedQueries(queryClient, user?.id);
    },
  });
}
