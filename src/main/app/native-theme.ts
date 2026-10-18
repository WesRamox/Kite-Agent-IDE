import { BrowserWindow, nativeTheme } from 'electron'
import { DEFAULT_THEME, themeInfo, type ThemeId } from '@shared/themes'

// Tema fora do renderer: fundo das janelas e diálogos/menus nativos claros ou escuros.
export class NativeTheme {
  private current: ThemeId = DEFAULT_THEME

  get background(): string {
    return themeInfo(this.current).background
  }

  apply(theme: ThemeId): void {
    this.current = theme
    const info = themeInfo(theme)
    nativeTheme.themeSource = info.kind
    for (const win of BrowserWindow.getAllWindows()) win.setBackgroundColor(info.background)
  }
}
