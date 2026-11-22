import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMPANY_SELF_SELECT_COLUMNS } from '../../apps/mobile/src/repositories/company.repository';
import { PUBLIC_COMPANY_DIRECTORY_SELECT_COLUMNS } from '../../apps/mobile/src/repositories/directory.repository';
import {
  INVESTMENT_INTEREST_FOUNDER_SELECT_COLUMNS,
  INVESTMENT_INTEREST_INVESTOR_SELECT_COLUMNS,
  PITCH_DOCUMENT_INVESTOR_SELECT_COLUMNS,
  PITCH_DOCUMENT_OPERATOR_SELECT_COLUMNS,
  PITCH_INVESTOR_SELECT_COLUMNS,
  PITCH_OPERATOR_SELECT_COLUMNS,
  PITCH_REVIEW_SELECT_COLUMNS,
} from '../../apps/mobile/src/repositories/pitch.repository';
import { VERIFICATION_REQUEST_SELECT_COLUMNS } from '../../apps/mobile/src/repositories/verification.repository';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

function collectTsFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.expo', 'dist'].includes(entry.name)) {
      continue;
    }
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('P5-U04 Repository, Service & Hook Security Hygiene', () => {
  const mobileRepoFiles = collectTsFiles(resolve(REPO_ROOT, 'apps/mobile/src/repositories'));
  const mobileHookFiles = collectTsFiles(resolve(REPO_ROOT, 'apps/mobile/src/hooks'));
  const adminRepoFiles = collectTsFiles(resolve(REPO_ROOT, 'apps/admin/src/repositories'));
  const adminActionFiles = collectTsFiles(resolve(REPO_ROOT, 'apps/admin/src/actions'));

  it('forbids unbounded .select(*) across all Mobile & Admin repositories', () => {
    expect(mobileRepoFiles.length).toBeGreaterThanOrEqual(7);

    for (const file of [...mobileRepoFiles, ...adminRepoFiles]) {
      const content = readFileSync(file, 'utf8');
      expect(content, `Forbidden .select('*') in ${file}`).not.toMatch(/\.select\(\s*['"]\*['"]/);
    }

    expect(VERIFICATION_REQUEST_SELECT_COLUMNS).not.toContain('internal_notes');
    expect(PITCH_REVIEW_SELECT_COLUMNS).not.toContain('internal_notes');
    expect(INVESTMENT_INTEREST_INVESTOR_SELECT_COLUMNS).not.toContain('founder_notes');
    expect(INVESTMENT_INTEREST_FOUNDER_SELECT_COLUMNS).toContain('founder_notes');

    for (const pitchModField of [
      'rejection_reason',
      'approved_by',
      'restricted_at',
      'restricted_by',
    ]) {
      expect(PITCH_INVESTOR_SELECT_COLUMNS).not.toContain(pitchModField);
      expect(PITCH_OPERATOR_SELECT_COLUMNS).toContain(pitchModField);
    }

    for (const docInternalField of [
      'storage_path',
      'storage_bucket',
      'restriction_reason',
      'restricted_at',
      'restricted_by',
      'scan_status',
      'uploaded_by',
    ]) {
      expect(PITCH_DOCUMENT_INVESTOR_SELECT_COLUMNS).not.toContain(docInternalField);
    }

    for (const docOperatorField of [
      'storage_path',
      'restriction_reason',
      'restricted_by',
      'scan_status',
      'uploaded_by',
    ]) {
      expect(PITCH_DOCUMENT_OPERATOR_SELECT_COLUMNS).toContain(docOperatorField);
    }

    for (const privateField of [
      'registration_number',
      'admin_feedback',
      'rejection_reason',
      'approved_by',
      'verified_by',
      'owner_id',
    ]) {
      expect(PUBLIC_COMPANY_DIRECTORY_SELECT_COLUMNS).not.toContain(privateField);
    }

    for (const operatorField of [
      'registration_number',
      'admin_feedback',
      'rejection_reason',
      'approved_by',
      'verified_by',
    ]) {
      expect(COMPANY_SELF_SELECT_COLUMNS).toContain(operatorField);
    }

    const directoryRepoFile = mobileRepoFiles.find((file) =>
      file.replaceAll('\\', '/').endsWith('/directory.repository.ts'),
    );
    const companyRepoFile = mobileRepoFiles.find((file) =>
      file.replaceAll('\\', '/').endsWith('/company.repository.ts'),
    );
    const pitchRepoFile = mobileRepoFiles.find((file) =>
      file.replaceAll('\\', '/').endsWith('/pitch.repository.ts'),
    );

    expect(directoryRepoFile).toBeDefined();
    expect(companyRepoFile).toBeDefined();
    expect(pitchRepoFile).toBeDefined();

    const directoryRepoContent = readFileSync(directoryRepoFile ?? '', 'utf8');
    const companyRepoContent = readFileSync(companyRepoFile ?? '', 'utf8');
    const pitchRepoContent = readFileSync(pitchRepoFile ?? '', 'utf8');

    expect(directoryRepoContent).not.toContain('COMPANY_SELF_SELECT_COLUMNS');
    expect(companyRepoContent).toMatch(
      /async\s+getOperatedCompanyById\([\s\S]*?verifyCompanyOperator\(/,
    );

    const sliceMethodBody = (source: string, methodName: string): string => {
      const startIndex = source.indexOf(`async ${methodName}(`);
      expect(startIndex, `Missing method ${methodName}`).toBeGreaterThan(-1);
      const nextMethodOffset = source.slice(startIndex + 1).search(/\n\s+async\s+/);
      return nextMethodOffset === -1
        ? source.slice(startIndex)
        : source.slice(startIndex, startIndex + 1 + nextMethodOffset);
    };

    const assertOperatorGatedUsage = (methodName: string, projectionConstant: string): void => {
      const body = sliceMethodBody(pitchRepoContent, methodName);
      const guardMatch = body.match(
        /(verifyCompanyOperator|requireCompanyOperatorAccess|requireEntityCompanyOperator)\(/,
      );
      const selectIndex = body.indexOf(projectionConstant);
      expect(guardMatch, `${methodName} missing operator guard`).not.toBeNull();
      expect(selectIndex, `${methodName} missing ${projectionConstant}`).toBeGreaterThan(-1);
      expect(guardMatch?.index ?? Infinity).toBeLessThan(selectIndex);
    };

    // Investor-facing methods must strictly use investor projections & never reference operator projections
    for (const investorPitchMethod of [
      'listAccessiblePitches',
      'getAccessiblePitchById',
      'listCompanyAccessiblePitches',
    ]) {
      const body = sliceMethodBody(pitchRepoContent, investorPitchMethod);
      expect(body).toContain('PITCH_INVESTOR_SELECT_COLUMNS');
      expect(body).not.toContain('PITCH_OPERATOR_SELECT_COLUMNS');
    }

    const investorDocBody = sliceMethodBody(pitchRepoContent, 'listPitchDocuments');
    expect(investorDocBody).toContain('PITCH_DOCUMENT_INVESTOR_SELECT_COLUMNS');
    expect(investorDocBody).not.toContain('PITCH_DOCUMENT_OPERATOR_SELECT_COLUMNS');

    for (const investorInterestMethod of [
      'listOwnInvestmentInterests',
      'submitInvestmentInterest',
      'withdrawInvestmentInterest',
    ]) {
      const body = sliceMethodBody(pitchRepoContent, investorInterestMethod);
      expect(body).toContain('INVESTMENT_INTEREST_INVESTOR_SELECT_COLUMNS');
      expect(body).not.toContain('INVESTMENT_INTEREST_FOUNDER_SELECT_COLUMNS');
    }

    // Operator-only projections may appear ONLY in their export declaration + operator-gated methods
    expect(pitchRepoContent.match(/PITCH_OPERATOR_SELECT_COLUMNS/g) ?? []).toHaveLength(6);
    for (const opPitchMethod of [
      'listCompanyPitches',
      'getOperatedPitchById',
      'createDraftPitch',
      'updatePitch',
      'transitionPitch',
    ]) {
      assertOperatorGatedUsage(opPitchMethod, 'PITCH_OPERATOR_SELECT_COLUMNS');
    }

    expect(pitchRepoContent.match(/PITCH_DOCUMENT_OPERATOR_SELECT_COLUMNS/g) ?? []).toHaveLength(4);
    for (const opDocMethod of [
      'listOperatedPitchDocuments',
      'createPitchDocument',
      'updatePitchDocumentMetadata',
    ]) {
      assertOperatorGatedUsage(opDocMethod, 'PITCH_DOCUMENT_OPERATOR_SELECT_COLUMNS');
    }

    expect(
      pitchRepoContent.match(/INVESTMENT_INTEREST_FOUNDER_SELECT_COLUMNS/g) ?? [],
    ).toHaveLength(3);
    for (const opInterestMethod of [
      'listPitchInvestmentInterests',
      'respondToInvestmentInterest',
    ]) {
      assertOperatorGatedUsage(opInterestMethod, 'INVESTMENT_INTEREST_FOUNDER_SELECT_COLUMNS');
    }
  });

  it('prevents Mobile from referencing internal_notes, server-only Admin clients, service role keys, or private bucket getPublicUrl()', () => {
    for (const file of [...mobileRepoFiles, ...mobileHookFiles]) {
      const content = readFileSync(file, 'utf8');
      expect(content, `Forbidden internal_notes reference in ${file}`).not.toContain(
        'internal_notes',
      );
      expect(content, `Forbidden SUPABASE_SERVICE_ROLE_KEY reference in ${file}`).not.toContain(
        'SUPABASE_SERVICE_ROLE_KEY',
      );
      expect(content, `Forbidden admin client import in ${file}`).not.toMatch(
        /lib\/supabase\/admin/,
      );
      expect(content, `Forbidden private bucket URL or upload call in ${file}`).not.toMatch(
        /from\(\s*['"](?:pitch-documents|verification-documents)['"]\s*\)\.(?:getPublicUrl|createSignedUrl|upload)/,
      );
    }
  });

  it('keeps public discovery & search hooks strictly free of pitches and private raw tables', () => {
    for (const hookFile of [
      resolve(REPO_ROOT, 'apps/mobile/src/hooks/useDiscovery.ts'),
      resolve(REPO_ROOT, 'apps/mobile/src/hooks/useSearch.ts'),
      resolve(REPO_ROOT, 'apps/mobile/src/repositories/directory.repository.ts'),
    ]) {
      const content = readFileSync(hookFile, 'utf8');
      expect(content, `Discovery/search file ${hookFile} must not query pitches`).not.toMatch(
        /\.from\(\s*['"](?:pitches|pitch_documents|verification_requests|profiles|activity_logs)['"]\s*\)/,
      );
    }
  });

  it('keeps Admin server boundaries and Origin/AdminContext guards intact', () => {
    for (const serverFile of [
      'apps/admin/src/lib/supabase/admin.ts',
      'apps/admin/src/lib/env.server.ts',
      'apps/admin/src/lib/auth/guards.ts',
      'apps/admin/src/lib/auth/audit.ts',
    ]) {
      const content = readFileSync(resolve(REPO_ROOT, serverFile), 'utf8');
      expect(content, `${serverFile} missing 'server-only'`).toMatch(/import ['"]server-only['"];/);
    }

    for (const file of [...adminRepoFiles, ...adminActionFiles]) {
      const content = readFileSync(file, 'utf8');
      expect(content, `Forbidden getSession() in ${file}`).not.toMatch(/\bgetSession\s*\(/);
    }
  });
});
