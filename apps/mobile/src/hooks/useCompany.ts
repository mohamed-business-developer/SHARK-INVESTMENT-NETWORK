import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import type {
  CompanyMemberRow,
  CompanyRow,
  CursorPageResponse,
  VerificationRequestRow,
  VerificationSubjectType,
} from '@shark/shared-types';
import {
  createCompanyRepository,
  type InviteCompanyMemberInput,
  type UpdateCompanyMemberInput,
  type UpsertCompanyInput,
} from '../repositories/company.repository';
import {
  createVerificationRepository,
  type CreateVerificationRequestInput,
  type ListVerificationRequestsOptions,
} from '../repositories/verification.repository';
import { getMobileSupabaseClient } from '../services/supabase';
import { useAuth } from './useAuth';
import { discoveryKeys } from './useDiscovery';

export const companyKeys = {
  all: ['company'] as const,
  byUser: (userId: string) => [...companyKeys.all, userId] as const,
  operatedList: (userId: string, limit = 50) =>
    [...companyKeys.byUser(userId), 'operated', limit] as const,
  detail: (userId: string, companyId: string) =>
    [...companyKeys.byUser(userId), 'detail', companyId] as const,
  members: (userId: string, companyId: string, limit = 50) =>
    [...companyKeys.byUser(userId), 'members', companyId, limit] as const,
  verifications: (
    userId: string,
    filters?: { readonly subjectType?: VerificationSubjectType; readonly companyId?: string },
  ) => [...companyKeys.byUser(userId), 'verifications', filters ?? {}] as const,
  verificationDetail: (userId: string, requestId: string) =>
    [...companyKeys.byUser(userId), 'verification-detail', requestId] as const,
};

function getCompanyRepo() {
  return createCompanyRepository(getMobileSupabaseClient());
}

function getVerificationRepo() {
  return createVerificationRepository(getMobileSupabaseClient());
}

async function invalidateCompanyAndDirectoryCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  userId?: string | null,
): Promise<void> {
  const companyScope = userId ? companyKeys.byUser(userId) : companyKeys.all;
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: companyScope }),
    queryClient.invalidateQueries({ queryKey: discoveryKeys.companiesAll() }),
  ]);
}

export function useMyOperatedCompaniesQuery(limit = 50) {
  const { user, isApproved } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<readonly CompanyRow[]>({
    queryKey: companyKeys.operatedList(userId || 'anonymous', limit),
    queryFn: () => getCompanyRepo().listMyOperatedCompanies(limit),
    enabled: Boolean(userId) && isApproved,
  });
}

export function useOperatedCompanyDetailQuery(companyId: string | null | undefined) {
  const { user, isApproved } = useAuth();
  const userId = user?.id ?? '';
  const safeId = companyId?.trim() ?? '';

  return useQuery<CompanyRow | null>({
    queryKey: companyKeys.detail(userId || 'anonymous', safeId || 'none'),
    queryFn: () => getCompanyRepo().getOperatedCompanyById(safeId),
    enabled: Boolean(userId) && isApproved && safeId.length > 0,
  });
}

export function useCompanyMembersQuery(companyId: string | null | undefined, limit = 50) {
  const { user, isApproved } = useAuth();
  const userId = user?.id ?? '';
  const safeId = companyId?.trim() ?? '';

  return useQuery<readonly CompanyMemberRow[]>({
    queryKey: companyKeys.members(userId || 'anonymous', safeId || 'none', limit),
    queryFn: () => getCompanyRepo().listCompanyMembers(safeId, limit),
    enabled: Boolean(userId) && isApproved && safeId.length > 0,
  });
}

export function useCreateCompanyMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<CompanyRow, Error, UpsertCompanyInput>({
    mutationFn: (input) => getCompanyRepo().createCompany(input),
    onSuccess: async () => {
      await invalidateCompanyAndDirectoryCaches(queryClient, user?.id);
    },
  });
}

