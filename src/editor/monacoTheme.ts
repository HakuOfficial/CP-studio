/**
 * Monaco theme used by CP Studio.
 *
 * The editor background must stay transparent so Windows Acrylic/Blur/Mica can
 * remain visible through the WebView. Opaque widgets such as completion lists
 * keep a dark background for readability.
 */
export const CP_STUDIO_GLASS_THEME = 'cpstudio-glass'

export function installCpStudioMonacoTheme(monaco: any) {
  monaco.editor.defineTheme(CP_STUDIO_GLASS_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#00000000',
      'editorGutter.background': '#00000000',
      'minimap.background': '#00000000',
      'editorStickyScroll.background': '#111114E6',
      'editorWidget.background': '#1B1B1FF2',
      'editorWidget.border': '#FFFFFF1A',
      'editorSuggestWidget.background': '#1B1B1FF5',
      'editorSuggestWidget.border': '#FFFFFF1A',
      'editorHoverWidget.background': '#1B1B1FF5',
      'editorHoverWidget.border': '#FFFFFF1A',
      'editorFindMatch.background': '#0A84FF55',
      'editorFindMatchHighlight.background': '#0A84FF2F',
      'editor.lineHighlightBackground': '#FFFFFF08',
      'editorLineNumber.foreground': '#5D5D64',
      'editorLineNumber.activeForeground': '#B6B6BC',
    },
  })
}
