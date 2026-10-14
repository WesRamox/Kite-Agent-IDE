import {
  File,
  FileCode,
  FileImage,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  type LucideIcon,
} from 'lucide-react'

const BY_EXT: Record<string, [LucideIcon, string]> = {
  ts: [FileCode, 'text-sky-400'],
  tsx: [FileCode, 'text-sky-400'],
  js: [FileCode, 'text-yellow-300'],
  jsx: [FileCode, 'text-yellow-300'],
  mjs: [FileCode, 'text-yellow-300'],
  cjs: [FileCode, 'text-yellow-300'],
  py: [FileCode, 'text-emerald-300'],
  go: [FileCode, 'text-cyan-300'],
  rs: [FileCode, 'text-orange-300'],
  css: [FileCode, 'text-pink-300'],
  html: [FileCode, 'text-orange-400'],
  json: [FileJson, 'text-amber-300'],
  md: [FileText, 'text-slate-300'],
  txt: [FileText, 'text-slate-300'],
  png: [FileImage, 'text-violet-300'],
  jpg: [FileImage, 'text-violet-300'],
  jpeg: [FileImage, 'text-violet-300'],
  gif: [FileImage, 'text-violet-300'],
  svg: [FileImage, 'text-violet-300'],
}

interface Props {
  name: string
  kind: 'file' | 'directory'
  open?: boolean
}

export function FileIcon({ name, kind, open }: Props) {
  if (kind === 'directory') {
    const Icon = open ? FolderOpen : Folder
    return <Icon size={16} className="shrink-0 text-accent" />
  }
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  const [Icon, color] = BY_EXT[ext] ?? [File, 'text-fg-muted']
  return <Icon size={16} className={`shrink-0 ${color}`} />
}
