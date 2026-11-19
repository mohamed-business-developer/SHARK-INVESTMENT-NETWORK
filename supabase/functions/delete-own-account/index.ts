import { z } from 'zod';
import { buildCorsHeaders } from '../_shared/cors.ts';
import {
  createAnonAuthClient,
  createServiceAdminClient,
  requireAuthenticatedActor,
} from '../_shared/auth.ts';
import { insertAuditLog } from '../_shared/audit.ts';
import { EdgeFunctionError, handleEdgeError, jsonResponse } from '../_shared/errors.ts';
import { enforceRateLimit, hashIpAddress } from '../_shared/rate-limit.ts';
import { parseJsonBody } from '../_shared/validation.ts';

const deleteAccountSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    confirmationPhrase: z.literal('DELETE'),
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

    await enforceRateLimit(adminClient, `delete_own_account:${actor.userId}`, 3, 86400);
    const payload = await parseJsonBody(req, deleteAccountSchema);

    if (actor.role === 'admin' || actor.adminRole !== null) {
      throw new EdgeFunctionError(
        403,
        'ADMIN_SELF_DELETE_FORBIDDEN',
        'errors.adminCannotSelfDelete',
      );
    }

    // Re-authenticate password before irreversible account erasure
    const anonClient = createAnonAuthClient();
    const { data: reauthData, error: reauthErr } = await anonClient.auth.signInWithPassword({
      email: actor.email,
      password: payload.currentPassword,
    });

    if (reauthErr || !reauthData.user || reauthData.user.id !== actor.userId) {
      throw new EdgeFunctionError(403, 'REAUTHENTICATION_FAILED', 'errors.invalidCredentials');
    }

    // Block deletion while still sole owner of active multi-member companies
    const { data: ownedCompanies, error: companyErr } = await adminClient
      .from('companies')
      .select('id')
      .eq('owner_id', actor.userId)
      .is('deleted_at', null);

    if (companyErr) {
      throw new EdgeFunctionError(500, 'COMPANY_CHECK_FAILED', 'errors.unexpected');
    }

    const ownedCompanyIds = (ownedCompanies ?? []).map((c) => String(c.id));
    if (ownedCompanyIds.length > 0) {
      const { data: otherMembers } = await adminClient
        .from('company_members')
        .select('id')
        .in('company_id', ownedCompanyIds)
        .neq('user_id', actor.userId)
        .eq('status', 'active')
        .is('deleted_at', null)
        .limit(1);

      if (otherMembers && otherMembers.length > 0) {
        throw new EdgeFunctionError(
          409,
          'OWNERSHIP_TRANSFER_REQUIRED',
          'errors.ownershipTransferRequired',
        );
      }

      // Clean up solo-company confidential documents before deleting solo companies
      for (const companyId of ownedCompanyIds) {
        const { data: docs } = await adminClient
          .from('pitch_documents')
          .select('storage_path')
          .eq('company_id', companyId);

        const docPaths = (docs ?? [])
          .map((d) => String(d.storage_path ?? ''))
          .filter((p) => p.length > 0);
        if (docPaths.length > 0) {
          await adminClient.storage.from('pitch-documents').remove(docPaths);
        }
      }

      const { error: soloDeleteErr } = await adminClient
        .from('companies')
        .delete()
        .in('id', ownedCompanyIds);

      if (soloDeleteErr) {
        throw new EdgeFunctionError(
          409,
          'OWNERSHIP_TRANSFER_REQUIRED',
          'errors.ownershipTransferRequired',
        );
      }
    }

    // Clean up private storage objects owned directly by the user
    for (const bucket of ['verification-documents', 'public-assets'] as const) {
      const { data: files } = await adminClient.storage.from(bucket).list(actor.userId, {
        limit: 100,
      });
      if (files && files.length > 0) {
        const paths = files.map((file) => `${actor.userId}/${file.name}`);
        await adminClient.storage.from(bucket).remove(paths);
      }
    }

    await adminClient.from('device_tokens').delete().eq('user_id', actor.userId);
    await adminClient.from('saved_items').delete().eq('user_id', actor.userId);

    const ipHash = await hashIpAddress(req);
    await insertAuditLog(adminClient, {
      actor,
      action: 'account.self_deleted',
      entityType: 'profiles',
      entityId: actor.userId,
      previousState: { role: actor.role, account_status: actor.accountStatus },
      newState: { deleted: true },
      metadata: { anonymized: true },
      requestId,
      ipHash,
    });

    // Global session revocation and Auth user erasure (activity_logs.actor_id -> NULL via ON DELETE SET NULL)
    await adminClient.auth.admin.signOut(actor.userId, 'global');
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(actor.userId);
    if (deleteErr) {
      throw new EdgeFunctionError(500, 'ACCOUNT_DELETE_FAILED', 'errors.unexpected');
    }

    return jsonResponse(req, 200, {
      success: true,
      requestId,
    });
  } catch (err) {
    return handleEdgeError(req, 'delete-own-account', requestId, err, actorId);
  }
});
