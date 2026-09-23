import { z } from "zod";

export function getZodIssues(e: unknown): z.ZodIssue[] | null {
  if (e instanceof z.ZodError) return e.issues;
  return null;
}

export const registerUserSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter no mínimo 2 caracteres").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(254),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(128),
});

export const loginUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(8).max(256),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(128),
});

export const syncPushSchema = z.object({
  statuses: z
    .array(
      z.object({
        apartmentId: z.string().min(1).max(120),
        portal: z.string().min(1).max(40).default("zap"),
        urlOriginal: z.string().url().max(500).optional().default(""),
        status: z.string().min(1).max(40),
      }),
    )
    .max(500)
    .default([]),
  notes: z
    .array(
      z.object({
        apartmentId: z.string().min(1).max(120),
        portal: z.string().min(1).max(40).default("zap"),
        urlOriginal: z.string().url().max(500).optional().default(""),
        text: z.string().trim().min(1).max(2000),
      }),
    )
    .max(500)
    .default([]),
  followUps: z
    .array(
      z.object({
        apartmentId: z.string().min(1).max(120),
        portal: z.string().min(1).max(40).default("zap"),
        urlOriginal: z.string().url().max(500).optional().default(""),
        attempts: z.number().int().min(0).max(1000),
        status: z.enum(["aguardando", "retornou"]),
        lastContactAt: z.string().datetime({ offset: true }).nullable().optional(),
      }),
    )
    .max(500)
    .default([]),
});

export const removalRequestSchema = z.object({
  externalId: z.string().trim().min(1).max(120),
  portal: z.string().trim().min(1).max(40),
  reason: z.string().trim().max(1000).optional(),
  contactHint: z.string().trim().max(254).optional(),
});
