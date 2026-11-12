import { embaralhar } from '@/lib/aleatorio';
import type { Edital } from '@/features/edital/tipos';
import { mapaBlocos } from '@/features/questoes/pratica';
import { questaoValida, type ItemCaderno, type Questao, type Resposta } from '@/features/questoes/tipos';
import type { ConfigSimulado } from './config';

export interface Selecao {
  ids: string[];
  /** blocos sem questões suficientes no banco: bloco_id → quantas faltam */
  faltando: Record<string, number>;
}

/**
 * Escolhe as questões do simulado, bloco a bloco, priorizando:
 * 1) nunca respondidas, 2) pendentes no caderno de erros, 3) as demais.
 * A ordem final segue a ordem dos blocos (como no caderno de prova).
 */
export function selecionarQuestoes(
  edital: Edital, questoes: Questao[], respostas: Resposta[], caderno: ItemCaderno[], config: ConfigSimulado, aleatorio = Math.random,
): Selecao {
  const blocoDe = mapaBlocos(edital);
  const respondidas = new Set(respostas.map((r) => r.questao_id));
  const pendentes = new Set(caderno.filter((c) => !c.resolvido).map((c) => c.questao_id));
  const ids: string[] = [];
  const faltando: Record<string, number> = {};

  for (const bloco of [...edital.blocos].sort((a, b) => a.ordem - b.ordem)) {
    const quantas = config.porBloco[bloco.id] ?? 0;
    if (!quantas) continue;
    const doBloco = questoes.filter((q) => questaoValida(q) && blocoDe.get(q.disciplina_id)?.id === bloco.id);
    const prioridade = (q: Questao) => (!respondidas.has(q.id) ? 0 : pendentes.has(q.id) ? 1 : 2);
    const ordenadas = [0, 1, 2].flatMap((p) => embaralhar(doBloco.filter((q) => prioridade(q) === p), aleatorio));
    const escolhidas = ordenadas.slice(0, quantas);
    // Dentro do bloco, agrupa por disciplina e mantém juntas as questões de um mesmo texto.
    escolhidas.sort((a, b) => a.disciplina_id.localeCompare(b.disciplina_id) || (a.texto_id ?? '').localeCompare(b.texto_id ?? ''));
    ids.push(...escolhidas.map((q) => q.id));
    if (escolhidas.length < quantas) faltando[bloco.id] = quantas - escolhidas.length;
  }
  return { ids, faltando };
}
