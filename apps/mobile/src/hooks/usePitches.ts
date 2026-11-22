import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import type {
  CursorPageResponse,
  InvestmentInterestRow,
  InvestorPitchDocumentRow,
  InvestorPitchRow,
  PitchAccessGrantRow,
  PitchDocumentRow,
  PitchReviewRow,
  PitchRow,
  PitchStatus,
} from '@shark/shared-types';
import {
  createPitchRepository,
  derivePitchAccessState,
  isPitchAccessGrantActive,
  type CreateInvestmentInterestInput,
  type CreatePitchDocumentInput,
  type FounderPitchTransitionInput,
  type GrantPitchAccessInput,
  type PitchAccessSummary,
  type PitchDirectoryFilterInput,
  type RevokePitchAccessInput,
  type UpdateInvestmentInterestResponseInput,
  type UpdatePitchDocumentMetadataInput,
  type UpsertPitchInput,
} from '../repositories/pitch.repository';
import { getMobileSupabaseClient } from '../services/supabase';
import { useAuth } from './useAuth';

export { derivePitchAccessState, isPitchAccessGrantActive, type PitchAccessSummary };

export const pitchKeys = {
  all: ['pitches'] as const,
  byUser: (userId: string) => [...pitchKeys.all, userId] as const,
  list: (userId: string, filters?: Omit<PitchDirectoryFilterInput, 'cursor'>) =>
    [...pitchKeys.byUser(userId), 'list', filters ?? {}] as const,
  detail: (userId: string, pitchId: string) =>
    [...pitchKeys.byUser(userId), 'detail', pitchId] as const,
  operatedDetail: (userId: string, pitchId: string) =>
    [...pitchKeys.byUser(userId), 'operated-detail', pitchId] as const,
  companyAccessibleList: (userId: string, companyId: string) =>
    [...pitchKeys.byUser(userId), 'company-accessible', companyId] as const,
  companyList: (userId: string, companyId: string, status?: PitchStatus) =>
    [...pitchKeys.byUser(userId), 'company', companyId, status ?? 'all'] as const,
  documents: (userId: string, pitchId: string) =>
    [...pitchKeys.byUser(userId), 'documents', pitchId] as const,
  operatedDocuments: (userId: string, pitchId: string) =>
    [...pitchKeys.byUser(userId), 'operated-documents', pitchId] as const,
  reviews: (userId: string, pitchId: string) =>
    [...pitchKeys.byUser(userId), 'reviews', pitchId] as const,
  myGrants: (userId: string, pitchId?: string) =>
    [...pitchKeys.byUser(userId), 'my-grants', pitchId ?? 'all'] as const,
  pitchGrants: (userId: string, pitchId: string) =>
    [...pitchKeys.byUser(userId), 'pitch-grants', pitchId] as const,
  ownInterests: (userId: string) => [...pitchKeys.byUser(userId), 'own-interests'] as const,
  pitchInterests: (userId: string, pitchId: string) =>
    [...pitchKeys.byUser(userId), 'pitch-interests', pitchId] as const,
};

function getRepo() {
  return createPitchRepository(getMobileSupabaseClient());
}

async function invalidateUserPitchCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  userId?: string | null,
): Promise<void> {
  const scope = userId ? pitchKeys.byUser(userId) : pitchKeys.all;
  await queryClient.invalidateQueries({ queryKey: scope });
}

