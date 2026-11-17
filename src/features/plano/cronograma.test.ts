import { PREFERENCIAS_PADRAO } from '@/features/perfil/preferencias';
import { editalDoSeed } from '@/test/fixtures';
import { calcularAtrasos, calcularRecuperadas, diasParaFirmar, dispensada, LIMITE_ATENCAO_MIN, planejarRecuperacao, type Concluida, type DiaFirmado } from './cronograma';
import { chaveTarefa, gerarPlano, margemDoDia, pesoDosTopicos, type EntradaPlano, type SessaoPlano, type TipoSessao } from './gerador';

const edital = editalDoSeed();
const pesos = pesoDosTopicos(edital);
const prefs = { ...PREFERENCIAS_PADRAO, minutosPorDia: [210, 210, 210, 210, 210, 210, 210] };
const base: EntradaPlano = {
  edital, progresso: {}, desempenho: new Map(), questoesPorTopico: new Map(edital.topicos.map((t) => [t.id, 5])),
  hoje: '2026-11-17', dataProva: '2027-01-31', prefs, margemRecuperacao: 30,
};

const sessao = (data: string, tipo: TipoSessao, topico: string | null, minutos: number): SessaoPlano => ({
  chave: `${data}|${tipo}|${topico ?? 'geral'}`, tipo, titulo: `${tipo} ${topico ?? ''}`, detalhe: '', minutos,
  disciplina_id: topico ? topico.split('-').slice(0, 2).join('-') : null, topico_id: topico, link: '/',
});
const feita = (s: SessaoPlano, data: string, em: string): Concluida => ({ chave: s.chave, data, tipo: s.tipo, topico_id: s.topico_id, minutos: s.minutos, concluida_em: em });

