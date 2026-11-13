import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import pacote from '@/features/questoes/pacotes/autorais-v1.json';
import pacoteMunicipio from '@/features/questoes/pacotes/municipio-v1.json';
import pacoteProvas from '@/features/questoes/pacotes/provas-v1.json';
import { prepararPacote, type Pacote } from '@/features/questoes/pacotes/instalar';
import { atualizarCadernoLocal } from '@/features/questoes/hooks';
import type { ItemCaderno, NovaQuestao, Questao, Resposta } from '@/features/questoes/tipos';
import type { SimuladoDetalhado } from '@/features/simulados/tipos';
import { editalDoSeed, etapasDoSeed } from './fixtures';
import { renderizarApp, USUARIA } from './renderizar';

const BANCO: Questao[] = [...prepararPacote(pacote as Pacote), ...prepararPacote(pacoteMunicipio as Pacote), ...prepararPacote(pacoteProvas as Pacote)].map((q, i) => ({ ...q, id: `q${i}`, texto_id: null, criado_em: '2026-11-13T00:00:00Z' }));
const CRASE = BANCO.find((q) => q.topico_id === 'ace26-pt-16')!;

const m = vi.hoisted(() => ({
  questoes: [] as unknown[],
  respostas: [] as unknown[],
  caderno: [] as unknown[],
  simulado: null as unknown,
  inserir: vi.fn(),
  responder: vi.fn(),
  atualizarCaderno: vi.fn(),
  criarTexto: vi.fn(),
  iniciar: vi.fn(),
  marcar: vi.fn(),
  finalizar: vi.fn(),
}));

vi.mock('@/lib/supabase', async (original) => ({
  ...(await original<typeof import('@/lib/supabase')>()),
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: '11111111-1111-1111-1111-111111111111', email: 't@e.com', user_metadata: { nome: 'Shaiane' } } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));
vi.mock('@/features/edital/api', () => ({ buscarEdital: async () => editalDoSeed(), buscarProgresso: async () => ({}), definirStatus: async () => {} }));
vi.mock('@/features/concurso/api', () => ({ buscarEtapas: async () => etapasDoSeed(), buscarEtapasConcluidas: async () => [], marcarEtapa: async () => {} }));
vi.mock('@/features/questoes/api', () => ({
  buscarQuestoes: async () => [...m.questoes],
  buscarTextos: async () => [],
  buscarRespostas: async () => [...m.respostas],
  buscarCaderno: async () => [...m.caderno],
  inserirQuestoes: m.inserir,
  responder: m.responder,
  atualizarCaderno: m.atualizarCaderno,
  criarTexto: m.criarTexto,
}));
vi.mock('@/features/flashcards/api', () => ({ buscarFlashcards: async () => [], buscarRevisoesDesde: async () => [], inserirFlashcards: async () => 0 }));
vi.mock('@/features/plano/api', () => ({ buscarSessoes: async () => [], concluirSessao: async () => {}, desfazerSessao: async () => {} }));
vi.mock('@/features/materiais/api', () => ({ listarMateriais: async () => [], listarAnotacoes: async () => [], salvarNotaDoTopico: async () => {}, buscarNosMateriais: async () => [] }));
vi.mock('@/features/simulados/api', () => ({
  listarSimulados: async () => (m.simulado ? [m.simulado] : []),
  buscarSimulado: async () => structuredClone(m.simulado),
  iniciarSimulado: m.iniciar,
  marcarItem: m.marcar,
  finalizarSimulado: m.finalizar,
  excluirSimulado: async () => {},
}));

