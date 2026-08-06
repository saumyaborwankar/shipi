import { useEffect } from 'react';
import { useStore } from './state/store';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { EditorPane } from './components/EditorPane';

export function App(): React.ReactElement {
  const loadVault = useStore((s) => s.loadVault);

  useEffect(() => {
    void loadVault();
  }, [loadVault]);

  return (
    <div className="app">
      <TitleBar />
      <div className="app-body">
        <Sidebar />
        <EditorPane />
      </div>
    </div>
  );
}