export function useUpdateCompanyMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<
    CompanyRow,
    Error,
    { readonly companyId: string; readonly input: UpsertCompanyInput }
  >({
    mutationFn: ({ companyId, input }) => getCompanyRepo().updateCompany(companyId, input),
    onSuccess: async () => {
      await invalidateCompanyAndDirectoryCaches(queryClient, user?.id);
    },
  });
}

export function useSubmitCompanyForReviewMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<CompanyRow, Error, string>({
    mutationFn: (companyId) => getCompanyRepo().submitCompanyForReview(companyId),
    onSuccess: async () => {
      await invalidateCompanyAndDirectoryCaches(queryClient, user?.id);
    },
  });
}

export function useInviteCompanyMemberMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<CompanyMemberRow, Error, InviteCompanyMemberInput>({
    mutationFn: (input) => getCompanyRepo().inviteCompanyMember(input),
    onSuccess: async () => {
      const scope = user?.id ? companyKeys.byUser(user.id) : companyKeys.all;
      await queryClient.invalidateQueries({ queryKey: scope });
    },
  });
}

export function useUpdateCompanyMemberMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<
    CompanyMemberRow,
    Error,
    { readonly memberId: string; readonly input: UpdateCompanyMemberInput }
  >({
    mutationFn: ({ memberId, input }) => getCompanyRepo().updateCompanyMember(memberId, input),
    onSuccess: async () => {
      const scope = user?.id ? companyKeys.byUser(user.id) : companyKeys.all;
      await queryClient.invalidateQueries({ queryKey: scope });
    },
  });
}

export function useRemoveCompanyMemberMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<void, Error, string>({
    mutationFn: (memberId) => getCompanyRepo().removeCompanyMember(memberId),
    onSuccess: async () => {
      const scope = user?.id ? companyKeys.byUser(user.id) : companyKeys.all;
      await queryClient.invalidateQueries({ queryKey: scope });
    },
  });
}

/**
 * Allows authenticated non-suspended users (including `pending` onboarding applicants)
 * to inspect their own verification requests without exposing moderation notes (`G5-04`).
 */
export function useOwnVerificationRequestsInfiniteQuery(
  options?: Omit<ListVerificationRequestsOptions, 'cursor'>,
) {
  const { user, isAuthenticated, status } = useAuth();
  const userId = user?.id ?? '';

  return useInfiniteQuery<
    CursorPageResponse<VerificationRequestRow>,
    Error,
    InfiniteData<CursorPageResponse<VerificationRequestRow>>,
    ReturnType<typeof companyKeys.verifications>,
    string | null
  >({
    queryKey: companyKeys.verifications(userId || 'anonymous', {
      subjectType: options?.subjectType,
      companyId: options?.companyId,
    }),
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      getVerificationRepo().listOwnVerificationRequests({
        ...options,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.nextCursor : undefined),
    enabled: Boolean(userId) && isAuthenticated && status !== 'suspended',
  });
}

export function useVerificationRequestDetailQuery(requestId: string | null | undefined) {
  const { user, isAuthenticated, status } = useAuth();
  const userId = user?.id ?? '';
  const safeId = requestId?.trim() ?? '';

  return useQuery<VerificationRequestRow | null>({
    queryKey: companyKeys.verificationDetail(userId || 'anonymous', safeId || 'none'),
    queryFn: () => getVerificationRepo().getVerificationRequestById(safeId),
    enabled: Boolean(userId) && isAuthenticated && status !== 'suspended' && safeId.length > 0,
  });
}

export function useSubmitVerificationRequestMutation() {
  const queryClient = useQueryClient();
  const { user, refreshAuthState } = useAuth();

  return useMutation<VerificationRequestRow, Error, CreateVerificationRequestInput>({
    mutationFn: (input) => getVerificationRepo().submitVerificationRequest(input),
    onSuccess: async () => {
      const scope = user?.id ? companyKeys.byUser(user.id) : companyKeys.all;
      await Promise.all([queryClient.invalidateQueries({ queryKey: scope }), refreshAuthState()]);
    },
  });
}
