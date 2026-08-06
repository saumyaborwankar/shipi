import { useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { Compartment } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { useStore } from '../state/store';
import { notionEditorExtensions, notionTheme } from '../lib/editorTheme';
import { livePreview, livePreviewDomHandlers } from '../lib/livePreview';

const SAVE_DEBOUNCE_MS = 600;
const livePreviewCompartment = new Compartment();

export function EditorPane(): React.ReactElement {
  const selectedPath = useStore((s) => s.selectedPath);
  const content = useStore((s) => s.content);
  const dirty = useStore((s) => s.dirty);
  const updateContent = useStore((s) => s.updateContent);
  const markSaved = useStore((s) => s.markSaved);
  const [sourceMode, setSourceMode] = useState(false);
  const viewRef = useRef<EditorView | null>(null);

  const selectedName = selectedPath ? selectedPath.split('/').pop() : null;

  useEffect(() => {
    if (!selectedPath || !dirty) {
      return;
    }
    const timer = setTimeout(() => {
      void window.shipi.writeFile(selectedPath, content).then(() => {
        markSaved();
        void useStore.getState().syncPush();
      });
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [content, dirty, selectedPath, markSaved]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && selectedPath && dirty) {
        e.preventDefault();
        void window.shipi.writeFile(selectedPath, content).then(() => {
          markSaved();
          void useStore.getState().syncPush();
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPath, content, dirty, markSaved]);

  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      notionEditorExtensions,
      livePreviewDomHandlers,
      livePreviewCompartment.of(livePreview),
    ],
    [],
  );

  const toggleSourceMode = (): void => {
    const next = !sourceMode;
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: livePreviewCompartment.reconfigure(next ? [] : livePreview),
      });
    }
    setSourceMode(next);
  };

  if (!selectedPath) {
    return (
      <main className="editor">
        <div className="empty-state">
          <div className="empty-state__title">Welcome to your vault</div>
          <div className="empty-state__hint">
            Select a note from the sidebar, or create a new one to get started.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="editor">
      <div className="editor__header">
        <span className="editor__title">
          {dirty && <span className="editor__dirty" title="Unsaved changes" />}
          {selectedName}
        </span>
        <button
          className={`btn${sourceMode ? '' : ' btn--active'}`}
          onClick={toggleSourceMode}
          title={sourceMode ? 'Switch to live preview' : 'Switch to source mode'}
        >
          {sourceMode ? 'Live' : 'Source'}
        </button>
      </div>
      <div className="editor__body">
        <div className="editor__code">
          <CodeMirror
            value={content}
            height="100%"
            extensions={extensions}
            theme={notionTheme}
            onCreateEditor={(view) => {
              viewRef.current = view;
            }}
            onChange={(value) => updateContent(value)}
            basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLineGutter: false }}
          />
        </div>
      </div>
    </main>
  );
}