export function useAccessiblePitchesInfiniteQuery(
  filters?: Omit<PitchDirectoryFilterInput, 'cursor'>,
) {
  const { user, isApproved } = useAuth();
  const userId = user?.id ?? '';

  return useInfiniteQuery<
    CursorPageResponse<InvestorPitchRow>,
    Error,
    InfiniteData<CursorPageResponse<InvestorPitchRow>>,
    ReturnType<typeof pitchKeys.list>,
    string | null
  >({
    queryKey: pitchKeys.list(userId || 'anonymous', filters),
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      getRepo().listAccessiblePitches({
        ...filters,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.nextCursor : undefined),
    enabled: Boolean(userId) && isApproved,
  });
}

export function useAccessiblePitchDetailQuery(pitchId: string | null | undefined) {
  const { user, isApproved } = useAuth();
  const userId = user?.id ?? '';
  const safeId = pitchId?.trim() ?? '';

  return useQuery<InvestorPitchRow | null>({
    queryKey: pitchKeys.detail(userId || 'anonymous', safeId || 'none'),
    queryFn: () => getRepo().getAccessiblePitchById(safeId),
    enabled: Boolean(userId) && isApproved && safeId.length > 0,
  });
}

export function useOperatedPitchDetailQuery(pitchId: string | null | undefined) {
  const { user, isApproved } = useAuth();
  const userId = user?.id ?? '';
  const safeId = pitchId?.trim() ?? '';

  return useQuery<PitchRow | null>({
    queryKey: pitchKeys.operatedDetail(userId || 'anonymous', safeId || 'none'),
    queryFn: () => getRepo().getOperatedPitchById(safeId),
    enabled: Boolean(userId) && isApproved && safeId.length > 0,
  });
}

export function useCompanyAccessiblePitchesInfiniteQuery(
  companyId: string | null | undefined,
  limit = 20,
) {
  const { user, isApproved } = useAuth();
  const userId = user?.id ?? '';
  const safeCompanyId = companyId?.trim() ?? '';

  return useInfiniteQuery<
    CursorPageResponse<InvestorPitchRow>,
    Error,
    InfiniteData<CursorPageResponse<InvestorPitchRow>>,
    ReturnType<typeof pitchKeys.companyAccessibleList>,
    string | null
  >({
    queryKey: pitchKeys.companyAccessibleList(userId || 'anonymous', safeCompanyId || 'none'),
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      getRepo().listCompanyAccessiblePitches(safeCompanyId, {
        cursor: pageParam,
        limit,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.nextCursor : undefined),
    enabled: Boolean(userId) && isApproved && safeCompanyId.length > 0,
  });
}

export function useCompanyPitchesInfiniteQuery(
  companyId: string | null | undefined,
  status?: PitchStatus,
  limit = 20,
) {
  const { user, isApproved } = useAuth();
  const userId = user?.id ?? '';
  const safeCompanyId = companyId?.trim() ?? '';

  return useInfiniteQuery<
    CursorPageResponse<PitchRow>,
    Error,
    InfiniteData<CursorPageResponse<PitchRow>>,
    ReturnType<typeof pitchKeys.companyList>,
    string | null
  >({
    queryKey: pitchKeys.companyList(userId || 'anonymous', safeCompanyId || 'none', status),
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      getRepo().listCompanyPitches(safeCompanyId, {
        status,
        cursor: pageParam,
        limit,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.nextCursor : undefined),
    enabled: Boolean(userId) && isApproved && safeCompanyId.length > 0,
  });
}

export function usePitchDocumentsQuery(pitchId: string | null | undefined, limit = 50) {
  const { user, isApproved } = useAuth();
  const userId = user?.id ?? '';
  const safePitchId = pitchId?.trim() ?? '';

  return useQuery<readonly InvestorPitchDocumentRow[]>({
    queryKey: pitchKeys.documents(userId || 'anonymous', safePitchId || 'none'),
    queryFn: () => getRepo().listPitchDocuments(safePitchId, limit),
    enabled: Boolean(userId) && isApproved && safePitchId.length > 0,
  });
}

export function useOperatedPitchDocumentsQuery(pitchId: string | null | undefined, limit = 50) {
  const { user, isApproved } = useAuth();
  const userId = user?.id ?? '';
  const safePitchId = pitchId?.trim() ?? '';

  return useQuery<readonly PitchDocumentRow[]>({
    queryKey: pitchKeys.operatedDocuments(userId || 'anonymous', safePitchId || 'none'),
    queryFn: () => getRepo().listOperatedPitchDocuments(safePitchId, limit),
    enabled: Boolean(userId) && isApproved && safePitchId.length > 0,
  });
}

export function usePitchReviewsQuery(pitchId: string | null | undefined, limit = 50) {
  const { user, isApproved } = useAuth();
  const userId = user?.id ?? '';
  const safePitchId = pitchId?.trim() ?? '';

  return useQuery<readonly PitchReviewRow[]>({
    queryKey: pitchKeys.reviews(userId || 'anonymous', safePitchId || 'none'),
    queryFn: () => getRepo().listNonInternalPitchReviews(safePitchId, limit),
    enabled: Boolean(userId) && isApproved && safePitchId.length > 0,
  });
}

export function useMyPitchAccessGrantsQuery(pitchId?: string | null, limit = 50) {
  const { user, isApproved } = useAuth();
  const userId = user?.id ?? '';
  const safePitchId = pitchId?.trim() || undefined;

  return useQuery<readonly PitchAccessGrantRow[]>({
    queryKey: pitchKeys.myGrants(userId || 'anonymous', safePitchId),
    queryFn: () => getRepo().listMyPitchAccessGrants(safePitchId, limit),
    enabled: Boolean(userId) && isApproved,
  });
}

export function usePitchAccessGrantsForPitchQuery(pitchId: string | null | undefined, limit = 50) {
  const { user, isApproved } = useAuth();
  const userId = user?.id ?? '';
  const safePitchId = pitchId?.trim() ?? '';

  return useQuery<readonly PitchAccessGrantRow[]>({
    queryKey: pitchKeys.pitchGrants(userId || 'anonymous', safePitchId || 'none'),
    queryFn: () => getRepo().listPitchAccessGrantsForPitch(safePitchId, limit),
    enabled: Boolean(userId) && isApproved && safePitchId.length > 0,
  });
}

export function useOwnInvestmentInterestsInfiniteQuery(limit = 20) {
  const { user, isApproved } = useAuth();
  const userId = user?.id ?? '';

  return useInfiniteQuery<
    CursorPageResponse<InvestmentInterestRow>,
    Error,
    InfiniteData<CursorPageResponse<InvestmentInterestRow>>,
    ReturnType<typeof pitchKeys.ownInterests>,
    string | null
  >({
    queryKey: pitchKeys.ownInterests(userId || 'anonymous'),
    initialPageParam: null,
    queryFn: ({ pageParam }) => getRepo().listOwnInvestmentInterests({ cursor: pageParam, limit }),
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.nextCursor : undefined),
    enabled: Boolean(userId) && isApproved,
  });
}

export function usePitchInvestmentInterestsInfiniteQuery(
  pitchId: string | null | undefined,
  limit = 20,
) {
  const { user, isApproved } = useAuth();
  const userId = user?.id ?? '';
  const safePitchId = pitchId?.trim() ?? '';

  return useInfiniteQuery<
    CursorPageResponse<InvestmentInterestRow>,
    Error,
    InfiniteData<CursorPageResponse<InvestmentInterestRow>>,
    ReturnType<typeof pitchKeys.pitchInterests>,
    string | null
  >({
    queryKey: pitchKeys.pitchInterests(userId || 'anonymous', safePitchId || 'none'),
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      getRepo().listPitchInvestmentInterests(safePitchId, { cursor: pageParam, limit }),
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.nextCursor : undefined),
    enabled: Boolean(userId) && isApproved && safePitchId.length > 0,
  });
}

export function useCreateDraftPitchMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<PitchRow, Error, UpsertPitchInput>({
    mutationFn: (input) => getRepo().createDraftPitch(input),
    onSuccess: async () => {
      await invalidateUserPitchCaches(queryClient, user?.id);
    },
  });
}

