import { z } from 'zod'

// Validação, no Kite, do que chega do kite-mcp (pedido do agente) e do renderer (resposta). Fica
// fora de canvas-tools.ts porque aquele arquivo roda também no kite-mcp, fora do app, sem o zod.
export const bridgeRequestSchema = z.object({
  tool: z.enum(['list', 'read', 'write', 'send', 'navigate', 'screenshot']),
  args: z.object({
    block: z.string().max(200).optional(),
    text: z.string().max(100_000).optional(),
    mode: z.enum(['replace', 'append']).optional(),
    url: z.string().max(4000).optional(),
  }),
  caller: z.string().regex(/^(agent|node):[\w.:-]{1,200}$/),
})

// O que o renderer devolve (passa pelo main antes de ir ao agente).
export const toolResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    content: z
      .array(
        z.discriminatedUnion('type', [
          z.object({ type: z.literal('text'), text: z.string().max(200_000) }),
          z.object({
            type: z.literal('image'),
            data: z.string().max(20_000_000),
            mimeType: z.literal('image/png'),
          }),
        ]),
      )
      .max(10),
  }),
  z.object({ ok: z.literal(false), message: z.string().max(4000) }),
])
