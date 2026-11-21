import { useInfiniteQuery, useQuery, type InfiniteData } from '@tanstack/react-query';
import type {
  CursorPageResponse,
  PublicCompanyDirectoryRow,
  PublicInvestorDirectoryRow,
  PublicPortfolioCompanyDirectoryRow,
  PublicSystemFlags,
  SectorRow,
} from '@shark/shared-types';
import {
  createDirectoryRepository,
  type CompanyDirectoryFilterInput,
  type InvestorDirectoryFilterInput,
} from '../repositories/directory.repository';
import { getMobileSupabaseClient } from '../services/supabase';

export const discoveryKeys = {
  all: ['discovery'] as const,
  sectors: (limit = 50) => [...discoveryKeys.all, 'sectors', limit] as const,
  sectorBySlug: (slug: string) => [...discoveryKeys.all, 'sector', slug] as const,
  systemFlags: () => [...discoveryKeys.all, 'system-flags'] as const,
  investorsAll: () => [...discoveryKeys.all, 'investors'] as const,
  investors: (filters?: Omit<InvestorDirectoryFilterInput, 'cursor'>) =>
    [...discoveryKeys.investorsAll(), filters ?? {}] as const,
  investorDetail: (investorId: string) =>
    [...discoveryKeys.investorsAll(), 'detail', investorId] as const,
  publicPortfolio: (investorUserId: string) =>
    [...discoveryKeys.all, 'public-portfolio', investorUserId] as const,
  companiesAll: () => [...discoveryKeys.all, 'companies'] as const,
  companies: (filters?: Omit<CompanyDirectoryFilterInput, 'cursor'>) =>
    [...discoveryKeys.companiesAll(), filters ?? {}] as const,
  companyDetail: (companyId: string) =>
    [...discoveryKeys.companiesAll(), 'detail', companyId] as const,
  companyBySlug: (slug: string) => [...discoveryKeys.companiesAll(), 'slug', slug] as const,
};

function getRepo() {
  return createDirectoryRepository(getMobileSupabaseClient());
}

export function flattenCursorPages<T>(data: InfiniteData<CursorPageResponse<T>> | undefined): T[] {
  if (!data) {
    return [];
  }
  return data.pages.flatMap((page) => [...page.items]);
}

export function useSectorsQuery(limit = 50, enabled = true) {
  return useQuery<readonly SectorRow[]>({
    queryKey: discoveryKeys.sectors(limit),
    queryFn: () => getRepo().listActiveSectors(limit),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useSectorBySlugQuery(slug: string | null | undefined) {
  const safeSlug = slug?.trim() ?? '';
  return useQuery<SectorRow | null>({
    queryKey: discoveryKeys.sectorBySlug(safeSlug),
    queryFn: () => getRepo().getSectorBySlug(safeSlug),
    staleTime: 5 * 60_000,
    enabled: safeSlug.length > 0,
  });
}

export function usePublicSystemFlagsQuery(enabled = true) {
  return useQuery<PublicSystemFlags>({
    queryKey: discoveryKeys.systemFlags(),
    queryFn: () => getRepo().getPublicSystemFlags(),
    staleTime: 60_000,
    enabled,
  });
}

export function usePublicInvestorsInfiniteQuery(
  filters?: Omit<InvestorDirectoryFilterInput, 'cursor'>,
  options?: { readonly enabled?: boolean },
) {
  return useInfiniteQuery<
    CursorPageResponse<PublicInvestorDirectoryRow>,
    Error,
    InfiniteData<CursorPageResponse<PublicInvestorDirectoryRow>>,
    ReturnType<typeof discoveryKeys.investors>,
    string | null
  >({
    queryKey: discoveryKeys.investors(filters),
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      getRepo().listPublicInvestors({
        ...filters,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.nextCursor : undefined),
    enabled: options?.enabled ?? true,
  });
}

export function usePublicInvestorDetailQuery(investorId: string | null | undefined) {
  const safeId = investorId?.trim() ?? '';
  return useQuery<PublicInvestorDirectoryRow | null>({
    queryKey: discoveryKeys.investorDetail(safeId),
    queryFn: () => getRepo().getPublicInvestorById(safeId),
    enabled: safeId.length > 0,
  });
}

export function usePublicPortfolioCompaniesQuery(
  investorUserId: string | null | undefined,
  limit = 50,
) {
  const safeUserId = investorUserId?.trim() ?? '';
  return useQuery<readonly PublicPortfolioCompanyDirectoryRow[]>({
    queryKey: discoveryKeys.publicPortfolio(safeUserId),
    queryFn: () => getRepo().listPublicPortfolioCompanies(safeUserId, limit),
    enabled: safeUserId.length > 0,
  });
}

export function usePublicCompaniesInfiniteQuery(
  filters?: Omit<CompanyDirectoryFilterInput, 'cursor'>,
  options?: { readonly enabled?: boolean },
) {
  return useInfiniteQuery<
    CursorPageResponse<PublicCompanyDirectoryRow>,
    Error,
    InfiniteData<CursorPageResponse<PublicCompanyDirectoryRow>>,
    ReturnType<typeof discoveryKeys.companies>,
    string | null
  >({
    queryKey: discoveryKeys.companies(filters),
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      getRepo().listPublicCompanies({
        ...filters,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.nextCursor : undefined),
    enabled: options?.enabled ?? true,
  });
}

export function usePublicCompanyDetailQuery(companyId: string | null | undefined) {
  const safeId = companyId?.trim() ?? '';
  return useQuery<PublicCompanyDirectoryRow | null>({
    queryKey: discoveryKeys.companyDetail(safeId),
    queryFn: () => getRepo().getPublicCompanyById(safeId),
    enabled: safeId.length > 0,
  });
}

export function usePublicCompanyBySlugQuery(slug: string | null | undefined) {
  const safeSlug = slug?.trim() ?? '';
  return useQuery<PublicCompanyDirectoryRow | null>({
    queryKey: discoveryKeys.companyBySlug(safeSlug),
    queryFn: () => getRepo().getPublicCompanyBySlug(safeSlug),
    enabled: safeSlug.length > 0,
  });
}

/**
 * Composes public non-PII discovery screen queries (sectors, public flags, featured investors & companies).
 * Zero PII and zero pitches are fetched from this hook.
 */
export function useDiscoveryOverview(featuredLimit = 6) {
  const sectorsQuery = useSectorsQuery(50);
  const systemFlagsQuery = usePublicSystemFlagsQuery();
  const featuredInvestorsQuery = usePublicInvestorsInfiniteQuery({
    featuredOnly: true,
    limit: featuredLimit,
  });
  const featuredCompaniesQuery = usePublicCompaniesInfiniteQuery({
    featuredOnly: true,
    limit: featuredLimit,
  });

  return {
    sectorsQuery,
    systemFlagsQuery,
    featuredInvestorsQuery,
    featuredCompaniesQuery,
    sectors: sectorsQuery.data ?? [],
    systemFlags: systemFlagsQuery.data ?? null,
    featuredInvestors: flattenCursorPages(featuredInvestorsQuery.data),
    featuredCompanies: flattenCursorPages(featuredCompaniesQuery.data),
    isLoading:
      sectorsQuery.isLoading ||
      featuredInvestorsQuery.isLoading ||
      featuredCompaniesQuery.isLoading,
  };
}
