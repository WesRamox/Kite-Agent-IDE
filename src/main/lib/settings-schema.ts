import { z } from 'zod'
import { DEFAULT_SETTINGS, FONT_MAX, FONT_MIN } from '@shared/settings'
import { THEMES, type ThemeId } from '@shared/themes'

// Campos do settings.json. Cada um tem padrão e é validado sozinho: um valor inválido (ou um
// arquivo antigo, só com o tema) não derruba o resto.

export const themeSchema = z.enum(THEMES.map((t) => t.id) as [ThemeId, ...ThemeId[]])
export { DEFAULT_SETTINGS }

const fields = {
  language: z.enum(['pt-BR']),
  editorFontSize: z.number().int().min(FONT_MIN).max(FONT_MAX),
  terminalFontSize: z.number().int().min(FONT_MIN).max(FONT_MAX),
  restoreTerminals: z.boolean(),
  notifications: z.boolean(),
}

export const settingsSchema = z.object({
  theme: themeSchema.catch(DEFAULT_SETTINGS.theme),
  language: fields.language.catch(DEFAULT_SETTINGS.language),
  editorFontSize: fields.editorFontSize.catch(DEFAULT_SETTINGS.editorFontSize),
  terminalFontSize: fields.terminalFontSize.catch(DEFAULT_SETTINGS.terminalFontSize),
  restoreTerminals: fields.restoreTerminals.catch(DEFAULT_SETTINGS.restoreTerminals),
  notifications: fields.notifications.catch(DEFAULT_SETTINGS.notifications),
})

// Atualização vinda do renderer: só campos conhecidos e válidos (o tema tem canal próprio).
export const settingsPatchSchema = z.object(fields).partial().strict()
