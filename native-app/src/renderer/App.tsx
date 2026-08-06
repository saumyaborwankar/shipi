import { useEffect } from 'react';
import { useStore } from './state/store';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { EditorPane } from './components/EditorPane';

export function App(): React.ReactElement {
  const loadVault = useStore((s) => s.loadVault);
  const loadSync = useStore((s) => s.loadSync);
  const subscribeSync = useStore((s) => s.subscribeSync);

  useEffect(() => {
    void loadVault();
    void loadSync();
    const unsubscribe = subscribeSync();
    return unsubscribe;
  }, [loadVault, loadSync, subscribeSync]);

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
