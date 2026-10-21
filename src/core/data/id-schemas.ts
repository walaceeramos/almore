import { z } from "zod";

/**
 * Identificadores dos dados do aparelho.
 *
 * Mora em `core` porque `features/routines` e `features/sessions` precisam
 * dos mesmos, e uma feature não importa de outra.
 */

/** Linha criada pelo app: sempre UUID v4 de `core/utils/uuid.ts`. */
export const rowIdSchema = z.string().uuid("Identificador inválido");

/**
 * Exercício, que tem duas origens de id e por isso não pode exigir UUID:
 *
 * - catálogo: o id **é o slug** (`"supino-reto-barra"`), porque o histórico
 *   aponta para ele e slug publicado não muda;
 * - personalizado: UUID, gerado no aparelho.
 *
 * Exigir UUID aqui rejeitava todo exercício do catálogo, e como as ações
 * saíam caladas quando o Zod barrava, o botão de adicionar parecia morto.
 *
 * Validar formato é só a primeira peneira: quem garante que o exercício
 * existe é `findExercise`, logo em seguida.
 */
export const exerciseIdSchema = z
  .string()
  .trim()
  .min(1, "Escolha um exercício")
  .max(80)
  .regex(/^[a-z0-9-]+$/i, "Identificador de exercício inválido");
