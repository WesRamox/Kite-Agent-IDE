import { z } from 'zod'

export const absPath = z.string().min(1).max(4096)