describe('atrasos do cronograma', () => {
  const d16: DiaFirmado = {
    data: '2026-11-16',
    sessoes: [
      sessao('2026-11-16', 'flashcards', null, 15),
      sessao('2026-11-16', 'erros', null, 20),
      sessao('2026-11-16', 'teoria', 'ace26-pt-16', 50),
      sessao('2026-11-16', 'questoes', 'ace26-pt-16', 30),
      sessao('2026-11-16', 'teoria', 'ace26-ce-07', 50),
    ],
  };
  const d15: DiaFirmado = { data: '2026-11-15', sessoes: [sessao('2026-11-15', 'teoria', 'ace26-sus-04', 50), sessao('2026-11-15', 'simulado', null, 45)] };

  it('o que não foi feito vira atraso; flashcards e caderno de erros não', () => {
    const atrasos = calcularAtrasos({ firmados: [d15, d16], concluidas: [], progresso: {}, pesos, hoje: '2026-11-17' });
    expect(atrasos.map((a) => a.sessao.tipo).sort()).toEqual(['questoes', 'simulado', 'teoria', 'teoria', 'teoria']);
  });

  it('prioriza o que vale mais na prova; no mesmo tópico, teoria antes de questões', () => {
    const atrasos = calcularAtrasos({ firmados: [d15, d16], concluidas: [], progresso: {}, pesos, hoje: '2026-11-17' });
    expect(atrasos[0].sessao.topico_id).toBe('ace26-ce-07'); // Conhecimentos Específicos vale mais
    const pt = atrasos.filter((a) => a.sessao.topico_id === 'ace26-pt-16').map((a) => a.sessao.tipo);
    expect(pt).toEqual(['teoria', 'questoes']);
    expect(atrasos.at(-1)!.sessao.topico_id).toBe('ace26-sus-04'); // SUS/Município vale menos
  });

  it('feito, ou dispensado no edital, sai dos atrasos; hoje e dias futuros não contam', () => {
    const atrasos = calcularAtrasos({
      firmados: [d16, { data: '2026-11-17', sessoes: [sessao('2026-11-17', 'teoria', 'ace26-ce-03', 50)] }],
      concluidas: [feita(d16.sessoes[2], '2026-11-16', '2026-11-16T20:00:00-03:00')],
      progresso: { 'ace26-ce-07': 'dominado' },
      pesos, hoje: '2026-11-17',
    });
    expect(atrasos.map((a) => `${a.sessao.tipo}|${a.sessao.topico_id}`)).toEqual(['questoes|ace26-pt-16']);
  });

  it('regras de dispensa: dominado; teoria já estudada; revisão de 7 dias do que nunca foi estudado', () => {
    expect(dispensada({ tipo: 'questoes', topico_id: 'x', titulo: 'x' }, { x: 'dominado' })).toBe(true);
    expect(dispensada({ tipo: 'teoria', topico_id: 'x', titulo: 'x' }, { x: 'revisando' })).toBe(true);
    expect(dispensada({ tipo: 'questoes', topico_id: 'x', titulo: 'x' }, { x: 'revisando' })).toBe(false);
    expect(dispensada({ tipo: 'revisao', topico_id: 'x', titulo: 'Revisão: 1. Ética' }, {})).toBe(true);
    expect(dispensada({ tipo: 'revisao', topico_id: 'x', titulo: 'Revisão: 1. Ética' }, { x: 'estudando' })).toBe(false);
    // "Revisão do conteúdo" de tópico sem questões é tarefa de estudo normal: não some.
    expect(dispensada({ tipo: 'revisao', topico_id: 'x', titulo: '1. Sistemas de saúde.' }, {})).toBe(false);
  });

  it('teoria estudada (inclusive recuperada) ganha revisão 7 dias depois do dia em que foi feita', () => {
    const plano = gerarPlano({ ...base, hoje: '2026-11-20', estudadas: new Map([['2026-11-19', ['ace26-ce-07']]]) });
    const dia26 = plano.dias.find((d) => d.data === '2026-11-26')!;
    expect(dia26.sessoes.some((s) => s.tipo === 'revisao' && s.topico_id === 'ace26-ce-07' && s.titulo.startsWith('Revisão: '))).toBe(true);
  });

  it('simulado: só o mais recente, e só na última semana', () => {
    const antigo: DiaFirmado = { data: '2026-11-01', sessoes: [sessao('2026-11-01', 'simulado', null, 45)] };
    const so = (f: DiaFirmado[]) => calcularAtrasos({ firmados: f, concluidas: [], progresso: {}, pesos, hoje: '2026-11-17' }).filter((a) => a.sessao.tipo === 'simulado');
    expect(so([antigo])).toEqual([]);
    expect(so([antigo, d15]).map((a) => a.origem)).toEqual(['2026-11-15']);
  });

  it('mesma tarefa em dois dias conta uma vez (a mais antiga)', () => {
    const d14: DiaFirmado = { data: '2026-11-14', sessoes: [sessao('2026-11-14', 'teoria', 'ace26-pt-16', 50)] };
    const atrasos = calcularAtrasos({ firmados: [d16, d14], concluidas: [], progresso: {}, pesos, hoje: '2026-11-17' });
    expect(atrasos.filter((a) => a.sessao.tipo === 'teoria' && a.sessao.topico_id === 'ace26-pt-16').map((a) => a.origem)).toEqual(['2026-11-14']);
  });

  it('conta como recuperado o que foi concluído depois do dia previsto', () => {
    const r = calcularRecuperadas([d16], [
      feita(d16.sessoes[2], '2026-11-16', '2026-11-17T09:00:00-03:00'), // recuperada no dia seguinte
      feita(d16.sessoes[3], '2026-11-16', '2026-11-16T21:00:00-03:00'), // feita no dia
    ], '2026-11-17');
    expect(r).toEqual({ quantidade: 1, minutos: 50 });
  });
});

