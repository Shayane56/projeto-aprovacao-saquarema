import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 1000 * 60 * 60 * 24 * 7, // mantém o cache offline por 7 dias
      retry: 2,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 3,
    },
  },
});

const CHAVE_CACHE = 'pas:cache-v1';

/** Guarda o cache (e alterações pendentes) no IndexedDB para uso offline. */
export const persister = createAsyncStoragePersister({
  key: CHAVE_CACHE,
  storage: {
    getItem: (k) => get<string>(k).then((v) => v ?? null),
    setItem: (k, v) => set(k, v),
    removeItem: (k) => del(k),
  },
  throttleTime: 1000,
});

export async function limparCacheLocal(): Promise<void> {
  queryClient.clear();
  await persister.removeClient();
}