beforeEach(() => {
  m.questoes = [...BANCO];
  m.respostas = [];
  m.caderno = [];
  m.simulado = null;
  m.inserir.mockReset().mockImplementation(async (_u: string, qs: NovaQuestao[]) => {
    m.questoes = [...m.questoes, ...qs.map((q, i) => ({ ...q, id: `nova${i}`, texto_id: q.texto_id ?? null, criado_em: '' }))];
    return qs.length;
  });
  m.responder.mockReset().mockImplementation(async (v: { questaoId: string; escolha: number }) => {
    const q = (m.questoes as Questao[]).find((x) => x.id === v.questaoId)!;
    const correta = q.gabarito === v.escolha;
    m.respostas = [...m.respostas, { questao_id: v.questaoId, escolha: v.escolha, correta, origem: 'treino', respondida_em: new Date().toISOString() } satisfies Resposta];
    m.caderno = atualizarCadernoLocal(m.caderno as ItemCaderno[], { questaoId: v.questaoId, escolha: v.escolha, correta, respondidaEm: '' });
  });
  m.atualizarCaderno.mockReset().mockImplementation(async (v: { questaoId: string; dados: object }) => {
    m.caderno = (m.caderno as ItemCaderno[]).map((i) => (i.questao_id === v.questaoId ? { ...i, ...v.dados } : i));
  });
  m.criarTexto.mockReset().mockResolvedValue('texto-1');
  m.iniciar.mockReset().mockImplementation(async (tipo: 'completo' | 'rapido', duracao: number, ids: string[]) => {
    m.simulado = {
      id: 'sim1', tipo, status: 'em_andamento', duracao_seg: duracao, iniciado_em: new Date().toISOString(), finalizado_em: null, resultado: null,
      itens: ids.map((id, i) => ({ ordem: i + 1, questao_id: id, escolha: null, marcada: false })),
    } satisfies SimuladoDetalhado;
    return 'sim1';
  });
  m.marcar.mockReset().mockImplementation(async (v: { ordem: number; dados: object }) => {
    const s = m.simulado as SimuladoDetalhado;
    s.itens = s.itens.map((i) => (i.ordem === v.ordem ? { ...i, ...v.dados } : i));
  });
  m.finalizar.mockReset().mockImplementation(async () => {
    const r = { acertos: 1, total: 10, em_branco: 9, pontos: 3, pontos_max: 26, nota_minima: 16, algum_bloco_zerado: true, aprovado: false, tempo_seg: 42,
      blocos: [{ bloco_id: 'ace26-bloco-ce', nome: 'Conhecimentos Específicos', acertos: 1, total: 5, em_branco: 4, pontos: 3, pontos_max: 15 },
        { bloco_id: 'ace26-bloco-pt', nome: 'Português', acertos: 0, total: 3, em_branco: 3, pontos: 0, pontos_max: 6 },
        { bloco_id: 'ace26-bloco-sm', nome: 'Legislação do SUS e Conhecimentos Gerais do Município', acertos: 0, total: 2, em_branco: 2, pontos: 0, pontos_max: 2 }] };
    m.simulado = { ...(m.simulado as SimuladoDetalhado), status: 'finalizado', resultado: r };
    return r;
  });
});

describe('praticar', () => {
  it('instala os pacotes de questões autorais (gerais, Município e provas reais) quando o banco está vazio', async () => {
    m.questoes = [];
    renderizarApp('/praticar');
    await waitFor(() => expect(m.inserir).toHaveBeenCalledWith(USUARIA.id, expect.any(Array)));
    expect(m.inserir.mock.calls[0][1]).toHaveLength(BANCO.length);
    // Cada texto de apoio do pacote é criado uma vez e ligado às questões que o usam.
    const textos = pacoteProvas.textos as Record<string, { titulo: string }>;
    expect(m.criarTexto).toHaveBeenCalledTimes(Object.keys(textos).length);
    expect(m.criarTexto).toHaveBeenCalledWith(USUARIA.id, expect.stringContaining('doença de Chagas'), expect.stringContaining('9º§'));
    const inseridas = m.inserir.mock.calls[0][1] as Record<string, unknown>[];
    const comTexto = pacoteProvas.questoes.filter((q) => 'texto' in q).length;
    expect(inseridas.filter((q) => q.texto_id === 'texto-1')).toHaveLength(comTexto);
    expect(inseridas.every((q) => !('texto' in q))).toBe(true);
    expect(await screen.findByText(new RegExp(`${BANCO.length} questões no seu banco`))).toBeInTheDocument();
  });

  it('não reinstala quando o pacote já está no banco', async () => {
    renderizarApp('/praticar');
    expect(await screen.findByText(new RegExp(`${BANCO.length} questões no seu banco`))).toBeInTheDocument();
    expect(m.inserir).not.toHaveBeenCalled();
  });

  it('quem já tinha o primeiro pacote recebe só as questões do Município', async () => {
    m.questoes = BANCO.filter((q) => q.disciplina_id !== 'ace26-mun');
    renderizarApp('/praticar');
    await waitFor(() => expect(m.inserir).toHaveBeenCalled());
    const novas = m.inserir.mock.calls[0][1] as NovaQuestao[];
    expect(novas).toHaveLength(BANCO.filter((q) => q.disciplina_id === 'ace26-mun').length);
    expect(novas.every((q) => q.disciplina_id === 'ace26-mun')).toBe(true);
  });
});

describe('resolver questões', () => {
  it('corrige na hora, pede o motivo do erro e manda para o caderno', async () => {
    // Uma única questão de crase no banco, para a ordem do treino não importar.
    m.questoes = BANCO.filter((q) => q.topico_id !== 'ace26-pt-16' || q.id === CRASE.id);
    renderizarApp('/praticar/questoes?disciplina=ace26-pt&topico=ace26-pt-16');
    const u = userEvent.setup();
    const errada = CRASE.alternativas.findIndex((_, i) => i !== CRASE.gabarito);
    await u.click(await screen.findByRole('radio', { name: new RegExp(`^Alternativa ${'ABCD'[errada]}:`) }));
    await u.click(screen.getByRole('button', { name: 'Responder' }));

    expect(screen.getByText('Comentário')).toBeInTheDocument();
    expect(screen.getByText(/Por que você errou/)).toBeInTheDocument();
    await waitFor(() => expect(m.responder).toHaveBeenCalledWith(expect.objectContaining({ questaoId: CRASE.id, escolha: errada, origem: 'treino' }), expect.anything()));

    await u.click(screen.getByRole('radio', { name: 'Falta de atenção' }));
    await waitFor(() => expect(m.atualizarCaderno).toHaveBeenCalledWith(expect.objectContaining({ questaoId: CRASE.id, dados: { motivo: 'desatencao' } }), expect.anything()));
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === '0 certas · 1 erradas')).toBeInTheDocument();
  });
});

