import type { FileContent, FileEncoding } from '@shared/types'

export const MAX_EDITABLE_BYTES = 5 * 1024 * 1024

const BINARY_SNIFF_BYTES = 8000
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf])

// Mesma heurística do Git: um byte nulo nos primeiros 8000 bytes indica binário.
export function looksBinary(buf: Buffer): boolean {
  return buf.subarray(0, BINARY_SNIFF_BYTES).includes(0)
}

export function decodeText(buf: Buffer): FileContent {
  if (buf.subarray(0, 3).equals(UTF8_BOM)) {
    return { content: buf.subarray(3).toString('utf8'), encoding: 'utf8bom' }
  }
  return { content: buf.toString('utf8'), encoding: 'utf8' }
}

export function encodeText(content: string, encoding: FileEncoding): Buffer {
  const body = Buffer.from(content, 'utf8')
  return encoding === 'utf8bom' ? Buffer.concat([UTF8_BOM, body]) : body
}
