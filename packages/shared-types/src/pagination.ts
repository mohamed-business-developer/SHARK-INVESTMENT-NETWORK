export interface KeysetCursor {
  readonly featured?: boolean;
  readonly ts: string;
  readonly id: string;
}

export interface CursorPageRequest {
  readonly cursor?: string | null;
  readonly limit?: number;
}

export interface CursorPageResponse<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasNextPage: boolean;
}
