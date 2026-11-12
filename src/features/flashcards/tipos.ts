export type EstadoCartao = 0 | 1 | 2 | 3; // novo, aprendendo, revisão, reaprendendo
export type OrigemCartao = 'autoral' | 'manual' | 'erro' | 'ia';

export interface EstadoFsrs {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: EstadoCartao;
  last_review: string | null;
}

export interface Flashcard extends EstadoFsrs {
  id: string;
  disciplina_id: string;
  topico_id: string | null;
  questao_id: string | null;
  frente: string;
  verso: string;
  origem: OrigemCartao;
  suspenso: boolean;
  criado_em: string;
}

export interface NovoFlashcard {
  disciplina_id: string;
  topico_id: string | null;
  questao_id: string | null;
  frente: string;
  verso: string;
  origem: OrigemCartao;
  hash: string;
}

export interface RevisaoFlashcard {
  flashcard_id: string;
  rating: 1 | 2 | 3 | 4;
  /** estado do cartão ANTES da revisão (0 = era novo) */
  state: EstadoCartao;
  review: string;
}

export const NOTAS = [
  { valor: 1, rotulo: 'Errei', classe: 'border-perigo/40 bg-perigo/10 text-perigo' },
  { valor: 2, rotulo: 'Difícil', classe: 'border-alerta/40 bg-alerta/10 text-alerta' },
  { valor: 3, rotulo: 'Bom', classe: 'border-sucesso/40 bg-sucesso/10 text-sucesso' },
  { valor: 4, rotulo: 'Fácil', classe: 'border-primaria/40 bg-primaria-suave text-primaria' },
] as const;
