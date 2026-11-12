import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { persister, queryClient } from '@/lib/queryClient';
import { useTema } from '@/shared/tema';
import { Rotas } from './Rotas';

function AplicarTema() {
  useTema();
  return null;
}

export function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7, buster: 'v1' }}
      onSuccess={() => void queryClient.resumePausedMutations()}
    >
      <AuthProvider>
        <AplicarTema />
        <HashRouter>
          <Rotas />
        </HashRouter>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
