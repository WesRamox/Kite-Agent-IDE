import { describe, expect, it } from 'vitest'
import { groupChanges } from './changed-files'

describe('groupChanges', () => {
  it('raiz primeiro, pastas e arquivos em ordem', () => {
    expect(
      groupChanges([
        { rel: 'src/pix/webhook.controller.ts', status: 'added' },
        { rel: 'package.json', status: 'modified' },
        { rel: 'prisma/schema.prisma', status: 'modified' },
        { rel: 'src/pix/charge.service.ts', status: 'modified' },
      ]),
    ).toEqual([
      { dir: '', files: [{ rel: 'package.json', status: 'modified', name: 'package.json' }] },
      {
        dir: 'prisma/',
        files: [{ rel: 'prisma/schema.prisma', status: 'modified', name: 'schema.prisma' }],
      },
      {
        dir: 'src/pix/',
        files: [
          { rel: 'src/pix/charge.service.ts', status: 'modified', name: 'charge.service.ts' },
          { rel: 'src/pix/webhook.controller.ts', status: 'added', name: 'webhook.controller.ts' },
        ],
      },
    ])
  })

  it('sem alterados, lista vazia', () => {
    expect(groupChanges([])).toEqual([])
  })
})
