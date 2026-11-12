import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Rotas } from '@/app/Rotas';
import { AuthProvider } from '@/features/auth/AuthProvider';

export function renderizarApp(rota = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[rota]}>
          <Rotas />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

export const USUARIA = { id: '11111111-1111-1111-1111-111111111111', email: 'teste@exemplo.com', user_metadata: { nome: 'Shaiane' } };
