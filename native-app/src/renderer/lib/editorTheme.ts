import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

export const notionTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      fontSize: '15px',
      backgroundColor: '#ffffff',
      color: '#000000',
    },
    '.cm-scroller': {
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      lineHeight: '1.5',
    },
    '.cm-content': {
      padding: '16px 24px',
      caretColor: '#0075de',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#0075de',
    },
    '.cm-selectionBackground': {
      backgroundColor: 'rgba(0,117,222,0.15)',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(0,117,222,0.05)',
    },
    '.cm-gutters': {
      backgroundColor: '#ffffff',
      borderRight: '1px solid #e6e6e6',
      color: '#a39e98',
    },
    '&.cm-focused': {
      outline: 'none',
    },
  },
  { dark: false },
);

const notionHighlight = HighlightStyle.define([
  { tag: [tags.heading1, tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6], color: '#000000', fontWeight: '600' },
  { tag: tags.strong, color: '#000000', fontWeight: '600' },
  { tag: tags.emphasis, color: '#31302e', fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#a39e98' },
  { tag: tags.link, color: '#0075de', textDecoration: 'underline' },
  { tag: tags.url, color: '#615d59' },
  { tag: tags.comment, color: '#a39e98', fontStyle: 'italic' },
  { tag: tags.quote, color: '#615d59' },
  { tag: tags.meta, color: '#a39e98' },
  { tag: tags.list, color: '#0075de' },
  { tag: tags.monospace, fontFamily: "SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace", color: '#005bab' },
  { tag: tags.invalid, color: '#dd5b00' },
]);

export const notionEditorExtensions = syntaxHighlighting(notionHighlight);
