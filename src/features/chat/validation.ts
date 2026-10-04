import { z } from 'zod';
const clean = z.string().transform((s) => s.normalize('NFC').trim());
export const profileSchema = z
  .object({
    nickname: clean.pipe(
      z
        .string()
        .min(2)
        .max(24)
        .regex(/^[\p{L}\p{N} ._-]+$/u),
    ),
    state: z.string().regex(/^[a-z]{2}$/),
    municipality: z.string().regex(/^\d{5}$/),
  })
  .strict();
export const messageSchema = z
  .object({
    text: clean.pipe(
      z
        .string()
        .min(1)
        .max(280)
        .refine(
          (s) =>
            !/[<>\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(s) &&
            !/(?:https?:|www\.|[\p{L}\p{N}-]+\.(?:com|br|net|org|io|gg|me|app)\b)/iu.test(s),
          'Use somente texto, sem links ou marcação.',
        ),
    ),
  })
  .strict();
export const idSchema = z.string().uuid();
export const reportSchema = z
  .object({
    messageId: idSchema,
    reason: z.enum(['abuso', 'spam', 'desinformacao', 'outro']),
  })
  .strict();
export const moderationSchema = z
  .object({
    messageId: idSchema,
    action: z.enum(['remove', 'block', 'dismiss']),
  })
  .strict();
