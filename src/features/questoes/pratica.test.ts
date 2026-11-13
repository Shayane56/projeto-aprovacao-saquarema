import { configDe } from '@/features/simulados/config';
import { selecionarQuestoes } from '@/features/simulados/selecao';
import { formatarDuracao, normalizarResultado, segundosRestantes } from '@/features/simulados/tipos';
import { geradorComSemente } from '@/lib/aleatorio';
import { editalDoSeed } from '@/test/fixtures';
import { atualizarCadernoLocal } from './hooks';
import pacote from './pacotes/autorais-v1.json';
import pacoteMunicipio from './pacotes/municipio-v1.json';
import pacoteProvas from './pacotes/provas-v1.json';
import pacoteIneditas from './pacotes/ineditas-ibam-v1.json';
import cartoesMunicipio from '@/features/flashcards/pacotes/municipio-v1.json';
import cartoesGerais from '@/features/flashcards/pacotes/cartoes-v1.json';
import { hashCartao } from '@/features/flashcards/agendador';
import { prepararPacote, type Pacote } from './pacotes/instalar';
import { montarFila, resumirDesempenho } from './pratica';
import type { ItemCaderno, Questao, Resposta } from './tipos';

const edital = editalDoSeed();
const preparadas = prepararPacote(pacote as Pacote);
const questoes: Questao[] = preparadas.map((q, i) => ({ ...q, id: `q${i}`, texto_id: null, criado_em: '2026-11-13T00:00:00Z' }));
const resp = (id: string, correta: boolean): Resposta => ({ questao_id: id, escolha: 0, correta, origem: 'treino', respondida_em: '2026-11-13T12:00:00Z' });

describe('pacote de questões autorais', () => {
  it('tem 60 questões válidas ligadas a disciplinas e tópicos existentes', () => {
    expect(preparadas).toHaveLength(60);
    const topicos = new Set(edital.topicos.map((t) => t.id));
    const disciplinas = new Set(edital.disciplinas.map((d) => d.id));
    for (const q of preparadas) {
      expect(disciplinas.has(q.disciplina_id)).toBe(true);
      expect(q.topico_id && topicos.has(q.topico_id)).toBe(true);
      expect(q.alternativas).toHaveLength(4);
      expect(q.gabarito).not.toBeNull();
    }
  });

  it('o embaralhamento mantém a resposta certa e distribui as letras', () => {
    (pacote as Pacote).questoes.forEach((original, i) => {
      const certa = original.alternativas['ABCD'.indexOf(original.gabarito)];
      expect(preparadas[i].alternativas[preparadas[i].gabarito!]).toBe(certa);
    });
    const contagem = [0, 0, 0, 0];
    for (const q of preparadas) contagem[q.gabarito!] += 1;
    // Nenhuma letra concentra mais de 40% nem fica com menos de 10% das respostas.
    for (const n of contagem) {
      expect(n).toBeGreaterThanOrEqual(6);
      expect(n).toBeLessThanOrEqual(24);
    }
  });

  it('é determinístico (mesmo resultado em qualquer aparelho)', () => {
    expect(prepararPacote(pacote as Pacote)).toEqual(preparadas);
  });

  it('não tem enunciados repetidos', () => {
    expect(new Set(preparadas.map((q) => q.hash)).size).toBe(60);
  });
});

describe('pacote do Município', () => {
  const mun = prepararPacote(pacoteMunicipio as Pacote);
  const topicos = new Set(edital.topicos.map((t) => t.id));

  it('tem questões dos 3 itens do edital, todas válidas e ligadas a tópicos existentes', () => {
    expect(new Set(mun.map((q) => q.topico_id))).toEqual(new Set(['ace26-mun-01', 'ace26-mun-02', 'ace26-mun-03']));
    for (const q of mun) {
      expect(q.disciplina_id).toBe('ace26-mun');
      expect(topicos.has(q.topico_id!)).toBe(true);
      expect(q.alternativas).toHaveLength(4);
      expect(q.explicacao).toMatch(/Fonte:/);
    }
  });

  it('não repete questões nem cartões entre os pacotes', () => {
    const todas = [...preparadas, ...mun].map((q) => q.hash);
    expect(new Set(todas).size).toBe(todas.length);
    const frentes = [...cartoesGerais.cartoes, ...cartoesMunicipio.cartoes].map((c) => hashCartao(c.frente));
    expect(new Set(frentes).size).toBe(frentes.length);
    for (const c of cartoesMunicipio.cartoes) expect(topicos.has(c.topico)).toBe(true);
  });

  it('com o pacote do Município, o simulado completo deixa de faltar questões do bloco SUS/Município', () => {
    const banco = [...questoes, ...mun.map((q, i) => ({ ...q, id: `m${i}`, texto_id: null, criado_em: '' }))];
    const sel = selecionarQuestoes(edital, banco, [], [], configDe('completo'), geradorComSemente(9));
    expect(sel.faltando).toEqual({});
  });
});

