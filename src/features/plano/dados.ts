import type { Edital } from '@/features/edital/tipos';
import { questaoValida, type Questao, type Resposta } from '@/features/questoes/tipos';
import type { Desempenho } from './gerador';

/** Agrega por tópico, somando também os subitens no item pai. */
function agregar(edital: Edital, porTopico: Map<string, Desempenho>): Map<string, Desempenho> {
  const pai = new Map(edital.topicos.filter((t) => t.parent_id).map((t) => [t.id, t.parent_id!]));
  const r = new Map<string, Desempenho>();
  const somar = (id: string, d: Desempenho) => {
    const a = r.get(id) ?? { respondidas: 0, acertos: 0 };
    r.set(id, { respondidas: a.respondidas + d.respondidas, acertos: a.acertos + d.acertos });
  };
  for (const [id, d] of porTopico) {
    somar(id, d);
    const p = pai.get(id);
    if (p) somar(p, d);
  }
  return r;
}

export function desempenhoPorTopico(edital: Edital, questoes: Questao[], respostas: Resposta[]): Map<string, Desempenho> {
  const topicoDe = new Map(questoes.map((q) => [q.id, q.topico_id]));
  const base = new Map<string, Desempenho>();
  for (const r of respostas) {
    const t = topicoDe.get(r.questao_id);
    if (!t) continue;
    const a = base.get(t) ?? { respondidas: 0, acertos: 0 };
    base.set(t, { respondidas: a.respondidas + 1, acertos: a.acertos + (r.correta ? 1 : 0) });
  }
  return agregar(edital, base);
}

export function questoesPorTopico(edital: Edital, questoes: Questao[]): Map<string, number> {
  const base = new Map<string, Desempenho>();
  for (const q of questoes) {
    if (!q.topico_id || !questaoValida(q)) continue;
    const a = base.get(q.topico_id) ?? { respondidas: 0, acertos: 0 };
    base.set(q.topico_id, { respondidas: a.respondidas + 1, acertos: 0 });
  }
  return new Map([...agregar(edital, base)].map(([k, v]) => [k, v.respondidas]));
}
