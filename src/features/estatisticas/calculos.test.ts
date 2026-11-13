import { partesDoTrecho } from '@/features/materiais/tipos';
import type { Questao, Resposta } from '@/features/questoes/tipos';
import type { Simulado } from '@/features/simulados/tipos';
import { editalDoSeed } from '@/test/fixtures';
import { acertoPorDisciplina, evolucaoSimulados, inicioDaSemana, minutosPorSemana, preverNota, topicosFracos } from './calculos';

const edital = editalDoSeed();
const q = (id: string, disciplina_id: string, topico_id: string): Questao => ({
  id, disciplina_id, topico_id, texto_id: null, enunciado: id, alternativas: ['a', 'b', 'c', 'd'], gabarito: 0, anulada: false,
  explicacao: null, origem: 'autoral', fonte: null, numero_original: null, dificuldade: 1, criado_em: '',
});
const questoes = [q('ce', 'ace26-ce', 'ace26-ce-08-03'), q('pt', 'ace26-pt', 'ace26-pt-16'), q('sus', 'ace26-sus', 'ace26-sus-13'), q('mun', 'ace26-mun', 'ace26-mun-03')];
let seq = 0;
const resp = (questao_id: string, correta: boolean): Resposta => ({ questao_id, correta, escolha: 0, origem: 'treino', respondida_em: new Date(Date.UTC(2026, 10, 13, 10) + seq++ * 1000).toISOString() });
const muitas = (id: string, acertos: number, total: number) => Array.from({ length: total }, (_, i) => resp(id, i < acertos));

describe('previsão de nota', () => {
  it('sem dados suficientes, não prevê', () => {
    const p = preverNota(edital, questoes, muitas('ce', 5, 5));
    expect(p.completa).toBe(false);
    expect(p.blocos[0].taxa).toBeNull();
  });

  it('com 10+ respostas por bloco, soma pontos esperados com os pesos da prova', () => {
    // CE 80% (20 × 3 × 0,8 = 48) · PT 50% (10 × 2 × 0,5 = 10) · SUS/Mun 70% (10 × 1 × 0,7 = 7) → 65
    const r = [...muitas('ce', 8, 10), ...muitas('pt', 5, 10), ...muitas('sus', 4, 5), ...muitas('mun', 3, 5)];
    const p = preverNota(edital, questoes, r);
    expect(p.completa).toBe(true);
    expect(p.esperado).toBe(65);
    expect(p.faixa[0]).toBeLessThan(65);
    expect(p.faixa[1]).toBeGreaterThan(65);
    expect(p.minimo).toBe(54);
  });

  it('usa só as 40 respostas mais recentes de cada bloco', () => {
    const antigas = muitas('ce', 0, 40); // erros antigos
    const recentes = muitas('ce', 40, 40); // acertos recentes
    const outras = [...muitas('pt', 10, 10), ...muitas('sus', 10, 10)];
    expect(preverNota(edital, questoes, [...antigas, ...recentes, ...outras]).blocos[0].taxa).toBe(1);
  });

  it('calcula a chance de zerar um bloco', () => {
    const r = [...muitas('ce', 10, 10), ...muitas('pt', 10, 10), ...muitas('sus', 1, 10)];
    const sm = preverNota(edital, questoes, r).blocos[2];
    expect(sm.chanceDeZerar).toBeCloseTo(0.9 ** 10, 5);
  });
});

describe('estatísticas', () => {
  it('evolução dos simulados em ordem cronológica, em percentual', () => {
    const s = (id: string, ini: string, pontos: number, max: number): Simulado => ({
      id, tipo: 'rapido', status: 'finalizado', duracao_seg: 2700, iniciado_em: ini, finalizado_em: ini,
      resultado: { acertos: 0, total: 10, em_branco: 0, pontos, pontos_max: max, nota_minima: 16, algum_bloco_zerado: false, aprovado: pontos >= 16, tempo_seg: 1 },
    } as Simulado);
    const ev = evolucaoSimulados([s('b', '2026-11-20T10:00:00Z', 20, 26), s('a', '2026-11-13T10:00:00Z', 13, 26), { ...s('c', '2026-11-21T10:00:00Z', 0, 26), status: 'em_andamento', resultado: null }]);
    expect(ev.map((p) => p.percentual)).toEqual([50, 77]);
  });

  it('semanas começam na segunda-feira e somam os minutos', () => {
    expect(inicioDaSemana('2026-11-13')).toBe('2026-11-09'); // sexta → segunda
    expect(inicioDaSemana('2026-11-15')).toBe('2026-11-09'); // domingo pertence à semana anterior
    const semanas = minutosPorSemana([{ data: '2026-11-13', minutos: 50 }, { data: '2026-11-10', minutos: 30 }, { data: '2026-11-05', minutos: 20 }, { data: '2025-01-01', minutos: 999 }], '2026-11-13', 8);
    expect(semanas).toHaveLength(8);
    expect(semanas.at(-1)).toEqual({ inicio: '2026-11-09', minutos: 80 });
    expect(semanas.at(-2)).toEqual({ inicio: '2026-11-02', minutos: 20 });
  });

  it('acerto por disciplina e tópicos mais fracos primeiro', () => {
    const r = [...muitas('ce', 1, 4), ...muitas('pt', 3, 3), ...muitas('sus', 1, 2)];
    expect(acertoPorDisciplina(edital, questoes, r).find((d) => d.id === 'ace26-ce')).toMatchObject({ respondidas: 4, acertos: 1 });
    const f = topicosFracos(edital, questoes, r);
    expect(f.map((x) => x.id)).toEqual(['ace26-ce-08-03', 'ace26-pt-16']); // SUS ficou de fora: só 2 respostas
  });

  it('trecho da busca com destaque', () => {
    expect(partesDoTrecho('composta de treze [[Vereadores]] eleitos')).toEqual([
      { texto: 'composta de treze ', destaque: false }, { texto: 'Vereadores', destaque: true }, { texto: ' eleitos', destaque: false },
    ]);
  });
});
