export const DEFAULT_VAULT_NAME = 'My Vault';

export const VAULT_DIR_NAME = 'Shipi';

export const VAULT_ROOT_REL = `${VAULT_DIR_NAME}/${DEFAULT_VAULT_NAME}`;

export const API_URL = process.env.EXPO_PUBLIC_SHIPI_API_URL ?? 'http://localhost:3001';

export const SYNC_STATE_FILE = 'shipi-sync-state.json';

export const SYNC_TOKEN_KEY = 'shipi.sync.token';

export const SYNC_VAULT_KEY_KEY = 'shipi.sync.vaultKey';
