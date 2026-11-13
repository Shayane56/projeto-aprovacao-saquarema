import type { BlocoProva, Edital, Topico } from '@/features/edital/tipos';
import { mapaBlocos } from '@/features/questoes/pratica';
import type { Questao, Resposta } from '@/features/questoes/tipos';
import type { Simulado } from '@/features/simulados/tipos';

export interface PontoSimulado {
  data: string;
  percentual: number;
  pontos: number;
  pontosMax: number;
  aprovado: boolean;
  tipo: Simulado['tipo'];
}

export function evolucaoSimulados(simulados: Simulado[]): PontoSimulado[] {
  return simulados
    .filter((s) => s.status === 'finalizado' && s.resultado && s.resultado.pontos_max > 0)
    .sort((a, b) => a.iniciado_em.localeCompare(b.iniciado_em))
    .map((s) => ({
      data: s.iniciado_em,
      percentual: Math.round((s.resultado!.pontos / s.resultado!.pontos_max) * 100),
      pontos: s.resultado!.pontos,
      pontosMax: s.resultado!.pontos_max,
      aprovado: s.resultado!.aprovado,
      tipo: s.tipo,
    }));
}

/** Segunda-feira (AAAA-MM-DD) da semana de uma data civil. */
export function inicioDaSemana(data: string): string {
  const d = new Date(`${data}T12:00:00Z`);
  const dia = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((dia + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function minutosPorSemana(sessoes: { data: string; minutos: number }[], hoje: string, semanas = 8): { inicio: string; minutos: number }[] {
  const atual = inicioDaSemana(hoje);
  const lista = Array.from({ length: semanas }, (_, i) => {
    const d = new Date(`${atual}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7 * (semanas - 1 - i));
    return { inicio: d.toISOString().slice(0, 10), minutos: 0 };
  });
  const porInicio = new Map(lista.map((s) => [s.inicio, s]));
  for (const s of sessoes) {
    const alvo = porInicio.get(inicioDaSemana(s.data));
    if (alvo) alvo.minutos += s.minutos;
  }
  return lista;
}

export interface AcertoLinha {
  id: string;
  rotulo: string;
  respondidas: number;
  acertos: number;
}

export function acertoPorDisciplina(edital: Edital, questoes: Questao[], respostas: Resposta[]): AcertoLinha[] {
  const disc = new Map(questoes.map((q) => [q.id, q.disciplina_id]));
  const linhas = new Map(edital.disciplinas.map((d) => [d.id, { id: d.id, rotulo: d.nome, respondidas: 0, acertos: 0 }]));
  for (const r of respostas) {
    const l = linhas.get(disc.get(r.questao_id) ?? '');
    if (!l) continue;
    l.respondidas += 1;
    if (r.correta) l.acertos += 1;
  }
  return [...linhas.values()];
}

export interface TopicoFraco extends AcertoLinha {
  topico: Topico;
}

/** Tópicos com pelo menos `minimo` respostas, do menor para o maior acerto. */
export function topicosFracos(edital: Edital, questoes: Questao[], respostas: Resposta[], minimo = 3, limite = 8): TopicoFraco[] {
  const topicoDe = new Map(questoes.map((q) => [q.id, q.topico_id]));
  const porId = new Map(edital.topicos.map((t) => [t.id, t]));
  const contagem = new Map<string, { respondidas: number; acertos: number }>();
  for (const r of respostas) {
    const t = topicoDe.get(r.questao_id);
    if (!t) continue;
    const c = contagem.get(t) ?? { respondidas: 0, acertos: 0 };
    c.respondidas += 1;
    if (r.correta) c.acertos += 1;
    contagem.set(t, c);
  }
  return [...contagem.entries()]
    .filter(([id, c]) => c.respondidas >= minimo && porId.has(id))
    .map(([id, c]) => ({ id, rotulo: porId.get(id)!.titulo, topico: porId.get(id)!, ...c }))
    .sort((a, b) => a.acertos / a.respondidas - b.acertos / b.respondidas || b.respondidas - a.respondidas)
    .slice(0, limite);
}

export interface PrevisaoBloco {
  bloco: BlocoProva;
  respondidas: number;
  taxa: number | null;
  esperado: number | null;
  /** Probabilidade de zerar o bloco na prova, supondo a taxa de acerto atual. */
  chanceDeZerar: number | null;
}

export interface Previsao {
  blocos: PrevisaoBloco[];
  completa: boolean;
  esperado: number;
  faixa: [number, number];
  minimo: number;
  maximo: number;
}

export const MINIMO_PARA_PREVER = 10;
const JANELA = 40;

/**
 * Previsão de nota: em cada bloco, a taxa de acerto das últimas 40 respostas
 * vezes as questões e o valor do bloco na prova. A faixa é ± 1 desvio-padrão
 * (modelo binomial). Só fica "completa" com pelo menos 10 respostas por bloco.
 */
export function preverNota(edital: Edital, questoes: Questao[], respostas: Resposta[]): Previsao {
  const blocoDe = mapaBlocos(edital);
  const disc = new Map(questoes.map((q) => [q.id, q.disciplina_id]));
  const porBloco = new Map<string, boolean[]>();
  for (const r of [...respostas].sort((a, b) => a.respondida_em.localeCompare(b.respondida_em))) {
    const b = blocoDe.get(disc.get(r.questao_id) ?? '');
    if (!b) continue;
    porBloco.set(b.id, [...(porBloco.get(b.id) ?? []), r.correta]);
  }
  let esperado = 0;
  let variancia = 0;
  const blocos = [...edital.blocos].sort((a, b) => a.ordem - b.ordem).map((bloco) => {
    const recentes = (porBloco.get(bloco.id) ?? []).slice(-JANELA);
    if (recentes.length < MINIMO_PARA_PREVER) return { bloco, respondidas: recentes.length, taxa: null, esperado: null, chanceDeZerar: null };
    const taxa = recentes.filter(Boolean).length / recentes.length;
    const e = bloco.num_questoes * bloco.valor_questao * taxa;
    esperado += e;
    variancia += bloco.num_questoes * bloco.valor_questao ** 2 * taxa * (1 - taxa);
    return { bloco, respondidas: recentes.length, taxa, esperado: e, chanceDeZerar: (1 - taxa) ** bloco.num_questoes };
  });
  const dp = Math.sqrt(variancia);
  const maximo = edital.concurso.pontuacao_total;
  return {
    blocos,
    completa: blocos.every((b) => b.taxa !== null),
    esperado: Math.round(esperado),
    faixa: [Math.max(0, Math.round(esperado - dp)), Math.min(maximo, Math.round(esperado + dp))],
    minimo: edital.concurso.nota_minima,
    maximo,
  };
}