export function useUpdatePitchMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<
    PitchRow,
    Error,
    { readonly pitchId: string; readonly input: UpsertPitchInput }
  >({
    mutationFn: ({ pitchId, input }) => getRepo().updatePitch(pitchId, input),
    onSuccess: async () => {
      await invalidateUserPitchCaches(queryClient, user?.id);
    },
  });
}

export function useTransitionPitchMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<PitchRow, Error, FounderPitchTransitionInput>({
    mutationFn: (input) => getRepo().transitionPitch(input),
    onSuccess: async () => {
      await invalidateUserPitchCaches(queryClient, user?.id);
    },
  });
}

export function useDeleteDraftPitchMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<void, Error, string>({
    mutationFn: (pitchId) => getRepo().deleteDraftPitch(pitchId),
    onSuccess: async () => {
      await invalidateUserPitchCaches(queryClient, user?.id);
    },
  });
}

export function useCreatePitchDocumentMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<PitchDocumentRow, Error, CreatePitchDocumentInput>({
    mutationFn: (input) => getRepo().createPitchDocument(input),
    onSuccess: async () => {
      await invalidateUserPitchCaches(queryClient, user?.id);
    },
  });
}

export function useUpdatePitchDocumentMetadataMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<
    PitchDocumentRow,
    Error,
    { readonly documentId: string; readonly input: UpdatePitchDocumentMetadataInput }
  >({
    mutationFn: ({ documentId, input }) => getRepo().updatePitchDocumentMetadata(documentId, input),
    onSuccess: async () => {
      await invalidateUserPitchCaches(queryClient, user?.id);
    },
  });
}

export function useDeleteDraftPitchDocumentMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<void, Error, string>({
    mutationFn: (documentId) => getRepo().deleteDraftPitchDocument(documentId),
    onSuccess: async () => {
      await invalidateUserPitchCaches(queryClient, user?.id);
    },
  });
}

export function useGrantPitchAccessMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<PitchAccessGrantRow, Error, GrantPitchAccessInput>({
    mutationFn: (input) => getRepo().grantPitchAccess(input),
    onSuccess: async () => {
      await invalidateUserPitchCaches(queryClient, user?.id);
    },
  });
}

export function useRevokePitchAccessMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<PitchAccessGrantRow, Error, RevokePitchAccessInput>({
    mutationFn: (input) => getRepo().revokePitchAccess(input),
    onSuccess: async () => {
      await invalidateUserPitchCaches(queryClient, user?.id);
    },
  });
}

export function useSubmitInvestmentInterestMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<InvestmentInterestRow, Error, CreateInvestmentInterestInput>({
    mutationFn: (input) => getRepo().submitInvestmentInterest(input),
    onSuccess: async () => {
      await invalidateUserPitchCaches(queryClient, user?.id);
    },
  });
}

export function useWithdrawInvestmentInterestMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<InvestmentInterestRow, Error, string>({
    mutationFn: (interestId) => getRepo().withdrawInvestmentInterest(interestId),
    onSuccess: async () => {
      await invalidateUserPitchCaches(queryClient, user?.id);
    },
  });
}

export function useRespondToInvestmentInterestMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<InvestmentInterestRow, Error, UpdateInvestmentInterestResponseInput>({
    mutationFn: (input) => getRepo().respondToInvestmentInterest(input),
    onSuccess: async () => {
      await invalidateUserPitchCaches(queryClient, user?.id);
    },
  });
}
