import { pesoDoStatus, type BlocoProva, type Disciplina, type Edital, type MapaProgresso, type StatusTopico, type Topico } from './tipos';

/**
 * Regras de cálculo do progresso:
 * - Cada status vale: não iniciado 0 · estudando 1/3 · revisando 2/3 · dominado 1.
 * - Item com subitens vale a média dos subitens.
 * - Disciplina = média dos itens do edital (cada item numerado pesa igual).
 * - Bloco = média de todos os itens das disciplinas do bloco.
 * - Geral = média dos blocos ponderada pelos PONTOS de cada bloco na prova
 *   (Específicos 60, Português 20, SUS + Município 10).
 */

export interface IndiceEdital {
  raiz: Map<string, Topico[]>; // disciplina_id → itens de 1º nível
  filhos: Map<string, Topico[]>; // topico_id → subitens
}

export function indexar(topicos: Topico[]): IndiceEdital {
  const raiz = new Map<string, Topico[]>();
  const filhos = new Map<string, Topico[]>();
  const ordenar = (a: Topico, b: Topico) => a.ordem - b.ordem;
  for (const t of topicos) {
    const mapa = t.parent_id ? filhos : raiz;
    const chave = t.parent_id ?? t.disciplina_id;
    const lista = mapa.get(chave) ?? [];
    lista.push(t);
    mapa.set(chave, lista);
  }
  for (const lista of [...raiz.values(), ...filhos.values()]) lista.sort(ordenar);
  return { raiz, filhos };
}

export const statusDe = (progresso: MapaProgresso, id: string): StatusTopico => progresso[id] ?? 'nao_iniciado';

export function conclusaoTopico(t: Topico, indice: IndiceEdital, progresso: MapaProgresso): number {
  const subitens = indice.filhos.get(t.id);
  if (subitens?.length) return media(subitens.map((s) => pesoDoStatus(statusDe(progresso, s.id))));
  return pesoDoStatus(statusDe(progresso, t.id));
}

export function conclusaoDisciplina(d: Disciplina, indice: IndiceEdital, progresso: MapaProgresso): number {
  return media((indice.raiz.get(d.id) ?? []).map((t) => conclusaoTopico(t, indice, progresso)));
}

export function conclusaoBloco(b: BlocoProva, edital: Edital, indice: IndiceEdital, progresso: MapaProgresso): number {
  const itens = edital.disciplinas.filter((d) => d.bloco_id === b.id).flatMap((d) => indice.raiz.get(d.id) ?? []);
  return media(itens.map((t) => conclusaoTopico(t, indice, progresso)));
}

export const pontosDoBloco = (b: BlocoProva): number => b.num_questoes * b.valor_questao;

export interface ResumoProgresso {
  geral: number; // 0..1 ponderado pelos pontos
  porBloco: { bloco: BlocoProva; pontos: number; conclusao: number; pontosAFazer: number }[];
  porDisciplina: { disciplina: Disciplina; conclusao: number; itens: number }[];
  contagem: Record<StatusTopico, number>; // por tópico "estudável" (folhas)
  totalEstudavel: number;
}

export function resumir(edital: Edital, progresso: MapaProgresso): ResumoProgresso {
  const indice = indexar(edital.topicos);
  const porBloco = edital.blocos.map((bloco) => {
    const pontos = pontosDoBloco(bloco);
    const conclusao = conclusaoBloco(bloco, edital, indice, progresso);
    return { bloco, pontos, conclusao, pontosAFazer: pontos * (1 - conclusao) };
  });
  const totalPontos = porBloco.reduce((s, b) => s + b.pontos, 0);
  const geral = totalPontos ? porBloco.reduce((s, b) => s + b.pontos * b.conclusao, 0) / totalPontos : 0;

  const folhas = edital.topicos.filter((t) => !indice.filhos.has(t.id));
  const contagem: Record<StatusTopico, number> = { nao_iniciado: 0, estudando: 0, revisando: 0, dominado: 0 };
  for (const f of folhas) contagem[statusDe(progresso, f.id)] += 1;

  return {
    geral,
    porBloco,
    porDisciplina: edital.disciplinas.map((disciplina) => ({
      disciplina,
      conclusao: conclusaoDisciplina(disciplina, indice, progresso),
      itens: indice.raiz.get(disciplina.id)?.length ?? 0,
    })),
    contagem,
    totalEstudavel: folhas.length,
  };
}

/** Bloco onde ainda há mais pontos "em aberto" — sugestão de foco. */
export function blocoPrioritario(resumo: ResumoProgresso) {
  return [...resumo.porBloco].sort((a, b) => b.pontosAFazer - a.pontosAFazer)[0];
}

function media(valores: number[]): number {
  return valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : 0;
}

export const pct = (v: number): number => Math.round(v * 100);
