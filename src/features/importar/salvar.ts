import { criarTexto, inserirQuestoes } from '@/features/questoes/api';
import { hashQuestao, type NovaQuestao, type OrigemQuestao } from '@/features/questoes/tipos';
import { rascunhoValido, type Rascunho } from './EditorQuestao';
import type { TextoExtraido } from './parser';

export interface ResultadoSalvar {
  novas: number;
  repetidas: number;
}

/** Cria os textos de apoio usados e grava as questões válidas (ignorando repetidas). */
export async function salvarRascunhos(
  userId: string, rascunhos: Rascunho[], textos: TextoExtraido[], origem: OrigemQuestao, fonte: string | null,
): Promise<ResultadoSalvar> {
  const validas = rascunhos.filter((r) => r.incluir && rascunhoValido(r));
  const idsTextos = new Map<number, string>();
  for (const indice of new Set(validas.map((r) => r.texto).filter((t): t is number => t !== null))) {
    const t = textos[indice];
    if (t?.conteudo) idsTextos.set(indice, await criarTexto(userId, t.titulo, t.conteudo));
  }
  const novas: NovaQuestao[] = validas.map((r) => {
    const alternativas = r.alternativas.map((a) => a.trim()).filter(Boolean);
    return {
      disciplina_id: r.disciplina_id!,
      topico_id: r.topico_id,
      texto_id: r.texto !== null ? idsTextos.get(r.texto) ?? null : null,
      enunciado: r.enunciado.trim(),
      alternativas,
      gabarito: r.anulada ? null : r.gabarito,
      anulada: r.anulada,
      explicacao: r.explicacao.trim() || null,
      origem,
      fonte: fonte?.trim() || null,
      numero_original: r.numero,
      dificuldade: null,
      hash: hashQuestao(r.enunciado.trim(), alternativas),
    };
  });
  const inseridas = await inserirQuestoes(userId, novas);
  return { novas: inseridas, repetidas: novas.length - inseridas };
}
