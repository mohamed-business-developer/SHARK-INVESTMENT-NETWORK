import type { SectorRow } from '@shark/shared-types';

/**
 * Bilingual Arabic/English search normalization & safe PostgREST filter builders.
 * Exact client-side companion to PostgreSQL `public.normalize_arabic_text(input)` (`0001`).
 */

const ARABIC_DIACRITICS_REGEX = /[\u064B-\u065F\u0670\u0640]/g;
const ARABIC_LETTER_REGEX = /[\u0600-\u06FF]/;
const ARABIC_BASE_GLYPH_REGEX = /[\u0621-\u064A]/;
// Explicit POSIX character list of Arabic diacritics/tatweel (avoids locale collation range assumptions)
const POSIX_OPTIONAL_DIACRITICS =
  '[\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652\u0653\u0654\u0655\u0656\u0657\u0658\u0659\u065A\u065B\u065C\u065D\u065E\u065F\u0670\u0640]*';

const POSTGREST_UNSAFE_DELIMITERS = /[(),'"\\;\r\n\t\0]/g;
const REGEX_META_CHARS = /[.*+?^${}[\]|/\\]/g;

/**
 * Mirrors PostgreSQL `public.normalize_arabic_text(input)`:
 * strips tashkeel/tatweel, lowercases Latin text, normalizes أ/إ/آ -> ا, ى -> ي, ة -> ه.
 */
export function normalizeArabicText(input: string): string {
  return input
    .toLowerCase()
    .replace(ARABIC_DIACRITICS_REGEX, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitizes and normalizes user search queries before building any PostgREST filter clause.
 */
export function sanitizeSearchQuery(rawQuery: string | null | undefined): string | null {
  if (!rawQuery) {
    return null;
  }
  const stripped = rawQuery.replace(POSTGREST_UNSAFE_DELIMITERS, ' ');
  const normalized = normalizeArabicText(stripped);
  return normalized.length > 0 ? normalized : null;
}

function escapePostgrestLikePattern(term: string): string {
  return term.replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/\*/g, '\\*');
}

function buildArabicPosixRegex(normalizedTerm: string): string {
  const parts: string[] = [];
  const chars = Array.from(normalizedTerm);

  chars.forEach((ch, idx) => {
    let token: string;
    if (ch === 'ا') {
      token = '[اأإآ]';
    } else if (ch === 'ي') {
      token = '[يى]';
    } else if (ch === 'ه') {
      token = '[هة]';
    } else if (ch === ' ') {
      token = '[[:space:]]+';
    } else {
      token = ch.replace(REGEX_META_CHARS, '\\$&');
    }

    parts.push(token);

    // Allow stored column text to contain optional tashkeel/tatweel between Arabic base letters
    const nextChar = chars[idx + 1];
    if (
      nextChar !== undefined &&
      ARABIC_BASE_GLYPH_REGEX.test(ch) &&
      ARABIC_BASE_GLYPH_REGEX.test(nextChar)
    ) {
      parts.push(POSIX_OPTIONAL_DIACRITICS);
    }
  });

  return parts.join('');
}

/**
 * Builds a PostgREST `.or(...)` search filter across explicit columns, supporting Arabic
 * diacritic/Alef/Taa-Marbuta equivalence via POSIX `imatch` (`~*`) and LIKE-escaped ASCII `ilike`.
 */
export function buildPostgrestSearchOrClause(
  columns: readonly string[],
  rawQuery: string | null | undefined,
): string | null {
  const normalized = sanitizeSearchQuery(rawQuery);
  if (!normalized || columns.length === 0) {
    return null;
  }

  if (ARABIC_LETTER_REGEX.test(normalized)) {
    const regexPattern = buildArabicPosixRegex(normalized);
    return columns.map((column) => `${column}.imatch.${regexPattern}`).join(',');
  }

  const escapedLike = escapePostgrestLikePattern(normalized);
  return columns.map((column) => `${column}.ilike.*${escapedLike}*`).join(',');
}

/**
 * Filters active sectors locally using diacritic-insensitive Arabic + case-insensitive English matching.
 */
export function filterSectorsByQuery(
  sectors: readonly SectorRow[],
  rawQuery: string | null | undefined,
): readonly SectorRow[] {
  const normalizedQuery = sanitizeSearchQuery(rawQuery);
  if (!normalizedQuery) {
    return [];
  }

  return sectors.filter((sector) => {
    const ar = normalizeArabicText(sector.name_ar);
    const en = normalizeArabicText(sector.name_en);
    const descAr = normalizeArabicText(sector.description_ar ?? '');
    const descEn = normalizeArabicText(sector.description_en ?? '');
    return (
      ar.includes(normalizedQuery) ||
      en.includes(normalizedQuery) ||
      descAr.includes(normalizedQuery) ||
      descEn.includes(normalizedQuery)
    );
  });
}
