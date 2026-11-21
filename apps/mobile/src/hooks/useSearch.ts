import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import type {
  CursorPageResponse,
  FundingStage,
  InvestorType,
  PublicCompanyDirectoryRow,
  PublicInvestorDirectoryRow,
  VerificationBadgeStatus,
} from '@shark/shared-types';
import { filterSectorsByQuery, sanitizeSearchQuery } from '@shark/utils';
import {
  createDirectoryRepository,
  type CompanyDirectoryFilterInput,
  type InvestorDirectoryFilterInput,
} from '../repositories/directory.repository';
import { getMobileSupabaseClient } from '../services/supabase';
import { flattenCursorPages, useSectorsQuery } from './useDiscovery';

export { filterSectorsByQuery };

export type PublicDirectorySearchScope = 'all' | 'investors' | 'companies';

export interface DirectorySearchOptions {
  readonly query: string;
  readonly scope?: PublicDirectorySearchScope;
  readonly sectorId?: string;
  readonly stage?: FundingStage;
  readonly countryCode?: string;
  readonly investorType?: InvestorType;
  readonly verificationStatus?: VerificationBadgeStatus;
  readonly featuredOnly?: boolean;
  readonly limit?: number;
  readonly debounceMs?: number;
}

export const searchKeys = {
  all: ['directory-search'] as const,
  investors: (filters: Omit<InvestorDirectoryFilterInput, 'cursor'>) =>
    [...searchKeys.all, 'investors', filters] as const,
  companies: (filters: Omit<CompanyDirectoryFilterInput, 'cursor'>) =>
    [...searchKeys.all, 'companies', filters] as const,
};

export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    if (delayMs <= 0) {
      setDebouncedValue(value);
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [delayMs, value]);

  return debouncedValue;
}

/**
 * Bilingual debounced public directory search across Investors, Companies, and active Sectors.
 * Safe for Guests and Pending accounts (queries non-PII public directory views only; never touches pitches).
 */
export function useDirectorySearch(options: DirectorySearchOptions) {
  const {
    query,
    scope = 'all',
    sectorId,
    stage,
    countryCode,
    investorType,
    verificationStatus,
    featuredOnly,
    limit = 20,
    debounceMs = 250,
  } = options;

  const debouncedRaw = useDebouncedValue(query, debounceMs);
  const normalizedQuery = sanitizeSearchQuery(debouncedRaw);
  const rawTrimmedQuery = debouncedRaw.trim();

  const hasCriteria = Boolean(
    normalizedQuery ||
    sectorId ||
    stage ||
    countryCode ||
    investorType ||
    verificationStatus ||
    featuredOnly,
  );

  const investorFilters: Omit<InvestorDirectoryFilterInput, 'cursor'> = useMemo(
    () => ({
      ...(rawTrimmedQuery ? { q: rawTrimmedQuery } : {}),
      ...(sectorId ? { sectorId } : {}),
      ...(stage ? { stage } : {}),
      ...(countryCode ? { countryCode } : {}),
      ...(investorType ? { investorType } : {}),
      ...(featuredOnly ? { featuredOnly } : {}),
      limit,
    }),
    [countryCode, featuredOnly, investorType, limit, rawTrimmedQuery, sectorId, stage],
  );

  const companyFilters: Omit<CompanyDirectoryFilterInput, 'cursor'> = useMemo(
    () => ({
      ...(rawTrimmedQuery ? { q: rawTrimmedQuery } : {}),
      ...(sectorId ? { sectorId } : {}),
      ...(stage ? { stage } : {}),
      ...(countryCode ? { countryCode } : {}),
      ...(verificationStatus ? { verificationStatus } : {}),
      ...(featuredOnly ? { featuredOnly } : {}),
      limit,
    }),
    [countryCode, featuredOnly, limit, rawTrimmedQuery, sectorId, stage, verificationStatus],
  );

  const sectorsQuery = useSectorsQuery(50);

  const investorsQuery = useInfiniteQuery<
    CursorPageResponse<PublicInvestorDirectoryRow>,
    Error,
    InfiniteData<CursorPageResponse<PublicInvestorDirectoryRow>>,
    ReturnType<typeof searchKeys.investors>,
    string | null
  >({
    queryKey: searchKeys.investors(investorFilters),
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      createDirectoryRepository(getMobileSupabaseClient()).listPublicInvestors({
        ...investorFilters,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.nextCursor : undefined),
    enabled: hasCriteria && (scope === 'all' || scope === 'investors'),
  });

  const companiesQuery = useInfiniteQuery<
    CursorPageResponse<PublicCompanyDirectoryRow>,
    Error,
    InfiniteData<CursorPageResponse<PublicCompanyDirectoryRow>>,
    ReturnType<typeof searchKeys.companies>,
    string | null
  >({
    queryKey: searchKeys.companies(companyFilters),
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      createDirectoryRepository(getMobileSupabaseClient()).listPublicCompanies({
        ...companyFilters,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.nextCursor : undefined),
    enabled: hasCriteria && (scope === 'all' || scope === 'companies'),
  });

  const matchedSectors = useMemo(
    () => filterSectorsByQuery(sectorsQuery.data ?? [], normalizedQuery),
    [normalizedQuery, sectorsQuery.data],
  );

  return {
    normalizedQuery,
    hasCriteria,
    matchedSectors,
    investors: flattenCursorPages(investorsQuery.data),
    companies: flattenCursorPages(companiesQuery.data),
    investorsQuery,
    companiesQuery,
    isLoading: investorsQuery.isLoading || companiesQuery.isLoading,
    isFetching: investorsQuery.isFetching || companiesQuery.isFetching,
  };
}
