import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DiaCronograma, SessaoConcluida } from '@/features/plano/api';
import type { SessaoPlano } from '@/features/plano/gerador';
import { editalDoSeed, etapasDoSeed } from './fixtures';
import { renderizarApp, USUARIA } from './renderizar';

const m = vi.hoisted(() => ({
  cronograma: [] as unknown[],
  sessoes: [] as unknown[],
  progresso: {} as Record<string, string>,
  firmar: vi.fn(),
  concluir: vi.fn(),
  definirStatus: vi.fn(),
}));

vi.mock('@/lib/supabase', async (original) => ({
  ...(await original<typeof import('@/lib/supabase')>()),
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: '11111111-1111-1111-1111-111111111111', email: 't@e.com', user_metadata: { nome: 'Shaiane' } } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({ maybeSingle: async () => ({ data: { preferencias: { estudo: { minutosPorDia: [210, 210, 210, 210, 210, 210, 210], margemRecuperacao: 30 } } }, error: null }) }),
      update: () => ({ eq: async () => ({ data: null, error: null }) }),
    }),
  },
}));
vi.mock('@/features/edital/api', () => ({ buscarEdital: async () => editalDoSeed(), buscarProgresso: async () => ({ ...m.progresso }), definirStatus: m.definirStatus }));
vi.mock('@/features/concurso/api', () => ({ buscarEtapas: async () => etapasDoSeed(), buscarEtapasConcluidas: async () => [], marcarEtapa: async () => {} }));
vi.mock('@/features/questoes/api', () => ({
  buscarQuestoes: async () => [], buscarTextos: async () => [], buscarRespostas: async () => [], buscarCaderno: async () => [],
  inserirQuestoes: async () => 0, responder: async () => {}, atualizarCaderno: async () => {},
}));
vi.mock('@/features/materiais/api', () => ({ listarMateriais: async () => [], listarAnotacoes: async () => [], salvarNotaDoTopico: async () => {}, buscarNosMateriais: async () => [] }));
vi.mock('@/features/simulados/api', () => ({ listarSimulados: async () => [] }));
vi.mock('@/features/flashcards/api', () => ({
  buscarFlashcards: async () => [], buscarRevisoesDesde: async () => [], inserirFlashcards: async () => 0, reescreverFlashcard: async () => {},
  revisarFlashcard: async () => {}, atualizarFlashcard: async () => {}, excluirFlashcard: async () => {},
}));
vi.mock('@/features/plano/api', () => ({
  buscarSessoes: async () => [...m.sessoes],
  concluirSessao: m.concluir,
  desfazerSessao: async () => {},
  buscarCronograma: async () => [...m.cronograma],
  firmarDias: m.firmar,
  apagarDiasDesde: async () => {},
}));

