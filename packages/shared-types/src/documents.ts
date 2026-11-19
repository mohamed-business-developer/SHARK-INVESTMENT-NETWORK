import type { DocumentScanStatus, PitchDocumentCategory } from './enums';

export type StorageBucketName = 'public-assets' | 'pitch-documents' | 'verification-documents';

export type PrivateStorageBucketName = 'pitch-documents' | 'verification-documents';

export interface PitchDocumentRow {
  readonly id: string;
  readonly pitch_id: string;
  readonly company_id: string;
  readonly uploaded_by: string;
  readonly category: PitchDocumentCategory;
  readonly title_ar: string | null;
  readonly title_en: string | null;
  readonly file_name: string;
  readonly storage_bucket: 'pitch-documents';
  readonly storage_path: string;
  readonly mime_type: string;
  readonly file_size_bytes: number;
  readonly checksum_sha256: string | null;
  readonly is_restricted: boolean;
  readonly restriction_reason: string | null;
  readonly restricted_at: string | null;
  readonly restricted_by: string | null;
  readonly scan_status: DocumentScanStatus;
  readonly is_active: boolean;
  readonly sort_order: number;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

export interface GetSignedDocumentUrlRequest {
  readonly bucket: PrivateStorageBucketName;
  readonly documentId: string;
  readonly storagePath?: string;
}

export interface GetSignedDocumentUrlResponse {
  readonly signedUrl: string;
  readonly expiresAt: string;
  readonly ttlSeconds: number;
  readonly contentType: string;
  readonly fileName: string;
}
