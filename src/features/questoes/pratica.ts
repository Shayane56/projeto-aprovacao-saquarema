import { embaralhar } from '@/lib/aleatorio';
import type { BlocoProva, Edital } from '@/features/edital/tipos';
import { questaoValida, type ItemCaderno, type Questao, type Resposta } from './tipos';

/** disciplina_id → bloco da prova */
export function mapaBlocos(edital: Edital): Map<string, BlocoProva> {
  const blocos = new Map(edital.blocos.map((b) => [b.id, b]));
  return new Map(edital.disciplinas.map((d) => [d.id, blocos.get(d.bloco_id)!]));
}

export interface Desempenho {
  respondidas: number;
  acertos: number;
}

export interface ResumoDesempenho {
  geral: Desempenho;
  porBloco: { bloco: BlocoProva; desempenho: Desempenho; disponiveis: number }[];
  respondidasHoje: number;
}

export function resumirDesempenho(edital: Edital, questoes: Questao[], respostas: Resposta[], hoje: string): ResumoDesempenho {
  const blocoDe = mapaBlocos(edital);
  const questaoPorId = new Map(questoes.map((q) => [q.id, q]));
  const porBloco = new Map(edital.blocos.map((b) => [b.id, { respondidas: 0, acertos: 0 }]));
  const geral = { respondidas: 0, acertos: 0 };
  let respondidasHoje = 0;
  for (const r of respostas) {
    const q = questaoPorId.get(r.questao_id);
    const b = q && blocoDe.get(q.disciplina_id);
    geral.respondidas += 1;
    if (r.correta) geral.acertos += 1;
    if (b) {
      const d = porBloco.get(b.id)!;
      d.respondidas += 1;
      if (r.correta) d.acertos += 1;
    }
    if (r.respondida_em.slice(0, 10) === hoje) respondidasHoje += 1;
  }
  const disponiveis = (blocoId: string) => questoes.filter((q) => questaoValida(q) && blocoDe.get(q.disciplina_id)?.id === blocoId).length;
  return {
    geral,
    porBloco: edital.blocos.map((bloco) => ({ bloco, desempenho: porBloco.get(bloco.id)!, disponiveis: disponiveis(bloco.id) })),
    respondidasHoje,
  };
}

export const taxa = (d: Desempenho) => (d.respondidas ? d.acertos / d.respondidas : 0);

export type ModoTreino = 'novas' | 'todas' | 'erradas';

export interface FiltroTreino {
  disciplinaId?: string;
  topicoId?: string;
  modo: ModoTreino;
}

/**
 * Monta a fila de treino. "novas" = nunca respondidas; "erradas" = pendentes no
 * caderno de erros; "todas" = todas, com as nunca respondidas primeiro.
 * O filtro de tópico inclui os subtópicos (ace26-ce-08 pega ace26-ce-08-03).
 */
export function montarFila(questoes: Questao[], respostas: Resposta[], caderno: ItemCaderno[], filtro: FiltroTreino, aleatorio = Math.random): Questao[] {
  const respondidas = new Set(respostas.map((r) => r.questao_id));
  const pendentes = new Set(caderno.filter((c) => !c.resolvido).map((c) => c.questao_id));
  const base = questoes.filter(
    (q) =>
      questaoValida(q) &&
      (!filtro.disciplinaId || q.disciplina_id === filtro.disciplinaId) &&
      (!filtro.topicoId || q.topico_id === filtro.topicoId || q.topico_id?.startsWith(`${filtro.topicoId}-`)),
  );
  if (filtro.modo === 'novas') return embaralhar(base.filter((q) => !respondidas.has(q.id)), aleatorio);
  if (filtro.modo === 'erradas') return embaralhar(base.filter((q) => pendentes.has(q.id)), aleatorio);
  const [novas, vistas] = [base.filter((q) => !respondidas.has(q.id)), base.filter((q) => respondidas.has(q.id))];
  return [...embaralhar(novas, aleatorio), ...embaralhar(vistas, aleatorio)];
}
