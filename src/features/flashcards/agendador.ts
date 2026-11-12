import { fsrs, generatorParameters, type Card, type Grade, type ReviewLog } from 'ts-fsrs';
import { hashTexto } from '@/lib/aleatorio';
import type { EstadoFsrs, Flashcard, RevisaoFlashcard } from './tipos';

const DIA = 86_400_000;

/**
 * Agendador FSRS. O intervalo máximo é limitado aos dias que faltam para a prova
 * (mínimo de 7), para que todo cartão seja revisto ao menos uma vez antes dela.
 */
export function criarAgendador(dataProva: Date | null, agora: Date = new Date()) {
  const dias = dataProva ? Math.floor((dataProva.getTime() - agora.getTime()) / DIA) : 365;
  return fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: true, maximum_interval: Math.max(7, Math.min(365, dias)) }));
}

export function paraCard(e: EstadoFsrs): Card {
  return {
    due: new Date(e.due), stability: e.stability, difficulty: e.difficulty, elapsed_days: e.elapsed_days,
    scheduled_days: e.scheduled_days, learning_steps: e.learning_steps, reps: e.reps, lapses: e.lapses,
    state: e.state, last_review: e.last_review ? new Date(e.last_review) : undefined,
  };
}

export function deCard(c: Card): EstadoFsrs {
  return {
    due: c.due.toISOString(), stability: c.stability, difficulty: c.difficulty, elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days, learning_steps: c.learning_steps, reps: c.reps, lapses: c.lapses,
    state: c.state as EstadoFsrs['state'], last_review: c.last_review ? c.last_review.toISOString() : null,
  };
}

export const logParaBanco = (l: ReviewLog) => ({
  rating: l.rating, state: l.state, due: l.due.toISOString(), stability: l.stability, difficulty: l.difficulty,
  elapsed_days: l.elapsed_days, last_elapsed_days: l.last_elapsed_days, scheduled_days: l.scheduled_days,
  learning_steps: l.learning_steps, review: l.review.toISOString(),
});

/** "1 min", "10 min", "3 h", "1 dia", "12 dias", "2 meses" */
export function rotuloIntervalo(de: Date, ate: Date): string {
  const min = Math.max(1, Math.round((ate.getTime() - de.getTime()) / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(min / 1440);
  if (d < 31) return d === 1 ? '1 dia' : `${d} dias`;
  const m = Math.round(d / 30);
  return m === 1 ? '1 mês' : `${m} meses`;
}

export interface Previsao {
  nota: Grade;
  estado: EstadoFsrs;
  log: ReturnType<typeof logParaBanco>;
  intervalo: string;
}

export function preverNotas(agendador: ReturnType<typeof criarAgendador>, cartao: EstadoFsrs, agora: Date): Previsao[] {
  const previa = agendador.repeat(paraCard(cartao), agora);
  return ([1, 2, 3, 4] as Grade[]).map((nota) => {
    const { card, log } = previa[nota];
    return { nota, estado: deCard(card), log: logParaBanco(log), intervalo: rotuloIntervalo(agora, card.due) };
  });
}

export const LIMITE_ANTECIPACAO_MIN = 20;

/**
 * Fila de estudo de hoje: primeiro os cartões vencidos (aprendendo e revisão),
 * depois os novos, respeitando o limite diário de novos. Cartões em
 * aprendizagem que vencem nos próximos 20 min entram no fim da fila.
 */
export function montarFilaEstudo(
  cartoes: Flashcard[], revisoesHoje: RevisaoFlashcard[], novosPorDia: number, agora: Date, disciplinaId?: string,
): Flashcard[] {
  const ativos = cartoes.filter((c) => !c.suspenso && (!disciplinaId || c.disciplina_id === disciplinaId));
  const t = agora.getTime();
  const vencidos = ativos.filter((c) => c.state !== 0 && new Date(c.due).getTime() <= t).sort((a, b) => a.due.localeCompare(b.due));
  const novosHoje = new Set(revisoesHoje.filter((r) => r.state === 0).map((r) => r.flashcard_id)).size;
  const vagas = Math.max(0, novosPorDia - novosHoje);
  // Novos em ordem estável (pelo conteúdo), intercalando disciplinas por ordem de criação.
  const novos = ativos.filter((c) => c.state === 0).sort((a, b) => a.criado_em.localeCompare(b.criado_em) || hashTexto(a.id).localeCompare(hashTexto(b.id))).slice(0, vagas);
  const quaseVencidos = ativos
    .filter((c) => (c.state === 1 || c.state === 3) && new Date(c.due).getTime() > t && new Date(c.due).getTime() <= t + LIMITE_ANTECIPACAO_MIN * 60_000)
    .sort((a, b) => a.due.localeCompare(b.due));
  return [...vencidos, ...novos, ...quaseVencidos];
}

export interface ResumoCartoes {
  total: number;
  paraRevisar: number;
  novosDisponiveis: number;
  novosHoje: number;
  aprendidos: number;
}

export function resumirCartoes(cartoes: Flashcard[], revisoesHoje: RevisaoFlashcard[], novosPorDia: number, agora: Date, disciplinaId?: string): ResumoCartoes {
  const ativos = cartoes.filter((c) => !c.suspenso && (!disciplinaId || c.disciplina_id === disciplinaId));
  const novosHoje = new Set(revisoesHoje.filter((r) => r.state === 0).map((r) => r.flashcard_id)).size;
  return {
    total: ativos.length,
    paraRevisar: ativos.filter((c) => c.state !== 0 && new Date(c.due).getTime() <= agora.getTime()).length,
    novosDisponiveis: Math.min(ativos.filter((c) => c.state === 0).length, Math.max(0, novosPorDia - novosHoje)),
    novosHoje,
    aprendidos: ativos.filter((c) => c.state === 2).length,
  };
}

export const hashCartao = (frente: string) =>
  hashTexto(frente.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim());
