import seed from '../../supabase/seed/edital-ace-2026.json';
import type { Etapa } from '@/features/concurso/tipos';
import type { Concurso, Edital, Topico } from '@/features/edital/tipos';

const pad = (n: number) => String(n).padStart(2, '0');

/** Monta o edital a partir do mesmo JSON usado para gerar a migração do banco. */
export function editalDoSeed(): Edital {
  const topicos: Topico[] = [];
  for (const d of seed.disciplinas) {
    d.topicos.forEach((t, i) => {
      const id = `${d.id}-${pad(i + 1)}`;
      const extra = t as { referencia?: string; link?: string; subtopicos?: string[] };
      topicos.push({ id, disciplina_id: d.id, parent_id: null, numero: String(i + 1), titulo: t.titulo, referencia: extra.referencia ?? null, link: extra.link ?? null, ordem: i + 1 });
      (extra.subtopicos ?? []).forEach((s, j) =>
        topicos.push({ id: `${id}-${pad(j + 1)}`, disciplina_id: d.id, parent_id: id, numero: `${i + 1}.${j + 1}`, titulo: s, referencia: null, link: null, ordem: j + 1 }),
      );
    });
  }
  return {
    concurso: seed.concurso as unknown as Concurso,
    blocos: seed.blocos,
    disciplinas: seed.disciplinas.map(({ topicos: _t, ...d }) => d),
    topicos,
  };
}

export function etapasDoSeed(): Etapa[] {
  return seed.etapas.map((e, i) => {
    const x = e as { titulo: string; categoria: string; inicio?: string; fim?: string; acao?: boolean; descricao?: string };
    return {
      id: `ace26-etapa-${pad(i + 1)}`, titulo: x.titulo, descricao: x.descricao ?? null, categoria: x.categoria as Etapa['categoria'],
      data_inicio: x.inicio ?? null, data_fim: x.fim ?? null, acao: x.acao ?? false, ordem: i + 1,
    };
  });
}