describe('plano de recuperação', () => {
  const plano = gerarPlano(base);

  it('cada dia de estudo reserva a margem, sem passar do tempo disponível', () => {
    expect(margemDoDia(210, 30)).toBe(30);
    expect(margemDoDia(60, 30)).toBe(15);
    expect(margemDoDia(45, 30)).toBe(0);
    for (const d of plano.dias) expect(d.sessoes.reduce((t, s) => t + s.minutos, 0) + d.margem).toBeLessThanOrEqual(d.minutosDisponiveis);
    expect(plano.dias[0].margem).toBe(30);
    expect(plano.pendentes).toEqual([]); // com 3h30 por dia, o edital todo cabe mesmo com a margem
  });

  const atrasos = calcularAtrasos({
    firmados: [{ data: '2026-11-16', sessoes: [sessao('2026-11-16', 'teoria', 'ace26-ce-07', 50), sessao('2026-11-16', 'questoes', 'ace26-pt-16', 30), sessao('2026-11-16', 'teoria', 'ace26-sus-04', 25)] }],
    concluidas: [], progresso: {}, pesos, hoje: '2026-11-17',
  });

  it('distribui os atrasos nas margens dos próximos dias e prevê quando fica em dia', () => {
    const r = planejarRecuperacao({ atrasos, dias: plano.dias, hoje: '2026-11-17', dataProva: '2027-01-31', firmados: [], concluidas: [] });
    expect(r.status).toBe('leve');
    expect(r.minutosPendentes).toBe(105);
    expect(r.plano.map((p) => [p.data, p.tarefas.map((t) => t.sessao.topico_id)])).toEqual([
      ['2026-11-17', ['ace26-ce-07']], // tarefa maior que a margem entra sozinha
      ['2026-11-18', ['ace26-pt-16']],
      ['2026-11-19', ['ace26-sus-04']],
    ]);
    expect(r.hoje.map((t) => t.sessao.topico_id)).toEqual(['ace26-ce-07']);
    expect(r.previsao).toBe('2026-11-19');
  });

  it('"encaixar hoje" puxa a tarefa para hoje, além da margem', () => {
    const puxada = atrasos.find((a) => a.sessao.topico_id === 'ace26-sus-04')!.sessao.chave;
    const r = planejarRecuperacao({ atrasos, dias: plano.dias, hoje: '2026-11-17', dataProva: '2027-01-31', puxadas: new Set([puxada]), firmados: [], concluidas: [] });
    expect(r.hoje.map((t) => t.sessao.topico_id)).toEqual(['ace26-sus-04', 'ace26-ce-07']);
  });

  it('em dia, leve ou atenção', () => {
    const vazio = planejarRecuperacao({ atrasos: [], dias: plano.dias, hoje: '2026-11-17', dataProva: '2027-01-31', firmados: [], concluidas: [] });
    expect(vazio.status).toBe('em_dia');
    // Muito atraso: passa do limite de atenção.
    const muitos = Array.from({ length: 10 }, (_, i) => ({ sessao: sessao('2026-11-10', 'teoria', `t${i}`, 50), origem: '2026-11-10', peso: 1 }));
    expect(muitos.reduce((t, a) => t + a.sessao.minutos, 0)).toBeGreaterThan(LIMITE_ATENCAO_MIN);
    expect(planejarRecuperacao({ atrasos: muitos, dias: plano.dias, hoje: '2026-11-17', dataProva: '2027-01-31', firmados: [], concluidas: [] }).status).toBe('atencao');
    // Perto da prova: não cabe antes da semana final.
    const perto = planejarRecuperacao({ atrasos: muitos, dias: plano.dias.filter((d) => d.data >= '2027-01-20'), hoje: '2026-11-17', dataProva: '2027-01-31', firmados: [], concluidas: [] });
    expect(perto.previsao).toBeNull();
    expect(perto.naoCabem.length).toBeGreaterThan(0);
  });
});

describe('cronograma firmado', () => {
  it('firma a semana a partir de hoje, sem regravar o que já está guardado', () => {
    const plano = gerarPlano(base);
    const novos = diasParaFirmar(plano.dias, [{ data: '2026-11-18', sessoes: [] }], '2026-11-17');
    expect(novos.map((d) => d.data)).toEqual(['2026-11-17', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23']);
  });

  it('dias firmados são mantidos como estão e o que está atrasado não é planejado de novo', () => {
    const fixo = [sessao('2026-11-17', 'flashcards', null, 15), sessao('2026-11-17', 'teoria', 'ace26-ce-07', 50)];
    const plano = gerarPlano({ ...base, fixos: new Map([['2026-11-17', fixo]]), reservados: new Set([chaveTarefa('teoria', 'ace26-ce-01')]) });
    expect(plano.dias[0]).toMatchObject({ firmado: true, sessoes: fixo });
    const resto = plano.dias.slice(1).flatMap((d) => d.sessoes);
    expect(resto.some((s) => s.tipo === 'teoria' && s.topico_id === 'ace26-ce-07')).toBe(false); // já firmada
    expect(resto.some((s) => s.tipo === 'teoria' && s.topico_id === 'ace26-ce-01')).toBe(false); // atrasada → recuperação
    // A teoria firmada hoje ganha a revisão de 7 dias.
    expect(plano.dias.find((d) => d.data === '2026-11-24')!.sessoes.some((s) => s.tipo === 'revisao' && s.topico_id === 'ace26-ce-07')).toBe(true);
  });
});
