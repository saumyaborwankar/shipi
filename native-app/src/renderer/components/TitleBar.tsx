import { useStore } from '../state/store';
import { WindowControls } from './WindowControls';

export function TitleBar(): React.ReactElement {
  const vault = useStore((s) => s.vault);
  const selectedPath = useStore((s) => s.selectedPath);
  const isMac = window.shipi.platform === 'darwin';

  return (
    <header className={`titlebar${isMac ? ' titlebar--mac' : ''}`}>
      <div className="titlebar__drag">
        <span className="titlebar__vault">{vault?.name ?? 'Vault'}</span>
        {selectedPath && <span className="titlebar__path">{selectedPath}</span>}
      </div>
      {!isMac && <WindowControls />}
    </header>
  );
}
