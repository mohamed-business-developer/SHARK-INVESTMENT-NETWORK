import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMPANY_SELF_SELECT_COLUMNS } from '../../apps/mobile/src/repositories/company.repository';
import { PUBLIC_COMPANY_DIRECTORY_SELECT_COLUMNS } from '../../apps/mobile/src/repositories/directory.repository';
import {
  INVESTMENT_INTEREST_FOUNDER_SELECT_COLUMNS,
  INVESTMENT_INTEREST_INVESTOR_SELECT_COLUMNS,
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

    // Non-owner / investor projections must remain strictly isolated from founder_notes
    const founderProjectionUsages =
      pitchRepoContent.match(/INVESTMENT_INTEREST_FOUNDER_SELECT_COLUMNS/g) ?? [];
    expect(founderProjectionUsages).toHaveLength(3); // 1 declaration + 2 operator-gated usages
    expect(pitchRepoContent).toMatch(
      /async\s+listPitchInvestmentInterests\([\s\S]*?verifyCompanyOperator\([\s\S]*?INVESTMENT_INTEREST_FOUNDER_SELECT_COLUMNS/,
    );
    expect(pitchRepoContent).toMatch(
      /async\s+respondToInvestmentInterest\([\s\S]*?verifyCompanyOperator\([\s\S]*?INVESTMENT_INTEREST_FOUNDER_SELECT_COLUMNS/,
    );

    for (const methodName of [
      'listOwnInvestmentInterests',
      'submitInvestmentInterest',
      'withdrawInvestmentInterest',
    ]) {
      const startIndex = pitchRepoContent.indexOf(`async ${methodName}(`);
      expect(startIndex).toBeGreaterThan(-1);
      const nextMethodOffset = pitchRepoContent.slice(startIndex + 1).search(/\n\s+async\s+/);
      const methodBody =
        nextMethodOffset === -1
          ? pitchRepoContent.slice(startIndex)
          : pitchRepoContent.slice(startIndex, startIndex + 1 + nextMethodOffset);
      expect(methodBody).not.toContain('INVESTMENT_INTEREST_FOUNDER_SELECT_COLUMNS');
      expect(methodBody).toContain('INVESTMENT_INTEREST_INVESTOR_SELECT_COLUMNS');
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
