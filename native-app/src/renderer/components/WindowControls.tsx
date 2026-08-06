import { useEffect, useState } from 'react';

function MinimizeGlyph(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function MaximizeGlyph(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function RestoreGlyph(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="1.5" y="3.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M3.5 3.5 V1.5 H10.5 V8.5 H8.5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function CloseGlyph(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <line x1="1.5" y1="1.5" x2="10.5" y2="10.5" stroke="currentColor" strokeWidth="1" />
      <line x1="10.5" y1="1.5" x2="1.5" y2="10.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function WindowControls(): React.ReactElement {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    void window.shipi.isMaximized().then(setMaximized);
    return window.shipi.onMaximizeChange(setMaximized);
  }, []);

  return (
    <div className="window-controls">
      <button className="window-control" onClick={() => window.shipi.minimize()} aria-label="Minimize">
        <MinimizeGlyph />
      </button>
      <button
        className="window-control"
        onClick={() => window.shipi.toggleMaximize()}
        aria-label={maximized ? 'Restore' : 'Maximize'}
      >
        {maximized ? <RestoreGlyph /> : <MaximizeGlyph />}
      </button>
      <button className="window-control window-control--close" onClick={() => window.shipi.close()} aria-label="Close">
        <CloseGlyph />
      </button>
    </div>
  );
}
