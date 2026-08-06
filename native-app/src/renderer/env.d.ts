import type { ShipiApi } from '../shared/ipc';

declare global {
  interface Window {
    shipi: ShipiApi;
  }
}

export {};
