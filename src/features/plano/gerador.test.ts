import { PREFERENCIAS_PADRAO } from '@/features/perfil/preferencias';
import { editalDoSeed } from '@/test/fixtures';
import { gerarPlano, montarTarefas, somarDias, type EntradaPlano } from './gerador';

const edital = editalDoSeed();
const comQuestoes = new Map(edital.topicos.map((t) => [t.id, 5]));
const base: EntradaPlano = {
  edital, progresso: {}, desempenho: new Map(), questoesPorTopico: comQuestoes,
  hoje: '2026-11-13', dataProva: '2027-01-31', prefs: PREFERENCIAS_PADRAO,
};

describe('plano de estudos', () => {
  const plano = gerarPlano(base);

  it('vai de hoje até o dia da prova', () => {
    expect(plano.dias[0].data).toBe('2026-11-13');
    expect(plano.dias.at(-1)).toMatchObject({ data: '2027-01-31', fase: 'prova' });
    expect(plano.dias.at(-2)?.fase).toBe('vespera');
  });

  it('com 2h por dia e 4h aos sábados, todo o edital cabe antes da semana final', () => {
    expect(plano.pendentes).toEqual([]);
    expect(plano.fimDaTeoria! < '2027-01-24').toBe(true);
  });

  it('a semana final não tem teoria nova, só revisão, erros e simulado', () => {
    const final = plano.dias.filter((d) => d.data >= '2027-01-24' && d.data < '2027-01-31');
    expect(final.flatMap((d) => d.sessoes).some((s) => s.tipo === 'teoria' || s.tipo === 'questoes')).toBe(false);
    expect(final.flatMap((d) => d.sessoes).some((s) => s.tipo === 'simulado')).toBe(true);
  });

  it('nenhum dia passa do tempo disponível', () => {
    for (const d of plano.dias) expect(d.sessoes.reduce((s, x) => s + x.minutos, 0)).toBeLessThanOrEqual(d.minutosDisponiveis);
  });

  it('simulado semanal no sábado: rápido no início, completo nas 6 últimas semanas', () => {
    const sabados = plano.dias.filter((d) => d.diaSemana === 6);
    expect(sabados[0].sessoes.some((s) => s.titulo === 'Simulado rápido')).toBe(true);
    const finais = sabados.filter((d) => d.data >= '2026-12-20' && d.fase !== 'vespera'); // véspera é leve, sem simulado
    expect(finais.length).toBeGreaterThanOrEqual(5);
    expect(finais.every((d) => d.sessoes.some((s) => s.titulo === 'Simulado completo' && s.minutos === 180))).toBe(true);
  });

  it('dá mais tempo a Conhecimentos Específicos, depois Português, depois SUS/Município', () => {
    const duasSemanas = plano.dias.slice(0, 14).flatMap((d) => d.sessoes).filter((s) => s.tipo === 'teoria' || s.tipo === 'questoes');
    const porDisc = (ids: string[]) => duasSemanas.filter((s) => ids.includes(s.disciplina_id!)).reduce((t, s) => t + s.minutos, 0);
    const ce = porDisc(['ace26-ce']), pt = porDisc(['ace26-pt']), sm = porDisc(['ace26-sus', 'ace26-mun']);
    expect(ce).toBeGreaterThan(pt);
    expect(pt).toBeGreaterThan(sm);
    expect(sm).toBeGreaterThan(0);
  });

  it('revisa 7 dias depois um tópico estudado', () => {
    const teoria = plano.dias[0].sessoes.find((s) => s.tipo === 'teoria')!;
    const semanaDepois = plano.dias.find((d) => d.data === somarDias('2026-11-13', 7))!;
    expect(semanaDepois.sessoes.some((s) => s.tipo === 'revisao' && s.topico_id === teoria.topico_id)).toBe(true);
  });

  it('chaves das sessões são únicas no dia (para marcar como concluída)', () => {
    for (const d of plano.dias) expect(new Set(d.sessoes.map((s) => s.chave)).size).toBe(d.sessoes.length);
  });

  it('é determinístico', () => {
    expect(gerarPlano(base)).toEqual(plano);
  });

  it('com pouco tempo, avisa o que não coube', () => {
    const curto = gerarPlano({ ...base, prefs: { ...PREFERENCIAS_PADRAO, minutosPorDia: [30, 30, 30, 30, 30, 30, 30] } });
    expect(curto.minutosPendentes).toBeGreaterThan(0);
  });

  it('respeita dias de folga (0 minutos)', () => {
    const semDomingo = gerarPlano({ ...base, prefs: { ...PREFERENCIAS_PADRAO, minutosPorDia: [0, 120, 120, 120, 120, 120, 240] } });
    const domingos = semDomingo.dias.filter((d) => d.diaSemana === 0 && d.fase !== 'prova');
    expect(domingos.every((d) => d.fase === 'folga' && d.sessoes.length === 0)).toBe(true);
  });
});

describe('tarefas por tópico', () => {
  it('tópico dominado não gera tarefa; acerto baixo gera reforço', () => {
    const t = (e: Partial<EntradaPlano>) => [...montarTarefas({ ...base, ...e }).values()].flat().filter((x) => x.topico.id === 'ace26-ce-01');
    expect(t({}).map((x) => x.tipo)).toEqual(['teoria', 'questoes']);
    expect(t({ progresso: { 'ace26-ce-01': 'dominado' } })).toEqual([]);
    const fraco = t({ progresso: { 'ace26-ce-01': 'dominado' }, desempenho: new Map([['ace26-ce-01', { respondidas: 5, acertos: 1 }]]) });
    expect(fraco.map((x) => [x.tipo, x.minutos])).toEqual([['questoes', 25]]);
  });

  it('sem questões no banco (ex.: Município), a tarefa vira revisão', () => {
    const tarefas = [...montarTarefas({ ...base, questoesPorTopico: new Map() }).values()].flat();
    expect(tarefas.some((x) => x.tipo === 'questoes')).toBe(false);
    expect(tarefas.some((x) => x.tipo === 'revisao')).toBe(true);
  });

  it('itens com subitens são estudados pelos subitens (doenças)', () => {
    const ids = [...montarTarefas(base).values()].flat().map((x) => x.topico.id);
    expect(ids).not.toContain('ace26-ce-08');
    expect(ids).toContain('ace26-ce-08-03');
  });
});
