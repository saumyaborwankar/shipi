import { useState } from 'react';
import { useStore } from '../state/store';

function formatTime(iso: string | null): string {
  if (!iso) {
    return 'never';
  }
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function SyncPanel(): React.ReactElement {
  const sync = useStore((s) => s.sync);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (submitting) {
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await useStore.getState().signIn(email, password);
      } else {
        await useStore.getState().signUp(email, password);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sync-panel">
      {sync.signedIn ? (
        <div className="sync-panel__account">
          <div className="sync-panel__row">
            <span className="sync-panel__email">{sync.email}</span>
          </div>
          <div className="sync-panel__row sync-panel__meta">
            Last synced {formatTime(sync.lastSyncedAt)}
          </div>
          <div className="sync-panel__actions">
            <button
              className="btn sync-panel__sync-btn"
              onClick={() => void useStore.getState().syncNow()}
              disabled={sync.syncing}
            >
              {sync.syncing ? 'Syncing…' : 'Sync'}
            </button>
            <button
              className="btn"
              onClick={() => void useStore.getState().signOut()}
              disabled={sync.syncing}
            >
              Sign out
            </button>
          </div>
        </div>
      ) : (
        <form className="sync-panel__form" onSubmit={(e) => void submit(e)}>
          <div className="sync-panel__title">
            {mode === 'signin' ? 'Sign in to sync' : 'Create account'}
          </div>
          <button
            className="btn sync-panel__google-btn"
            type="button"
            onClick={() => void useStore.getState().signInWithGoogle()}
            disabled={submitting}
          >
            <span className="google-g">G</span>
            Continue with Google
          </button>
          <div className="sync-panel__divider">
            <span className="sync-panel__divider-line" />
            <span className="sync-panel__divider-label">or</span>
            <span className="sync-panel__divider-line" />
          </div>
          <input
            className="inline-input"
            type="email"
            value={email}
            placeholder="email"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="inline-input"
            type="password"
            value={password}
            placeholder="password (min 8 chars)"
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <div className="sync-panel__actions">
            <button className="btn sync-panel__sync-btn" type="submit" disabled={submitting}>
              {submitting ? '…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              {mode === 'signin' ? 'Create account' : 'Sign in'}
            </button>
          </div>
        </form>
      )}
      {sync.message && <div className="sync-panel__message">{sync.message}</div>}
    </div>
  );
}