describe('seleção do simulado', () => {
  it('simulado rápido: 5 CE + 3 PT + 2 do bloco SUS/Município, em ordem de bloco', () => {
    const sel = selecionarQuestoes(edital, questoes, [], [], configDe('rapido'), geradorComSemente(1));
    expect(sel.ids).toHaveLength(10);
    expect(sel.faltando).toEqual({});
    const disc = sel.ids.map((id) => questoes.find((q) => q.id === id)!.disciplina_id);
    expect(disc.slice(0, 5).every((d) => d === 'ace26-ce')).toBe(true);
    expect(disc.slice(5, 8).every((d) => d === 'ace26-pt')).toBe(true);
    expect(disc.slice(8).every((d) => d === 'ace26-sus' || d === 'ace26-mun')).toBe(true);
  });

  it('simulado completo avisa quando faltam questões no banco', () => {
    const sel = selecionarQuestoes(edital, questoes, [], [], configDe('completo'), geradorComSemente(2));
    expect(sel.ids).toHaveLength(40); // 20 CE (há 30), 10 PT (há 15), 10 SUS (há 15)
    const poucas = questoes.filter((q) => q.disciplina_id !== 'ace26-pt' || q.id === 'q30');
    expect(selecionarQuestoes(edital, poucas, [], [], configDe('completo')).faltando).toEqual({ 'ace26-bloco-pt': 9 });
  });

  it('prioriza questões nunca respondidas e não usa anuladas', () => {
    const ce = questoes.filter((q) => q.disciplina_id === 'ace26-ce');
    const respostas = ce.slice(0, 25).map((q) => resp(q.id, true));
    const comAnulada = questoes.map((q) => (q.id === ce[29].id ? { ...q, anulada: true } : q));
    const sel = selecionarQuestoes(edital, comAnulada, respostas, [], configDe('rapido'), geradorComSemente(3));
    const ceEscolhidas = sel.ids.slice(0, 5);
    expect(ceEscolhidas).not.toContain(ce[29].id);
    expect(ceEscolhidas.filter((id) => ce.slice(25, 29).some((q) => q.id === id))).toHaveLength(4);
  });
});

describe('treino e desempenho', () => {
  it('fila de "não respondidas" e de "erros pendentes"', () => {
    const respostas = [resp('q0', false), resp('q1', true)];
    const caderno: ItemCaderno[] = [{ questao_id: 'q0', ultima_escolha: 0, vezes_errada: 1, acertos_seguidos: 0, resolvido: false, motivo: null, anotacao: null, ultimo_erro_em: '' }];
    expect(montarFila(questoes, respostas, caderno, { modo: 'novas' })).toHaveLength(58);
    expect(montarFila(questoes, respostas, caderno, { modo: 'erradas' }).map((q) => q.id)).toEqual(['q0']);
    const todas = montarFila(questoes, respostas, caderno, { modo: 'todas' });
    expect(todas).toHaveLength(60);
    expect(todas.slice(-2).map((q) => q.id).sort()).toEqual(['q0', 'q1']);
  });

  it('filtro por tópico inclui os subtópicos', () => {
    const doItem8 = montarFila(questoes, [], [], { disciplinaId: 'ace26-ce', topicoId: 'ace26-ce-08', modo: 'todas' });
    expect(doItem8.length).toBe(questoes.filter((q) => q.topico_id?.startsWith('ace26-ce-08-')).length);
    expect(doItem8.length).toBeGreaterThan(5);
  });

  it('desempenho por bloco', () => {
    const ce = questoes.find((q) => q.disciplina_id === 'ace26-ce')!;
    const pt = questoes.find((q) => q.disciplina_id === 'ace26-pt')!;
    const r = resumirDesempenho(edital, questoes, [resp(ce.id, true), resp(ce.id, false), resp(pt.id, true)], '2026-11-13');
    expect(r.geral).toEqual({ respondidas: 3, acertos: 2 });
    expect(r.porBloco[0].desempenho).toEqual({ respondidas: 2, acertos: 1 });
    expect(r.porBloco[0].disponiveis).toBe(30);
    expect(r.respondidasHoje).toBe(3);
  });

  it('caderno local segue a regra do banco (2 acertos seguidos resolvem)', () => {
    let c: ItemCaderno[] = [];
    c = atualizarCadernoLocal(c, { questaoId: 'q5', escolha: 1, correta: false, respondidaEm: 'a' });
    c = atualizarCadernoLocal(c, { questaoId: 'q5', escolha: 2, correta: false, respondidaEm: 'b' });
    expect(c[0]).toMatchObject({ vezes_errada: 2, ultima_escolha: 2, resolvido: false });
    c = atualizarCadernoLocal(c, { questaoId: 'q5', escolha: 0, correta: true, respondidaEm: 'c' });
    expect(c[0].resolvido).toBe(false);
    c = atualizarCadernoLocal(c, { questaoId: 'q5', escolha: 0, correta: true, respondidaEm: 'd' });
    expect(c[0]).toMatchObject({ acertos_seguidos: 2, resolvido: true });
    expect(atualizarCadernoLocal([], { questaoId: 'q9', escolha: 0, correta: true, respondidaEm: 'e' })).toEqual([]);
  });
});