const sessao = (data: string, tipo: SessaoPlano['tipo'], topico: string | null, titulo: string, minutos: number): SessaoPlano => ({
  chave: `${data}|${tipo}|${topico ?? 'geral'}`, tipo, titulo, detalhe: '', minutos,
  disciplina_id: topico ? topico.split('-').slice(0, 2).join('-') : null, topico_id: topico, link: '/edital',
});
const ONTEM: DiaCronograma = {
  data: '2026-11-16',
  sessoes: [
    sessao('2026-11-16', 'flashcards', null, 'Flashcards do dia', 15),
    sessao('2026-11-16', 'teoria', 'ace26-ce-07', 'Visita domiciliar e territorialização', 50),
    sessao('2026-11-16', 'questoes', 'ace26-pt-16', 'Crase', 30),
  ],
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-17T19:00:00-03:00'));
  m.cronograma = [ONTEM];
  m.sessoes = [];
  m.progresso = {};
  m.firmar.mockReset().mockResolvedValue(undefined);
  m.concluir.mockReset().mockResolvedValue(undefined);
  m.definirStatus.mockReset().mockResolvedValue(undefined);
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe('recuperação de atrasos', () => {
  it('Início: cartão amarelo avisa o que ficou para trás e quando fica em dia', async () => {
    renderizarApp('/');
    const cartao = await screen.findByRole('heading', { name: 'Você tem 2 tarefas atrasadas (1h20)' });
    const caixa = cartao.closest('section')!;
    expect(within(caixa).getByText('Atrasos leves')).toBeInTheDocument();
    expect(within(caixa).getByText(/Recuperando até 30 min por dia, você fica em dia até amanhã/)).toBeInTheDocument();
    expect(within(caixa).getByRole('link', { name: /Ver plano de recuperação/ })).toHaveAttribute('href', '/plano#recuperacao');
  });

  it('Início: cartão verde quando não há atrasos', async () => {
    m.cronograma = [];
    renderizarApp('/');
    expect(await screen.findByRole('heading', { name: 'Você está em dia com o cronograma' })).toBeInTheDocument();
    expect(screen.getByText('Em dia')).toBeInTheDocument();
  });

  it('firma a semana a partir de hoje (o dia de ontem já estava guardado)', async () => {
    renderizarApp('/plano');
    await waitFor(() => expect(m.firmar).toHaveBeenCalled());
    const dias = (m.firmar.mock.calls[0][1] as DiaCronograma[]).map((d) => d.data);
    expect(dias).toEqual(['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23']);
    expect(m.firmar.mock.calls[0][0]).toBe(USUARIA.id);
  });

  it('Plano: hoje separado em cronograma e recuperação; concluir recupera a tarefa no dia de origem', async () => {
    renderizarApp('/plano');
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const hoje = (await screen.findByRole('heading', { name: /^Hoje · Terça/ })).closest('section')!;
    expect(within(hoje).getByRole('heading', { name: /Cronograma de hoje/ })).toBeInTheDocument();
    expect(within(hoje).getByRole('heading', { name: /Recuperação · até 30 min/ })).toBeInTheDocument();
    // A tarefa que vale mais (Conhecimentos Específicos) entra hoje; a de Português, amanhã.
    expect(within(hoje).getByText('atrasada de seg, 16/11')).toBeInTheDocument();
    await u.click(within(hoje).getByRole('button', { name: 'Concluir “Visita domiciliar e territorialização”' }));
    await waitFor(() => expect(m.concluir).toHaveBeenCalledWith(USUARIA.id, expect.objectContaining({ chave: '2026-11-16|teoria|ace26-ce-07', data: '2026-11-16' })));
    // Concluir a teoria avança o tópico no edital.
    await waitFor(() => expect(m.definirStatus).toHaveBeenCalledWith(expect.objectContaining({ userId: USUARIA.id, topicoId: 'ace26-ce-07', status: 'revisando' }), expect.anything()));
  });

  it('Plano: mostra o que ficou para trás e como recuperar, dia a dia', async () => {
    renderizarApp('/plano');
    const painel = (await screen.findByRole('heading', { name: 'Recuperação de atrasos' })).closest('section')!;
    expect(within(painel).getByText('Previsto para seg, 16/11')).toBeInTheDocument();
    expect(within(painel).getByText('1h20')).toBeInTheDocument(); // pendente agora
    const como = within(painel).getByRole('heading', { name: 'Como recuperar' }).parentElement!;
    const linhas = within(como).getAllByRole('listitem').map((li) => li.textContent);
    expect(linhas[0]).toMatch(/^hoje.*Visita domiciliar/);
    expect(linhas[1]).toMatch(/^amanhã.*Crase/);
  });

  it('"Já sei isso" marca o tópico como dominado; "Encaixar hoje" puxa a tarefa para hoje', async () => {
    renderizarApp('/plano');
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const painel = (await screen.findByRole('heading', { name: 'Recuperação de atrasos' })).closest('section')!;
    // A tarefa de Visita domiciliar já está na recuperação de hoje; a de Crase pode ser encaixada.
    expect(within(painel).getByText('✓ Na recuperação de hoje')).toBeInTheDocument();
    const encaixar = within(painel).getByRole('button', { name: 'Encaixar hoje' });
    const crase = encaixar.closest('li')!;
    expect(within(crase).getByText('Crase')).toBeInTheDocument();
    await u.click(encaixar);
    const hoje = screen.getByRole('heading', { name: /^Hoje · Terça/ }).closest('section')!;
    expect(within(hoje).getByRole('button', { name: 'Concluir “Crase”' })).toBeInTheDocument();
    await u.click(within(crase).getByRole('button', { name: 'Já sei isso' }));
    await waitFor(() => expect(m.definirStatus).toHaveBeenCalledWith(expect.objectContaining({ userId: USUARIA.id, topicoId: 'ace26-pt-16', status: 'dominado' }), expect.anything()));
  });

  it('o que foi feito em dia não vira atraso, e o recuperado aparece no progresso', async () => {
    const feita = (s: SessaoPlano, em: string): SessaoConcluida => ({ chave: s.chave, data: '2026-11-16', tipo: s.tipo, disciplina_id: s.disciplina_id, topico_id: s.topico_id, titulo: s.titulo, minutos: s.minutos, concluida_em: em });
    m.sessoes = [feita(ONTEM.sessoes[1], '2026-11-16T21:00:00-03:00'), feita(ONTEM.sessoes[2], '2026-11-17T08:00:00-03:00')];
    renderizarApp('/');
    expect(await screen.findByRole('heading', { name: 'Você está em dia com o cronograma' })).toBeInTheDocument();
    expect(screen.getByText(/Você já recuperou 30 min de atrasos/)).toBeInTheDocument();
  });
});
