import type { Edital, Topico } from '@/features/edital/tipos';

const PARADAS = new Set(
  'para pela pelo pelos pelas como sobre entre quando qual quais deve devem seus suas sendo será assim mais menos todos todas cada este esta esse essa isso aquele aquela segundo acordo forma ações saúde'.split(' '),
);
const palavras = (s: string) =>
  new Set(
    s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().split(/[^\p{L}]+/u).filter((p) => p.length > 4 && !PARADAS.has(p)),
  );

/** Sugere a disciplina a partir do cabeçalho de seção da prova. */
export function disciplinaPorSecao(secao: string | null, edital: Edital): string | null {
  if (!secao) return null;
  const s = secao.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const sigla = /portugu/.test(s) ? 'PT' : /espec/.test(s) ? 'CE' : /munic|gerais/.test(s) && !/sus|legisla/.test(s) ? 'MUN' : /legisla|sus|saude publica/.test(s) ? 'SUS' : null;
  return edital.disciplinas.find((d) => d.sigla === sigla)?.id ?? null;
}

/** Sugere o tópico do edital com mais palavras em comum com a questão (ou nenhum). */
export function sugerirTopico(texto: string, disciplinaId: string | null, edital: Edital): Topico | null {
  if (!disciplinaId) return null;
  const alvo = palavras(texto);
  let melhor: { t: Topico; pontos: number } | null = null;
  for (const t of edital.topicos.filter((x) => x.disciplina_id === disciplinaId)) {
    const doTitulo = [...palavras(t.titulo)];
    const comuns = doTitulo.filter((p) => alvo.has(p)).length;
    // Títulos curtos (ex.: "Dengue", "Crase.") e subtópicos são mais específicos: valem mais.
    const pontos = comuns + (comuns > 0 && doTitulo.length <= 2 ? 1 : 0) + (comuns > 0 && t.parent_id ? 0.5 : 0);
    if (comuns > 0 && (!melhor || pontos > melhor.pontos)) melhor = { t, pontos };
  }
  return melhor && melhor.pontos >= 1.5 ? melhor.t : null;
}