describe('pacote de provas reais', () => {
  const provas = prepararPacote(pacoteProvas as Pacote);
  const topicos = new Set(editalDoSeed().topicos.map((t) => t.id));

  it('mantém a ordem e o gabarito originais e guarda a prova de origem', () => {
    pacoteProvas.questoes.forEach((orig, i) => {
      const q = provas[i];
      expect(q.alternativas).toEqual(orig.alternativas);
      expect(q.gabarito).toBe(['A', 'B', 'C', 'D', 'E'].indexOf(orig.gabarito));
      expect(q.gabarito).toBeLessThan(q.alternativas.length);
      expect(q.origem).toBe('importada');
      expect(q.fonte).toMatch(/^.+ · 20\d\d · Prefeitura de .+\/[A-Z]{2} · .+$/);
      expect(topicos.has(q.topico_id!)).toBe(true);
      expect(q.topico_id!.startsWith(q.disciplina_id)).toBe(true);
    });
  });

  it('não repete questões de outros pacotes', () => {
    const todas = [...preparadas, ...prepararPacote(pacoteMunicipio as Pacote), ...provas].map((q) => q.hash);
    expect(new Set(todas).size).toBe(todas.length);
  });
});

describe('pacote de questões inéditas no padrão IBAM', () => {
  const ineditas = prepararPacote(pacoteIneditas as Pacote);
  const topicos = new Set(editalDoSeed().topicos.map((t) => t.id));

  it('mantém o gabarito aprovado, 4 alternativas, tópico do edital e a marca de inédita', () => {
    pacoteIneditas.questoes.forEach((orig, i) => {
      const q = ineditas[i];
      expect(q.alternativas).toEqual(orig.alternativas);
      expect(q.alternativas).toHaveLength(4);
      expect(q.gabarito).toBe(['A', 'B', 'C', 'D'].indexOf(orig.gabarito));
      expect(q.origem).toBe('autoral');
      expect(q.fonte).toBe('Questão inédita · padrão IBAM');
      expect(topicos.has(q.topico_id!)).toBe(true);
      expect(q.topico_id!.startsWith(q.disciplina_id)).toBe(true);
    });
  });

  it('não repete questões de outros pacotes', () => {
    const outros = [preparadas, prepararPacote(pacoteMunicipio as Pacote), prepararPacote(pacoteProvas as Pacote)].flat().map((q) => q.hash);
    for (const q of ineditas) expect(outros).not.toContain(q.hash);
  });
});

describe('simulado: tempo e resultado', () => {
  it('conta o tempo restante a partir do início', () => {
    const s = { iniciado_em: '2027-01-31T15:10:00-03:00', duracao_seg: 10800 };
    expect(segundosRestantes(s, new Date('2027-01-31T18:09:00-03:00'))).toBe(60);
    expect(segundosRestantes(s, new Date('2027-01-31T19:00:00-03:00'))).toBe(0);
    expect(formatarDuracao(10800)).toBe('3:00:00');
    expect(formatarDuracao(65)).toBe('01:05');
  });

  it('converte os números decimais vindos do banco', () => {
    const r = normalizarResultado({ pontos: '57.00', pontos_max: '90.00', nota_minima: 54, aprovado: true, blocos: [{ bloco_id: 'x', nome: 'CE', pontos: '45.00', pontos_max: '60.00', acertos: 15, total: 20, em_branco: 0 }] });
    expect(r?.pontos).toBe(57);
    expect(r?.blocos[0].pontos).toBe(45);
  });
});
