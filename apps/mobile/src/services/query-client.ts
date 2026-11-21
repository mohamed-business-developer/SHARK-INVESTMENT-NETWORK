import { QueryClient } from '@tanstack/react-query';

export function createMobileQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
        gcTime: 5 * 60_000,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export const mobileQueryClient: QueryClient = createMobileQueryClient();
