import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { etapasDoSeed, editalDoSeed } from './fixtures';
import { renderizarApp, USUARIA } from './renderizar';

const mocks = vi.hoisted(() => ({
  sessao: null as null | { user: unknown },
  signIn: vi.fn(),
  definirStatus: vi.fn(),
  marcarEtapa: vi.fn(),
  progresso: {} as Record<string, string>,
  concluidas: [] as string[],
}));

vi.mock('@/lib/supabase', async (original) => {
  const real = await original<typeof import('@/lib/supabase')>();
  return {
    ...real,
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: mocks.sessao } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithPassword: mocks.signIn,
        signOut: async () => ({ error: null }),
      },
    },
  };
});
vi.mock('@/features/edital/api', () => ({
  buscarEdital: async () => editalDoSeed(),
  buscarProgresso: async () => ({ ...mocks.progresso }),
  definirStatus: mocks.definirStatus,
}));
vi.mock('@/features/questoes/api', () => ({
  buscarQuestoes: async () => [], buscarTextos: async () => [], buscarRespostas: async () => [], buscarCaderno: async () => [],
  inserirQuestoes: async () => 0, responder: async () => {}, atualizarCaderno: async () => {},
}));
vi.mock('@/features/simulados/api', () => ({ listarSimulados: async () => [] }));
vi.mock('@/features/concurso/api', () => ({
  buscarEtapas: async () => etapasDoSeed(),
  buscarEtapasConcluidas: async () => [...mocks.concluidas],
  marcarEtapa: mocks.marcarEtapa,
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-12T20:00:00-03:00'));
  mocks.sessao = { user: USUARIA };
  mocks.progresso = {};
  mocks.concluidas = [];
  mocks.signIn.mockReset();
  // Servidor falso com estado: o que é salvo volta na próxima leitura.
  mocks.definirStatus.mockReset().mockImplementation(async (v: { topicoId: string; status: string }) => {
    mocks.progresso[v.topicoId] = v.status;
  });
  mocks.marcarEtapa.mockReset().mockImplementation(async (v: { etapaId: string; concluida: boolean }) => {
    mocks.concluidas = v.concluida ? [...mocks.concluidas, v.etapaId] : mocks.concluidas.filter((id) => id !== v.etapaId);
  });
});
afterEach(() => vi.useRealTimers());

describe('acesso', () => {
  it('sem sessão, leva para a tela de entrar', async () => {
    mocks.sessao = null;
    renderizarApp('/edital');
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('mostra mensagem em português para senha errada', async () => {
    mocks.sessao = null;
    mocks.signIn.mockResolvedValue({ error: new Error('Invalid login credentials') });
    renderizarApp('/entrar');
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText('E-mail'), 'teste@exemplo.com');
    await u.type(screen.getByLabelText('Senha'), 'errada123');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
  });
});

describe('início', () => {
  it('mostra contagem regressiva, foco e próximos prazos', async () => {
    renderizarApp('/');
    expect(await screen.findByText('Rumo à aprovação')).toBeInTheDocument();
    const contagem = screen.getByRole('region', { name: 'Contagem regressiva para a prova' });
    expect(within(contagem).getByText('80')).toBeInTheDocument();
    expect(screen.getByText(/Boa noite, Shaiane/)).toBeInTheDocument();
    expect(screen.getByText('60 de 60 pontos')).toBeInTheDocument();
    expect(await screen.findByText('Pedido de isenção da taxa (CadÚnico)')).toBeInTheDocument();
  });
});

describe('edital verticalizado', () => {
  it('lista as 4 disciplinas e salva o status de um tópico', async () => {
    renderizarApp('/edital');
    expect(await screen.findByRole('heading', { name: 'Conhecimentos Específicos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Português' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Legislação do SUS' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Conhecimentos Gerais do Município' })).toBeInTheDocument();

    const u = userEvent.setup();
    await u.selectOptions(screen.getByRole('combobox', { name: 'Status: Crase.' }), 'dominado');
    await waitFor(() =>
      expect(mocks.definirStatus).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USUARIA.id, topicoId: 'ace26-pt-16', status: 'dominado' }),
        expect.anything(),
      ),
    );
    expect(screen.getByRole('combobox', { name: 'Status: Crase.' })).toHaveValue('dominado');
    expect(screen.getByRole('progressbar', { name: 'Progresso em Português' })).toHaveAttribute('aria-valuenow', '6');
  });

  it('filtra por status e mostra subitens das doenças', async () => {
    mocks.progresso = { 'ace26-ce-08-03': 'revisando' };
    renderizarApp('/edital');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /Revisando\s*1/ }));
    expect(screen.getByRole('combobox', { name: 'Status: Dengue' })).toHaveValue('revisando');
    expect(screen.queryByRole('combobox', { name: 'Status: Crase.' })).not.toBeInTheDocument();
  });

  it('busca ignora acentos', async () => {
    renderizarApp('/edital');
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText('Buscar tópico'), 'colera');
    expect(screen.getByRole('combobox', { name: 'Status: Cólera' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Status: Crase.' })).not.toBeInTheDocument();
  });
});

describe('concurso', () => {
  it('mostra o formato da prova e marca uma etapa como feita', async () => {
    renderizarApp('/concurso');
    expect(await screen.findByText('Cronograma do processo seletivo')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '90' })).toBeInTheDocument();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Marcar “Pedido de isenção da taxa (CadÚnico)” como feito' }));
    await waitFor(() => expect(mocks.marcarEtapa).toHaveBeenCalledWith(expect.objectContaining({ etapaId: 'ace26-etapa-02', concluida: true }), expect.anything()));
    expect(screen.getByRole('button', { name: 'Desmarcar “Pedido de isenção da taxa (CadÚnico)”' })).toHaveAttribute('aria-pressed', 'true');
  });
});
