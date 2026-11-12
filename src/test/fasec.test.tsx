import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Flashcard, NovoFlashcard } from '@/features/flashcards/tipos';
import pacote from '@/features/questoes/pacotes/autorais-v1.json';
import { prepararPacote, type Pacote } from '@/features/questoes/pacotes/instalar';
import type { Questao } from '@/features/questoes/tipos';
import { editalDoSeed, etapasDoSeed } from './fixtures';
import { renderizarApp, USUARIA } from './renderizar';

const BANCO: Questao[] = prepararPacote(pacote as Pacote).map((q, i) => ({ ...q, id: `q${i}`, texto_id: null, criado_em: '' }));

const m = vi.hoisted(() => ({
  cartoes: [] as unknown[],
  progresso: {} as Record<string, string>,
  inserirCartoes: vi.fn(),
  revisar: vi.fn(),
  concluir: vi.fn(),
  definirStatus: vi.fn(),
  prefs: null as unknown,
  salvarPrefs: vi.fn(),
}));

vi.mock('@/lib/supabase', async (original) => ({
  ...(await original<typeof import('@/lib/supabase')>()),
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: '11111111-1111-1111-1111-111111111111', email: 't@e.com', user_metadata: { nome: 'Shaiane' } } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    // Preferências (perfis) lidas/gravadas direto pelo cliente.
    from: () => ({
      select: () => ({ maybeSingle: async () => ({ data: { preferencias: m.prefs ? { estudo: m.prefs } : {} }, error: null }) }),
      update: (dados: { preferencias: { estudo: unknown } }) => ({ eq: async () => { m.salvarPrefs(dados); m.prefs = dados.preferencias.estudo; return { data: null, error: null }; } }),
    }),
  },
}));
vi.mock('@/features/edital/api', () => ({
  buscarEdital: async () => editalDoSeed(),
  buscarProgresso: async () => ({ ...m.progresso }),
  definirStatus: m.definirStatus,
}));
vi.mock('@/features/concurso/api', () => ({ buscarEtapas: async () => etapasDoSeed(), buscarEtapasConcluidas: async () => [], marcarEtapa: async () => {} }));
vi.mock('@/features/questoes/api', () => ({
  buscarQuestoes: async () => BANCO, buscarTextos: async () => [], buscarRespostas: async () => [], buscarCaderno: async () => [],
  inserirQuestoes: async () => 0, responder: async () => {}, atualizarCaderno: async () => {},
}));
vi.mock('@/features/simulados/api', () => ({ listarSimulados: async () => [] }));
vi.mock('@/features/flashcards/api', () => ({
  buscarFlashcards: async () => [...m.cartoes],
  buscarRevisoesDesde: async () => [],
  inserirFlashcards: m.inserirCartoes,
  revisarFlashcard: m.revisar,
  atualizarFlashcard: async () => {},
  excluirFlashcard: async () => {},
}));
vi.mock('@/features/plano/api', () => ({ buscarSessoes: async () => [], concluirSessao: m.concluir, desfazerSessao: async () => {} }));