describe('simulado', () => {
  it('começa, responde, finaliza e mostra o resultado por bloco', async () => {
    renderizarApp('/praticar/simulados');
    const u = userEvent.setup();
    const rapido = (await screen.findByRole('heading', { name: 'Simulado rápido' })).closest('section')!;
    await u.click(within(rapido).getByRole('button', { name: /Começar/ }));

    expect(await screen.findByRole('timer', { name: 'Tempo restante' })).toHaveTextContent(/4[45]:\d\d/);
    expect(m.iniciar).toHaveBeenCalledWith('rapido', 2700, expect.any(Array));
    expect((m.iniciar.mock.calls[0][2] as string[]).length).toBe(10);

    await u.click(screen.getByRole('radio', { name: /^Alternativa B:/ }));
    await waitFor(() => expect(m.marcar).toHaveBeenCalledWith(expect.objectContaining({ simuladoId: 'sim1', ordem: 1, dados: { escolha: 1 } }), expect.anything()));
    expect(screen.getByText('1 de 10 respondidas')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Finalizar' }));
    const dialogo = screen.getByRole('dialog', { name: 'Finalizar o simulado?' });
    expect(dialogo).toHaveTextContent('9 questões em branco');
    await u.click(within(dialogo).getByRole('button', { name: 'Finalizar' }));

    expect(await screen.findByText('Reprovada: um bloco ficou zerado')).toBeInTheDocument();
    expect(screen.getByText('de 26 pontos')).toBeInTheDocument();
    expect(m.finalizar).toHaveBeenCalledWith('sim1');
  });
});

describe('caderno de erros', () => {
  it('lista o erro com a resposta dada, a correta e permite anotar o motivo', async () => {
    const errada = (CRASE.gabarito! + 1) % 4;
    m.caderno = [{ questao_id: CRASE.id, ultima_escolha: errada, vezes_errada: 2, acertos_seguidos: 0, resolvido: false, motivo: null, anotacao: null, ultimo_erro_em: '2026-11-13T10:00:00Z' }];
    renderizarApp('/praticar/erros');
    expect(await screen.findByText('2×')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Refazer os 1 erros pendentes/ })).toBeInTheDocument();
    const u = userEvent.setup();
    await u.click(screen.getByRole('radio', { name: 'Não sabia o conteúdo' }));
    await waitFor(() => expect(m.atualizarCaderno).toHaveBeenCalledWith(expect.objectContaining({ dados: { motivo: 'nao_sabia' } }), expect.anything()));
  });
});

describe('importar prova', () => {
  it('lê o texto e o gabarito, mostra a revisão e salva com texto de apoio', async () => {
    renderizarApp('/praticar/importar');
    const u = userEvent.setup();
    const prova = [
      'LÍNGUA PORTUGUESA', 'Leia o texto para responder às questões 01 e 02.', 'TEXTO I', 'A água parada é o berço do mosquito.',
      '01. Segundo o texto, o mosquito nasce:', '(A) no ar.', '(B) na água parada.', '(C) no solo.', '(D) nas plantas.',
      '02. A palavra "berço" foi usada em sentido:', '(A) literal.', '(B) figurado.', '(C) técnico.', '(D) científico.',
      'CONHECIMENTOS ESPECÍFICOS', '03. O vetor da malária é:', '(A) Aedes.', '(B) Anopheles.', '(C) Culex.', '(D) Lutzomyia.',
    ].join('\n');
    await u.click(await screen.findByLabelText('Texto da prova'));
    await u.paste(prova);
    await u.click(screen.getByLabelText(/^Gabarito definitivo/));
    await u.paste('01-B 02-B 03-B');
    await u.type(screen.getByLabelText('De onde é a prova?'), 'IBAM teste');
    await u.click(screen.getByRole('button', { name: 'Ler questões' }));

    expect(await screen.findByText(/3<\/strong> questões encontradas|questões encontradas/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Salvar 3 questões' }));
    expect(await screen.findByText('3 questões importadas')).toBeInTheDocument();

    expect(m.criarTexto).toHaveBeenCalledWith(USUARIA.id, 'TEXTO I', 'A água parada é o berço do mosquito.');
    const salvas = m.inserir.mock.calls[0][1] as NovaQuestao[];
    expect(salvas.map((q) => [q.numero_original, q.disciplina_id, q.gabarito, q.texto_id])).toEqual([
      [1, 'ace26-pt', 1, 'texto-1'], [2, 'ace26-pt', 1, 'texto-1'], [3, 'ace26-ce', 1, null],
    ]);
    expect(salvas[2].topico_id).toBe('ace26-ce-08-09'); // Malária
    expect(salvas.every((q) => q.origem === 'importada' && q.fonte === 'IBAM teste')).toBe(true);
  });
});
