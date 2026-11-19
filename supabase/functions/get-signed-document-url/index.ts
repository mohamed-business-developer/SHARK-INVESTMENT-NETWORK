import { z } from 'zod';
import { buildCorsHeaders } from '../_shared/cors.ts';
import { createServiceAdminClient, requireAuthenticatedActor } from '../_shared/auth.ts';
import { insertAuditLog } from '../_shared/audit.ts';
import { EdgeFunctionError, handleEdgeError, jsonResponse } from '../_shared/errors.ts';
import { enforceRateLimit, hashIpAddress } from '../_shared/rate-limit.ts';
import { parseJsonBody, safeStoragePathSchema, uuidSchema } from '../_shared/validation.ts';

const requestSchema = z
  .object({
    bucket: z.enum(['pitch-documents', 'verification-documents']),
    documentId: uuidSchema,
    storagePath: safeStoragePathSchema.optional(),
  })
  .strict();

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: buildCorsHeaders(req) });
  }

  const requestId = crypto.randomUUID();
  let actorId: string | undefined;

  try {
    if (req.method !== 'POST') {
      throw new EdgeFunctionError(405, 'METHOD_NOT_ALLOWED', 'errors.methodNotAllowed');
    }

    const adminClient = createServiceAdminClient();
    const actor = await requireAuthenticatedActor(req, adminClient);
    actorId = actor.userId;

    await enforceRateLimit(adminClient, `signed_url:${actor.userId}`, 20, 60);

    const payload = await parseJsonBody(req, requestSchema);
    const ipHash = await hashIpAddress(req);
    const maxStandardTtl = Math.min(
      Number(Deno.env.get('SIGNED_URL_TTL_SECONDS') ?? '120') || 120,
      120,
    );

    if (payload.bucket === 'verification-documents') {
      const { data: vr, error: vrErr } = await adminClient
        .from('verification_requests')
        .select('id, user_id, document_paths, deleted_at')
        .eq('id', payload.documentId)
        .is('deleted_at', null)
        .maybeSingle();

      if (vrErr || !vr) {
        throw new EdgeFunctionError(404, 'NOT_FOUND', 'errors.documentNotFound');
      }

      const isOwner = vr.user_id === actor.userId;
      const isComplianceAdmin =
        actor.role === 'admin' &&
        actor.accountStatus === 'approved' &&
        actor.adminRole !== null &&
        (actor.adminRole.roleName === 'super_admin' ||
          actor.adminRole.permissions.includes('verifications:read'));

      if (!isOwner && !isComplianceAdmin) {
        throw new EdgeFunctionError(403, 'FORBIDDEN', 'errors.documentForbidden');
      }

      const docs = Array.isArray(vr.document_paths)
        ? (vr.document_paths as Array<Record<string, unknown>>)
        : [];
      const targetDoc = payload.storagePath
        ? docs.find((d) => d.path === payload.storagePath)
        : docs[0];

      if (!targetDoc || typeof targetDoc.path !== 'string') {
        throw new EdgeFunctionError(404, 'NOT_FOUND', 'errors.documentNotFound');
      }
      if (!targetDoc.path.startsWith(`${String(vr.user_id)}/`)) {
        throw new EdgeFunctionError(403, 'FORBIDDEN', 'errors.documentForbidden');
      }
      if (targetDoc.scan_status === 'quarantined') {
        throw new EdgeFunctionError(403, 'DOCUMENT_QUARANTINED', 'errors.documentQuarantined');
      }

      const ttlSeconds = 60;
      const { data: signed, error: signErr } = await adminClient.storage
        .from('verification-documents')
        .createSignedUrl(targetDoc.path, ttlSeconds);

      if (signErr || !signed?.signedUrl) {
        throw new EdgeFunctionError(500, 'SIGNED_URL_FAILED', 'errors.unexpected');
      }

      if (isComplianceAdmin && !isOwner) {
        await insertAuditLog(adminClient, {
          actor,
          action: 'verification.document_viewed',
          entityType: 'verification_requests',
          entityId: vr.id as string,
          metadata: { storage_path: targetDoc.path },
          requestId,
          ipHash,
        });
      }

      return jsonResponse(req, 200, {
        signedUrl: signed.signedUrl,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
        ttlSeconds,
        contentType: String(targetDoc.mime_type ?? 'application/pdf'),
        fileName: String(targetDoc.file_name ?? 'verification-document'),
      });
    }

    // bucket === 'pitch-documents'
    const { data: doc, error: docErr } = await adminClient
      .from('pitch_documents')
      .select(
        'id, pitch_id, company_id, file_name, storage_path, mime_type, is_restricted, scan_status, is_active, deleted_at',
      )
      .eq('id', payload.documentId)
      .is('deleted_at', null)
      .maybeSingle();

    if (docErr || !doc || !doc.is_active) {
      throw new EdgeFunctionError(404, 'NOT_FOUND', 'errors.documentNotFound');
    }

    if (doc.scan_status === 'quarantined') {
      throw new EdgeFunctionError(403, 'DOCUMENT_QUARANTINED', 'errors.documentQuarantined');
    }

    const storagePath = String(doc.storage_path ?? '');
    if (!storagePath.startsWith(`${String(doc.company_id)}/${String(doc.pitch_id)}/`)) {
      throw new EdgeFunctionError(403, 'FORBIDDEN', 'errors.documentForbidden');
    }

    const { data: pitch } = await adminClient
      .from('pitches')
      .select('id, status, company_id, deleted_at')
      .eq('id', doc.pitch_id)
      .is('deleted_at', null)
      .maybeSingle();

    const { data: company } = await adminClient
      .from('companies')
      .select('id, owner_id, status, deleted_at')
      .eq('id', doc.company_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (!pitch || !company) {
      throw new EdgeFunctionError(404, 'NOT_FOUND', 'errors.documentNotFound');
    }

    const isAdminReader =
      actor.role === 'admin' &&
      actor.accountStatus === 'approved' &&
      actor.adminRole !== null &&
      (actor.adminRole.roleName === 'super_admin' ||
        actor.adminRole.permissions.includes('pitches:read'));

    let isCompanyOperator = false;
    if (actor.accountStatus === 'approved' && company.status !== 'suspended') {
      if (company.owner_id === actor.userId) {
        isCompanyOperator = true;
      } else {
        const { data: member } = await adminClient
          .from('company_members')
          .select('id')
          .eq('company_id', company.id)
          .eq('user_id', actor.userId)
          .eq('status', 'active')
          .is('deleted_at', null)
          .maybeSingle();
        isCompanyOperator = Boolean(member);
      }
    }

    let isAuthorizedViewer = isAdminReader || isCompanyOperator;

    if (!isAuthorizedViewer) {
      if (actor.accountStatus !== 'approved') {
        throw new EdgeFunctionError(403, 'ACCOUNT_NOT_APPROVED', 'errors.accountApprovalRequired');
      }
      if (company.status !== 'approved') {
        throw new EdgeFunctionError(403, 'FORBIDDEN', 'errors.documentForbidden');
      }

      if (pitch.status === 'approved' && !doc.is_restricted) {
        isAuthorizedViewer = true;
      } else if (
        pitch.status === 'restricted' ||
        (pitch.status === 'approved' && doc.is_restricted)
      ) {
        const nowIso = new Date().toISOString();
        const { data: grant } = await adminClient
          .from('pitch_access_grants')
          .select('id, pitch_document_id, expires_at')
          .eq('pitch_id', pitch.id)
          .eq('user_id', actor.userId)
          .is('revoked_at', null)
          .or(`pitch_document_id.is.null,pitch_document_id.eq.${doc.id}`)
          .limit(5);

        const activeGrant = (grant ?? []).find(
          (g) =>
            (g.pitch_document_id === null || g.pitch_document_id === doc.id) &&
            (!g.expires_at || String(g.expires_at) > nowIso),
        );
        isAuthorizedViewer = Boolean(activeGrant);
      }
    }

    if (!isAuthorizedViewer) {
      throw new EdgeFunctionError(403, 'FORBIDDEN', 'errors.documentForbidden');
    }

    const isConfidential = Boolean(doc.is_restricted) || pitch.status === 'restricted';
    const ttlSeconds = isConfidential ? 60 : maxStandardTtl;

    const { data: signed, error: signErr } = await adminClient.storage
      .from('pitch-documents')
      .createSignedUrl(doc.storage_path as string, ttlSeconds);

    if (signErr || !signed?.signedUrl) {
      throw new EdgeFunctionError(500, 'SIGNED_URL_FAILED', 'errors.unexpected');
    }

    if (isAdminReader || isConfidential) {
      await insertAuditLog(adminClient, {
        actor,
        action: isConfidential ? 'pitch_document.restricted_viewed' : 'pitch_document.admin_viewed',
        entityType: 'pitch_documents',
        entityId: doc.id as string,
        metadata: { pitch_id: pitch.id },
        requestId,
        ipHash,
      });
    }

    return jsonResponse(req, 200, {
      signedUrl: signed.signedUrl,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      ttlSeconds,
      contentType: doc.mime_type,
      fileName: doc.file_name,
    });
  } catch (err) {
    return handleEdgeError(req, 'get-signed-document-url', requestId, err, actorId);
  }
});
