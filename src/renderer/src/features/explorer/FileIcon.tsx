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
  ts: [FileCode, 'text-sky-400 light:text-sky-600'],
  tsx: [FileCode, 'text-sky-400 light:text-sky-600'],
  js: [FileCode, 'text-yellow-300 light:text-yellow-600'],
  jsx: [FileCode, 'text-yellow-300 light:text-yellow-600'],
  mjs: [FileCode, 'text-yellow-300 light:text-yellow-600'],
  cjs: [FileCode, 'text-yellow-300 light:text-yellow-600'],
  py: [FileCode, 'text-emerald-300 light:text-emerald-700'],
  go: [FileCode, 'text-cyan-300 light:text-cyan-700'],
  rs: [FileCode, 'text-orange-300 light:text-orange-600'],
  css: [FileCode, 'text-pink-300 light:text-pink-600'],
  html: [FileCode, 'text-orange-400 light:text-orange-600'],
  json: [FileJson, 'text-amber-300 light:text-amber-600'],
  md: [FileText, 'text-slate-300 light:text-slate-500'],
  txt: [FileText, 'text-slate-300 light:text-slate-500'],
  png: [FileImage, 'text-violet-300 light:text-violet-600'],
  jpg: [FileImage, 'text-violet-300 light:text-violet-600'],
  jpeg: [FileImage, 'text-violet-300 light:text-violet-600'],
  gif: [FileImage, 'text-violet-300 light:text-violet-600'],
  svg: [FileImage, 'text-violet-300 light:text-violet-600'],
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
