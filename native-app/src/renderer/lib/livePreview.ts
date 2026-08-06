import { RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';

interface DecRange {
  from: number;
  to: number;
  value: Decoration;
}

class EmptyWidget extends WidgetType {
  eq(): boolean {
    return true;
  }
  toDOM(): HTMLElement {
    return document.createElement('span');
  }
  ignoreEvent(): boolean {
    return true;
  }
}

const emptyWidget = new EmptyWidget();

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly pos: number,
  ) {
    super();
  }
  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked && other.pos === this.pos;
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = `cm-lv-checkbox${this.checked ? ' cm-lv-checkbox--checked' : ''}`;
    span.dataset.pos = String(this.pos);
    span.setAttribute('role', 'checkbox');
    span.setAttribute('aria-checked', String(this.checked));
    span.title = this.checked ? 'Mark as to-do' : 'Mark as done';
    return span;
  }
  ignoreEvent(): boolean {
    return true;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const ranges: DecRange[] = [];
  const usedLineStarts = new Set<number>();
  const usedRanges = new Set<string>();

  const add = (from: number, to: number, value: Decoration): void => {
    const key = `${from}:${to}`;
    if (usedRanges.has(key)) {
      return;
    }
    usedRanges.add(key);
    ranges.push({ from, to, value });
  };

  const addLine = (lineStart: number, cls: string): void => {
    if (usedLineStarts.has(lineStart)) {
      return;
    }
    usedLineStarts.add(lineStart);
    add(lineStart, lineStart, Decoration.line({ class: cls }));
  };

  const hideMarker = (doc: TextLike, from: number, to: number): void => {
    let end = to;
    if (doc.sliceString(end, end + 1) === ' ') {
      end += 1;
    }
    add(from, end, Decoration.replace({ widget: emptyWidget }));
  };

  const addLinesWithClass = (doc: TextLike, from: number, to: number, cls: string): void => {
    let line = doc.lineAt(from);
    for (;;) {
      addLine(line.from, cls);
      if (line.to >= to) {
        break;
      }
      line = doc.line(line.number + 1);
    }
  };

  const hideChildMarkers = (node: SyntaxNode, re: RegExp, doc: TextLike): void => {
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (re.test(child.type.name)) {
        hideMarker(doc, child.from, child.to);
      }
    }
  };

  const doc = view.state.doc as TextLike;
  const tree = syntaxTree(view.state);

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter: (ref) => {
        const node = ref.node;
        const name = node.type.name;

        if (/^ATXHeading[1-6]$/.test(name)) {
          const level = Number(name.slice(-1));
          addLine(doc.lineAt(node.from).from, `cm-lv-h${level}`);
          hideChildMarkers(node, /HeaderMark/, doc);
          return;
        }

        if (name === 'SetextHeading1' || name === 'SetextHeading2') {
          const level = name === 'SetextHeading1' ? 1 : 2;
          addLine(doc.lineAt(node.from).from, `cm-lv-h${level}`);
          hideChildMarkers(node, /HeaderMark/, doc);
          return;
        }

        if (name === 'Emphasis') {
          add(node.from, node.to, Decoration.mark({ class: 'cm-lv-em' }));
          hideChildMarkers(node, /EmphasisMark/, doc);
          return;
        }

        if (name === 'StrongEmphasis') {
          add(node.from, node.to, Decoration.mark({ class: 'cm-lv-strong' }));
          hideChildMarkers(node, /EmphasisMark/, doc);
          return;
        }

        if (name === 'Strikethrough') {
          add(node.from, node.to, Decoration.mark({ class: 'cm-lv-strike' }));
          hideChildMarkers(node, /StrikethroughMark/, doc);
          return;
        }

        if (name === 'InlineCode') {
          add(node.from, node.to, Decoration.mark({ class: 'cm-lv-code' }));
          hideChildMarkers(node, /CodeMark/, doc);
          return;
        }

        if (name === 'Link') {
          add(node.from, node.to, Decoration.mark({ class: 'cm-lv-link' }));
          hideChildMarkers(node, /LinkMark|URL/, doc);
          return;
        }

        if (name === 'BlockQuote') {
          addLinesWithClass(doc, node.from, node.to, 'cm-lv-quote');
          hideChildMarkers(node, /QuoteMark/, doc);
          return;
        }

        if (name === 'ListItem') {
          if (node.getChildren('Task').length > 0) {
            hideChildMarkers(node, /ListMark/, doc);
          }
          return;
        }

        if (name === 'Task') {
          const marker = node.getChildren('TaskMarker')[0];
          if (marker) {
            const markerText = doc.sliceString(marker.from, marker.to);
            const checked = /^\[[xX]\]/.test(markerText);
            let markerEnd = marker.to;
            if (doc.sliceString(markerEnd, markerEnd + 1) === ' ') {
              markerEnd += 1;
            }
            add(marker.from, markerEnd, Decoration.replace({ widget: new CheckboxWidget(checked, marker.from) }));
            if (checked) {
              add(node.from, node.to, Decoration.mark({ class: 'cm-lv-task-checked' }));
            }
          }
          return;
        }

        if (name === 'FencedCode' || name === 'CodeBlock') {
          addLinesWithClass(doc, node.from, node.to, 'cm-lv-codeblock');
          return;
        }
      },
    });
  }

  ranges.sort((a, b) => (a.from - b.from) || (a.to - b.to));

  const builder = new RangeSetBuilder<Decoration>();
  for (const r of ranges) {
    builder.add(r.from, r.to, r.value);
  }
  return builder.finish();
}

interface TextLike {
  sliceString(from: number, to?: number): string;
  lineAt(pos: number): { from: number; to: number; number: number };
  line(n: number): { from: number; to: number; number: number };
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

export const livePreviewDomHandlers = EditorView.domEventHandlers({
  pointerdown: (event, view) => {
    const target = event.target as HTMLElement | null;
    const checkbox = target?.closest('.cm-lv-checkbox') as HTMLElement | null;
    if (!checkbox || checkbox.dataset.pos === undefined) {
      return false;
    }
    event.preventDefault();
    const from = Number(checkbox.dataset.pos);
    const to = from + 3;
    const marker = view.state.sliceDoc(from, to);
    const replacement = /^\[[xX]\]/.test(marker) ? '[ ]' : '[x]';
    view.dispatch({ changes: { from, to, insert: replacement } });
    view.focus();
    return true;
  },
});
