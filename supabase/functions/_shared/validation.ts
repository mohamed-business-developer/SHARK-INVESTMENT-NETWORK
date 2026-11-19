import { z } from 'zod';
import { EdgeFunctionError } from './errors.ts';

export const uuidSchema = z.string().uuid();

export const safeStoragePathSchema = z
  .string()
  .trim()
  .min(5)
  .max(300)
  .refine(
    (p) =>
      !p.includes('..') &&
      !p.includes('\\') &&
      !p.includes('\0') &&
      !p.startsWith('/') &&
      !/%2e|%2f|%5c/i.test(p),
  );

export async function parseJsonBody<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new EdgeFunctionError(400, 'BAD_JSON', 'validation.json.invalid');
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new EdgeFunctionError(
      400,
      'VALIDATION_ERROR',
      firstIssue?.message ?? 'validation.payload.invalid',
    );
  }
  return parsed.data;
}
