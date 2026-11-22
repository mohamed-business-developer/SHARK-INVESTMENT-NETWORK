import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { PrivateStorageBucketName } from '@shark/shared-types';
import {
  createSignedUrlController,
  requestSignedDocumentUrl,
  SIGNED_URL_MEMORY_ONLY_POLICY,
  type SignedDocumentUrlState,
  type SignedUrlController,
} from '../services/signed-urls';
import { getMobileSupabaseClient } from '../services/supabase';
import { useAuth } from './useAuth';

export interface UseSignedDocumentUrlParams {
  readonly bucket: PrivateStorageBucketName;
  readonly documentId: string | null | undefined;
  readonly storagePath?: string | null;
  readonly enabled?: boolean;
  readonly isFocused?: boolean;
}

export interface UseSignedDocumentUrlResult extends SignedDocumentUrlState {
  readonly retry: () => void;
  readonly clear: () => void;
  readonly memoryPolicy: typeof SIGNED_URL_MEMORY_ONLY_POLICY;
}

const INITIAL_SIGNED_URL_STATE: SignedDocumentUrlState = {
  status: 'idle',
  data: null,
  error: null,
  isLocked: false,
};

/**
 * Memory-only Signed URL hook (`gcTime: 0`, `staleTime: 0`).
 * Automatically schedules proactive refresh at `expiresAt - 10_000 ms` while mounted and focused,
 * and purges URLs immediately on revoke, quarantine, rate limit, logout, suspension, or unmount.
 */
export function useSignedDocumentUrl(
  params: UseSignedDocumentUrlParams,
): UseSignedDocumentUrlResult {
  const { bucket, documentId, storagePath, enabled = true, isFocused = true } = params;
  const { user, status, isApproved } = useAuth();
  const userId = user?.id ?? null;

  // Enforce PM Decision account-state boundaries before making Signed URL requests.
  const accountAuthorized =
    bucket === 'pitch-documents'
      ? Boolean(userId) && isApproved
      : Boolean(userId) && status !== 'guest' && status !== 'loading' && status !== 'suspended';

  const safeDocId = documentId?.trim() || null;
  const canFetch = Boolean(enabled && accountAuthorized && safeDocId);

  const [isAppActive, setIsAppActive] = useState<boolean>(
    () => AppState.currentState === 'active' || AppState.currentState === 'unknown',
  );
  const [state, setState] = useState<SignedDocumentUrlState>(INITIAL_SIGNED_URL_STATE);
  const controllerRef = useRef<SignedUrlController | null>(null);
  const initialSyncRef = useRef({
    active: Boolean(isFocused && isAppActive),
    target: {
      bucket,
      documentId: safeDocId,
      storagePath: bucket === 'verification-documents' ? storagePath : null,
      enabled: canFetch,
    },
  });
  initialSyncRef.current = {
    active: Boolean(isFocused && isAppActive),
    target: {
      bucket,
      documentId: safeDocId,
      storagePath: bucket === 'verification-documents' ? storagePath : null,
      enabled: canFetch,
    },
  };

  useEffect(() => {
    const controller = createSignedUrlController({
      fetchSignedUrl: (req) => requestSignedDocumentUrl(getMobileSupabaseClient(), req),
    });
    controllerRef.current = controller;

    const unsubscribe = controller.subscribe(setState);
    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      setIsAppActive(nextState === 'active');
    });

    controller.setActive(initialSyncRef.current.active);
    controller.setTarget(initialSyncRef.current.target);

    return () => {
      unsubscribe();
      appStateSub.remove();
      controller.dispose();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
      setState(INITIAL_SIGNED_URL_STATE);
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setActive(Boolean(isFocused && isAppActive));
  }, [isAppActive, isFocused]);

  useEffect(() => {
    controllerRef.current?.setTarget({
      bucket,
      documentId: safeDocId,
      storagePath: bucket === 'verification-documents' ? storagePath : null,
      enabled: canFetch,
    });
  }, [bucket, canFetch, safeDocId, storagePath]);

  const retry = useCallback(() => {
    void controllerRef.current?.refreshNow();
  }, []);

  const clear = useCallback(() => {
    controllerRef.current?.setTarget({
      bucket,
      documentId: safeDocId,
      storagePath: null,
      enabled: false,
    });
  }, [bucket, safeDocId]);

  return {
    ...state,
    retry,
    clear,
    memoryPolicy: SIGNED_URL_MEMORY_ONLY_POLICY,
  };
}