const cartao = (i: number, frente: string): Flashcard => ({
  id: `c${i}`, disciplina_id: 'ace26-ce', topico_id: null, questao_id: null, frente, verso: `resposta ${i}`, origem: 'autoral', suspenso: false,
  criado_em: `2026-11-13T00:00:0${i}Z`, due: '2026-11-13T00:00:00Z', stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0, learning_steps: 0, reps: 0, lapses: 0, state: 0, last_review: null,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-13T19:00:00-03:00'));
  m.cartoes = [];
  m.progresso = {};
  m.prefs = null;
  m.inserirCartoes.mockReset().mockImplementation(async (_u: string, novos: NovoFlashcard[]) => {
    m.cartoes = [...m.cartoes, ...novos.map((n, i) => ({ ...cartao(i, n.frente), ...n, id: `novo${i}` }))];
    return novos.length;
  });
  m.revisar.mockReset().mockResolvedValue(undefined);
  m.concluir.mockReset().mockResolvedValue(undefined);
  m.definirStatus.mockReset().mockResolvedValue(undefined);
  m.salvarPrefs.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('flashcards', () => {
  it('instala o pacote de cartões autorais', async () => {
    renderizarApp('/flashcards');
    await waitFor(() => expect(m.inserirCartoes).toHaveBeenCalled());
    expect((m.inserirCartoes.mock.calls[0][1] as NovoFlashcard[]).length).toBeGreaterThanOrEqual(50);
  });

  it('estudo: mostra a frente, revela o verso e registra a nota', async () => {
    m.cartoes = [cartao(1, 'Vetor da malária?'), cartao(2, 'Vetor da dengue?')];
    renderizarApp('/flashcards/estudar');
    const u = userEvent.setup();
    expect(await screen.findByText('Vetor da malária?')).toBeInTheDocument();
    expect(screen.queryByText('resposta 1')).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Mostrar resposta' }));
    expect(screen.getByText('resposta 1')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: /^Bom/ }));
    await waitFor(() => expect(m.revisar).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', estado: expect.objectContaining({ reps: 1 }), log: expect.objectContaining({ rating: 3, state: 0 }) }), expect.anything()));
    expect(await screen.findByText('Vetor da dengue?')).toBeInTheDocument();
    expect(screen.getByText('1 feitos')).toBeInTheDocument();
  });

  it('cria um cartão a partir de uma questão errada, já preenchido', async () => {
    m.cartoes = [cartao(1, 'x')];
    const q = BANCO.find((x) => x.topico_id === 'ace26-ce-08-09')!; // malária
    renderizarApp(`/flashcards/novo?questao=${q.id}`);
    const u = userEvent.setup();
    expect(await screen.findByRole('heading', { name: 'Cartão a partir do erro' })).toBeInTheDocument();
    expect(screen.getByLabelText('Frente (pergunta)')).toHaveValue(q.enunciado);
    expect((screen.getByLabelText('Verso (resposta)') as HTMLTextAreaElement).value).toContain(q.alternativas[q.gabarito!]);
    await u.click(screen.getByRole('button', { name: 'Salvar cartão' }));
    await waitFor(() => expect(m.inserirCartoes).toHaveBeenCalledWith(USUARIA.id, [expect.objectContaining({ origem: 'erro', questao_id: q.id, topico_id: 'ace26-ce-08-09' })]));
  });
});

describe('plano de estudos', () => {
  it('mostra as sessões de hoje e, ao concluir a teoria, avança o status do tópico', async () => {
    renderizarApp('/plano');
    const u = userEvent.setup();
    const hoje = await screen.findByRole('region', { name: /Hoje/ });
    expect(within(hoje).getByText('Flashcards do dia')).toBeInTheDocument();
    const concluir = within(hoje).getAllByRole('button', { name: /^Concluir “\d/ })[0];
    const titulo = concluir.getAttribute('aria-label')!.replace(/^Concluir “|”$/g, '');
    await u.click(concluir);
    await waitFor(() => expect(m.concluir).toHaveBeenCalledWith(USUARIA.id, expect.objectContaining({ data: '2026-11-13', titulo })));
    const sessao = m.concluir.mock.calls[0][1] as { tipo: string; topico_id: string };
    if (sessao.tipo === 'teoria') {
      await waitFor(() => expect(m.definirStatus).toHaveBeenCalledWith(expect.objectContaining({ topicoId: sessao.topico_id, status: 'revisando' }), expect.anything()));
    }
    expect(within(hoje).getByRole('button', { name: `Desmarcar “${titulo}”` })).toHaveAttribute('aria-pressed', 'true');
  });

  it('salva a disponibilidade e avisa quando o tempo não cobre o edital', async () => {
    renderizarApp('/plano');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /Disponibilidade/ }));
    for (const dia of ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']) {
      await u.selectOptions(screen.getByLabelText(dia), '30');
    }
    await u.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(m.salvarPrefs).toHaveBeenCalled());
    expect(await screen.findByText(/O tempo disponível não cobre todo o edital/)).toBeInTheDocument();
  });
});
