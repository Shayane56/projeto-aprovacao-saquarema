import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import pacote from '@/features/questoes/pacotes/autorais-v1.json';
import { prepararPacote, type Pacote } from '@/features/questoes/pacotes/instalar';
import type { Questao, Resposta } from '@/features/questoes/tipos';
import { editalDoSeed, etapasDoSeed } from './fixtures';
import { renderizarApp, USUARIA } from './renderizar';

const BANCO: Questao[] = prepararPacote(pacote as Pacote).map((q, i) => ({ ...q, id: `q${i}`, texto_id: null, criado_em: '' }));

const m = vi.hoisted(() => ({
  materiais: [] as unknown[],
  respostas: [] as unknown[],
  simulados: [] as unknown[],
  busca: vi.fn(),
  criarLink: vi.fn(),
  salvarNota: vi.fn(),
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
  buscarQuestoes: async () => BANCO, buscarTextos: async () => [], buscarRespostas: async () => [...m.respostas], buscarCaderno: async () => [],
  inserirQuestoes: async () => 0, responder: async () => {}, atualizarCaderno: async () => {},
}));
vi.mock('@/features/simulados/api', () => ({ listarSimulados: async () => [...m.simulados] }));
vi.mock('@/features/flashcards/api', () => ({ buscarFlashcards: async () => [], buscarRevisoesDesde: async () => [], inserirFlashcards: async () => 0 }));
vi.mock('@/features/plano/api', () => ({ buscarSessoes: async () => [{ chave: 'x', data: '2026-11-13', tipo: 'teoria', disciplina_id: null, topico_id: null, titulo: 't', minutos: 90, concluida_em: '' }], concluirSessao: async () => {}, desfazerSessao: async () => {} }));
vi.mock('@/features/materiais/api', () => ({
  listarMateriais: async () => [...m.materiais],
  listarAnotacoes: async () => [],
  buscarNosMateriais: m.busca,
  criarLink: m.criarLink,
  salvarNotaDoTopico: m.salvarNota,
  enviarPdf: async () => ({}),
  excluirMaterial: async () => {},
  baixarPdf: async () => new ArrayBuffer(0),
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-13T19:00:00-03:00'));
  m.materiais = [
    { id: 'm1', titulo: 'Lei Orgânica de Saquarema', tipo: 'pdf', arquivo_path: 'u/m1.pdf', url: null, tamanho_bytes: 480_000, paginas: 80, disciplina_id: 'ace26-mun', topico_id: 'ace26-mun-03', criado_em: '2026-11-13T10:00:00Z' },
    { id: 'm2', titulo: 'Biografia (ABL)', tipo: 'link', arquivo_path: null, url: 'https://www.academia.org.br/x', tamanho_bytes: null, paginas: null, disciplina_id: 'ace26-mun', topico_id: 'ace26-mun-02', criado_em: '2026-11-13T09:00:00Z' },
  ];
  m.respostas = [];
  m.simulados = [];
  m.busca.mockReset().mockResolvedValue([{ material_id: 'm1', titulo: 'Lei Orgânica de Saquarema', pagina: 7, trecho: 'composta de treze [[Vereadores]] eleitos', relevancia: 0.5 }]);
  m.criarLink.mockReset().mockResolvedValue(undefined);
  m.salvarNota.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('materiais', () => {
  it('lista os materiais por disciplina e busca dentro dos PDFs', async () => {
    renderizarApp('/materiais');
    const u = userEvent.setup();
    expect(await screen.findByText('Lei Orgânica de Saquarema')).toBeInTheDocument();
    expect(screen.getByText(/80 páginas · 469 KB/)).toBeInTheDocument();
    await u.type(screen.getByLabelText('Buscar dentro dos materiais'), 'vereadores');
    const resultado = await screen.findByRole('link', { name: /página 7/ });
    expect(resultado).toHaveAttribute('href', '/materiais/m1?pagina=7');
    expect(screen.getByText('Vereadores').tagName).toBe('MARK');
    expect(m.busca).toHaveBeenCalledWith('vereadores');
  });

  it('adiciona um link ligado a um tópico', async () => {
    renderizarApp('/materiais');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Adicionar' }));
    await u.click(screen.getByRole('radio', { name: 'Link' }));
    await u.type(screen.getByLabelText('Endereço (URL)'), 'saquarema.rj.gov.br');
    await u.type(screen.getByLabelText('Título'), 'Site da Prefeitura');
    await u.selectOptions(screen.getByLabelText(/^Disciplina/), 'ace26-mun');
    await u.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(m.criarLink).toHaveBeenCalledWith({ userId: USUARIA.id, titulo: 'Site da Prefeitura', url: 'https://saquarema.rj.gov.br', disciplinaId: 'ace26-mun', topicoId: null }));
  });

  it('filtra pelos materiais de um tópico', async () => {
    renderizarApp('/materiais?topico=ace26-mun-02');
    expect(await screen.findByText('Biografia (ABL)')).toBeInTheDocument();
    expect(screen.queryByText('Lei Orgânica de Saquarema')).not.toBeInTheDocument();
  });
});

describe('anotações no edital', () => {
  it('anota um tópico e salva ao sair do campo; mostra os materiais do tópico', async () => {
    renderizarApp('/edital?disciplina=ace26-mun');
    const u = userEvent.setup();
    const links = (await screen.findAllByRole('link', { name: '1 material' })).map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/materiais?topico=ace26-mun-02', '/materiais?topico=ace26-mun-03']);
    const botoes = await screen.findAllByRole('button', { name: 'Anotar' });
    await u.click(botoes[botoes.length - 1]); // Lei Orgânica (último tópico do Município)
    const campo = screen.getByLabelText('Anotação: Lei Orgânica de Saquarema e suas atualizações.');
    await u.type(campo, '13 vereadores');
    fireEvent.blur(campo);
    await waitFor(() => expect(m.salvarNota).toHaveBeenCalledWith(expect.objectContaining({ userId: USUARIA.id, topicoId: 'ace26-mun-03', conteudo: '13 vereadores' }), expect.anything()));
  });
});

describe('estatísticas', () => {
  it('mostra a previsão de nota com base nas respostas e o tempo de estudo', async () => {
    const r = (q: Questao, correta: boolean, i: number): Resposta => ({ questao_id: q.id, correta, escolha: 0, origem: 'treino', respondida_em: new Date(Date.UTC(2026, 10, 13, 10) + i * 1000).toISOString() });
    const de = (disc: string) => BANCO.filter((q) => q.disciplina_id === disc);
    let i = 0;
    m.respostas = [
      ...de('ace26-ce').slice(0, 10).map((q, k) => r(q, k < 8, i++)), // 80% → 48
      ...de('ace26-pt').slice(0, 10).map((q, k) => r(q, k < 6, i++)), // 60% → 12
      ...de('ace26-sus').slice(0, 10).map((q, k) => r(q, k < 7, i++)), // 70% → 7
    ];
    renderizarApp('/estatisticas');
    expect(await screen.findByText('67')).toBeInTheDocument();
    expect(screen.getByText(/Acima do mínimo, com 13 pontos de margem/)).toBeInTheDocument();
    expect(screen.getByText(/Faça um simulado para acompanhar/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Horas de estudo nas últimas 8 semanas' })).toBeInTheDocument();
    expect(screen.getByText(/1,5 h de estudo nos últimos 7 dias/)).toBeInTheDocument();
  });
});
