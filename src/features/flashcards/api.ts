import { exigir, supabase } from '@/lib/supabase';
import type { EstadoFsrs, Flashcard, NovoFlashcard, RevisaoFlashcard } from './tipos';

const COLUNAS =
  'id, disciplina_id, topico_id, questao_id, frente, verso, origem, suspenso, criado_em, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review';

export async function buscarFlashcards(): Promise<Flashcard[]> {
  const todos: Flashcard[] = [];
  for (let de = 0; ; de += 1000) {
    const lote = exigir(await supabase.from('flashcards').select(COLUNAS).order('criado_em').order('id').range(de, de + 999)) as Flashcard[];
    todos.push(...lote);
    if (lote.length < 1000) return todos;
  }
}

export async function buscarRevisoesDesde(desde: string): Promise<RevisaoFlashcard[]> {
  return exigir(
    await supabase.from('revisoes_flashcard').select('flashcard_id, rating, state, review').gte('review', desde).order('review').limit(5000),
  ) as RevisaoFlashcard[];
}

export async function inserirFlashcards(userId: string, cartoes: NovoFlashcard[]): Promise<number> {
  let novos = 0;
  for (let i = 0; i < cartoes.length; i += 200) {
    const lote = cartoes.slice(i, i + 200).map((c) => ({ ...c, user_id: userId }));
    novos += (exigir(await supabase.from('flashcards').upsert(lote, { onConflict: 'user_id,hash', ignoreDuplicates: true }).select('id')) as unknown[]).length;
  }
  return novos;
}

export async function atualizarFlashcard(id: string, dados: Partial<Pick<Flashcard, 'frente' | 'verso' | 'disciplina_id' | 'topico_id' | 'suspenso'>>): Promise<void> {
  exigir(await supabase.from('flashcards').update(dados).eq('id', id));
}

/** Troca o texto de um cartão de pacote reescrito, mantendo o histórico de revisões (FSRS). */
export async function reescreverFlashcard(
  id: string,
  dados: Pick<Flashcard, 'frente' | 'verso' | 'disciplina_id' | 'topico_id'> & { hash: string },
): Promise<void> {
  exigir(await supabase.from('flashcards').update(dados).eq('id', id));
}

export async function excluirFlashcard(id: string): Promise<void> {
  exigir(await supabase.from('flashcards').delete().eq('id', id));
}

export interface Revisar {
  userId: string;
  id: string;
  estado: EstadoFsrs;
  log: Record<string, unknown> & { rating: number; state: number; review: string };
}

export async function revisarFlashcard({ id, estado, log }: Revisar): Promise<void> {
  const { error } = await supabase.rpc('revisar_flashcard', { p_id: id, p_cartao: estado, p_log: log });
  if (error) throw error;
}
