/**
 * Gerador do plano de estudos até a prova (função pura, determinística).
 *
 * Ideia: cada tópico "estudável" do edital (item sem subitens, ou subitem) vira
 * tarefas de TEORIA e QUESTÕES, conforme o status marcado no edital. As tarefas
 * entram numa fila por bloco da prova, ordenadas por prioridade:
 *   pontos do tópico na prova × quanto falta estudar × reforço se o acerto está baixo.
 * Cada dia recebe, nesta ordem: flashcards → simulado semanal (rápido; completo nas 6 últimas semanas) →
 * caderno de erros (a cada 3 dias) → revisão dos tópicos estudados há 7 dias →
 * tarefas novas, alternando os blocos na proporção CE 55% · PT 27% · SUS/Mun. 18%.
 * A última semana é só de revisão e simulados; a véspera é leve.
 * O plano é recalculado sempre a partir do estado atual — nada fica "atrasado".
 */
import { diasEntre } from '@/lib/datas';
import type { Edital, MapaProgresso, StatusTopico, Topico } from '@/features/edital/tipos';
import type { PreferenciasEstudo } from '@/features/perfil/preferencias';

export type TipoSessao = 'teoria' | 'questoes' | 'revisao' | 'flashcards' | 'simulado' | 'erros';
export type FaseDia = 'estudo' | 'revisao_final' | 'vespera' | 'prova' | 'folga';

export interface SessaoPlano {
  chave: string;
  tipo: TipoSessao;
  titulo: string;
  detalhe: string;
  minutos: number;
  disciplina_id: string | null;
  topico_id: string | null;
  link: string;
}

export interface DiaPlano {
  data: string;
  diaSemana: number;
  fase: FaseDia;
  minutosDisponiveis: number;
  sessoes: SessaoPlano[];
}

export interface Plano {
  dias: DiaPlano[];
  /** Tarefas de estudo que não couberam antes da semana final. */
  pendentes: { topico_id: string; titulo: string; minutos: number }[];
  minutosPendentes: number;
  /** Último dia com teoria nova planejada. */
  fimDaTeoria: string | null;
  minutosPlanejados: number;
}

export interface Desempenho {
  respondidas: number;
  acertos: number;
}

export interface EntradaPlano {
  edital: Edital;
  progresso: MapaProgresso;
  /** topico_id → desempenho (já agregado: o item inclui seus subitens) */
  desempenho: Map<string, Desempenho>;
  /** topico_id → questões disponíveis (o item inclui seus subitens) */
  questoesPorTopico: Map<string, number>;
  hoje: string;
  dataProva: string;
  prefs: PreferenciasEstudo;
}

const PARTICIPACAO: Record<string, number> = { 'ace26-bloco-ce': 0.55, 'ace26-bloco-pt': 0.27, 'ace26-bloco-sm': 0.18 };
const SESSAO_MIN = 15;

const MINUTOS: Record<'item' | 'subitem', Record<StatusTopico, { teoria: number; questoes: number }>> = {
  item: { nao_iniciado: { teoria: 50, questoes: 30 }, estudando: { teoria: 30, questoes: 30 }, revisando: { teoria: 0, questoes: 25 }, dominado: { teoria: 0, questoes: 0 } },
  subitem: { nao_iniciado: { teoria: 25, questoes: 15 }, estudando: { teoria: 15, questoes: 15 }, revisando: { teoria: 0, questoes: 15 }, dominado: { teoria: 0, questoes: 0 } },
};
const RESTANTE: Record<StatusTopico, number> = { nao_iniciado: 1, estudando: 2 / 3, revisando: 1 / 3, dominado: 0 };

interface Tarefa {
  tipo: 'teoria' | 'questoes' | 'revisao';
  topico: Topico;
  titulo: string;
  minutos: number;
  prioridade: number;
  blocoId: string;
}

export function somarDias(data: string, n: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const diaDaSemana = (data: string) => new Date(`${data}T12:00:00Z`).getUTCDay();
const encurtar = (s: string, n = 70) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const tituloDe = (t: Topico, pai?: Topico) => (pai ? `${pai.numero}. ${encurtar(pai.titulo, 28)} → ${t.titulo}` : `${t.numero}. ${encurtar(t.titulo)}`);

function linkQuestoes(t: Topico) {
  return `/praticar/questoes?disciplina=${t.disciplina_id}&topico=${t.id}&modo=todas`;
}

/** Tarefas de estudo (teoria/questões) de todos os tópicos, por bloco, em ordem de prioridade. */
export function montarTarefas(e: EntradaPlano): Map<string, Tarefa[]> {
  const { edital, progresso } = e;
  const filhos = new Map<string, Topico[]>();
  for (const t of edital.topicos) if (t.parent_id) filhos.set(t.parent_id, [...(filhos.get(t.parent_id) ?? []), t]);
  const porId = new Map(edital.topicos.map((t) => [t.id, t]));
  const blocoDe = new Map(edital.disciplinas.map((d) => [d.id, d.bloco_id]));
  const pontosBloco = new Map(edital.blocos.map((b) => [b.id, b.num_questoes * b.valor_questao]));
  const itensPorBloco = new Map<string, number>();
  for (const t of edital.topicos) if (!t.parent_id) itensPorBloco.set(blocoDe.get(t.disciplina_id)!, (itensPorBloco.get(blocoDe.get(t.disciplina_id)!) ?? 0) + 1);

  const filas = new Map<string, Tarefa[]>(edital.blocos.map((b) => [b.id, []]));
  for (const t of edital.topicos) {
    if (filhos.has(t.id)) continue; // itens com subitens são estudados pelos subitens
    const pai = t.parent_id ? porId.get(t.parent_id) : undefined;
    const blocoId = blocoDe.get(t.disciplina_id)!;
    const pontosItem = pontosBloco.get(blocoId)! / itensPorBloco.get(blocoId)!;
    const peso = pai ? pontosItem / filhos.get(pai.id)!.length : pontosItem;
    const status = progresso[t.id] ?? 'nao_iniciado';
    const base = MINUTOS[pai ? 'subitem' : 'item'][status];
    const d = e.desempenho.get(t.id);
    const fraco = Boolean(d && d.respondidas >= 3 && d.acertos / d.respondidas < 0.6);
    const extra = fraco ? (pai ? 15 : 25) : 0;
    const prioridade = peso * Math.max(RESTANTE[status], fraco ? 0.5 : 0) * (fraco ? 1.5 : 1);
    const temQuestoes = (e.questoesPorTopico.get(t.id) ?? 0) > 0;
    const titulo = tituloDe(t, pai);
    const fila = filas.get(blocoId)!;
    if (base.teoria) fila.push({ tipo: 'teoria', topico: t, titulo, minutos: base.teoria, prioridade, blocoId });
    const min = base.questoes + extra;
    if (min) fila.push({ tipo: temQuestoes ? 'questoes' : 'revisao', topico: t, titulo, minutos: min, prioridade, blocoId });
  }
  for (const fila of filas.values()) fila.sort((a, b) => b.prioridade - a.prioridade); // sort estável: teoria antes de questões
  return filas;
}

export function gerarPlano(e: EntradaPlano): Plano {
  const totalDias = diasEntre(e.hoje, e.dataProva);
  const filas = montarTarefas(e);
  const blocos = [...e.edital.blocos].sort((a, b) => a.ordem - b.ordem);
  const disciplinaDoBloco = new Map(e.edital.disciplinas.map((d) => [d.bloco_id, d.id]));
  const usados = new Map(blocos.map((b) => [b.id, 0]));
  const estudadosEm = new Map<string, Tarefa[]>(); // data → teorias planejadas (para revisão em +7 dias)
  const dias: DiaPlano[] = [];
  let fimDaTeoria: string | null = null;
  let minutosPlanejados = 0;

  if (totalDias < 0) return { dias: [], pendentes: [], minutosPendentes: 0, fimDaTeoria: null, minutosPlanejados: 0 };

  for (let i = 0; i <= totalDias; i++) {
    const data = somarDias(e.hoje, i);
    const ds = diaDaSemana(data);
    const faltam = totalDias - i;
    const disponivel = e.prefs.minutosPorDia[ds] ?? 0;
    const sessoes: SessaoPlano[] = [];
    let resta = disponivel;
    const add = (s: Omit<SessaoPlano, 'chave'> & { ref?: string }) => {
      const { ref, ...sessao } = s;
      sessoes.push({ ...sessao, chave: `${data}|${s.tipo}|${ref ?? s.topico_id ?? 'geral'}` });
      resta -= s.minutos;
    };

    let fase: FaseDia = faltam === 0 ? 'prova' : faltam === 1 ? 'vespera' : faltam <= 7 ? 'revisao_final' : 'estudo';
    if (fase === 'prova') {
      add({ tipo: 'simulado', titulo: 'Dia da prova', detalhe: 'Portão abre 14h00 e fecha 15h00 · início 15h10 · leve documento com foto e caneta preta', minutos: 0, disciplina_id: null, topico_id: null, link: '/concurso', ref: 'prova' });
      dias.push({ data, diaSemana: ds, fase, minutosDisponiveis: disponivel, sessoes });
      break;
    }
    if (disponivel < SESSAO_MIN) {
      dias.push({ data, diaSemana: ds, fase: 'folga', minutosDisponiveis: disponivel, sessoes });
      continue;
    }

    const flash = Math.min(resta, fase === 'estudo' ? (disponivel >= 45 ? 15 : 10) : 20);
    add({ tipo: 'flashcards', titulo: 'Flashcards do dia', detalhe: 'Revisão espaçada: cartões vencidos e novos', minutos: flash, disciplina_id: null, topico_id: null, link: '/flashcards/estudar' });

    if (fase === 'vespera') {
      if (resta >= SESSAO_MIN) add({ tipo: 'revisao', titulo: 'Revisão leve', detalhe: 'Releia anotações e o caderno de erros. Confira local, horário e documentos. Durma cedo.', minutos: Math.min(resta, 40), disciplina_id: null, topico_id: null, link: '/praticar/erros', ref: 'vespera' });
      dias.push({ data, diaSemana: ds, fase, minutosDisponiveis: disponivel, sessoes });
      minutosPlanejados += sessoes.reduce((s, x) => s + x.minutos, 0);
      continue;
    }

    // Simulado semanal no dia escolhido: rápido até 6 semanas antes da prova, completo (se couber) depois.
    // Na semana final, também um rápido 3 dias antes.
    const diaSimulado = ds === e.prefs.diaSimulado;
    if (diaSimulado || (fase === 'revisao_final' && faltam === 3)) {
      if (diaSimulado && faltam <= 42 && resta >= 180) add({ tipo: 'simulado', titulo: 'Simulado completo', detalhe: '40 questões em 3h, no ritmo da prova', minutos: 180, disciplina_id: null, topico_id: null, link: '/praticar/simulados', ref: 'completo' });
      else if (resta >= 45) add({ tipo: 'simulado', titulo: 'Simulado rápido', detalhe: '10 questões em 45 min', minutos: 45, disciplina_id: null, topico_id: null, link: '/praticar/simulados', ref: 'rapido' });
    }

    if ((fase === 'revisao_final' || i % 3 === 0) && resta >= 35) {
      add({ tipo: 'erros', titulo: 'Caderno de erros', detalhe: 'Refaça as questões pendentes e anote o motivo', minutos: fase === 'revisao_final' ? 30 : 20, disciplina_id: null, topico_id: null, link: '/praticar/erros' });
    }

    if (fase === 'estudo') {
      // Revisão dos tópicos cuja teoria foi planejada há 7 dias.
      for (const t of estudadosEm.get(somarDias(data, -7)) ?? []) {
        if (resta < SESSAO_MIN) break;
        add({ tipo: 'revisao', titulo: `Revisão: ${t.titulo}`, detalhe: 'Revisão de 7 dias: releia o resumo e resolva questões do tópico', minutos: SESSAO_MIN, disciplina_id: t.topico.disciplina_id, topico_id: t.topico.id, link: linkQuestoes(t.topico) });
      }
      // Tarefas novas, alternando blocos pela participação-alvo.
      const teoriasHoje: Tarefa[] = [];
      for (;;) {
        if (resta < SESSAO_MIN) break;
        const candidatos = blocos.filter((b) => (filas.get(b.id) ?? []).some((t) => t.minutos <= resta));
        if (!candidatos.length) break;
        const pesoTotal = candidatos.reduce((s, b) => s + PARTICIPACAO[b.id], 0);
        const usadoTotal = candidatos.reduce((s, b) => s + usados.get(b.id)!, 0) + 1;
        const escolhido = candidatos.sort((a, b) => usados.get(a.id)! / usadoTotal - PARTICIPACAO[a.id] / pesoTotal - (usados.get(b.id)! / usadoTotal - PARTICIPACAO[b.id] / pesoTotal))[0];
        const fila = filas.get(escolhido.id)!;
        const idx = fila.findIndex((t) => t.minutos <= resta);
        const [t] = fila.splice(idx, 1);
        usados.set(escolhido.id, usados.get(escolhido.id)! + t.minutos);
        add({
          tipo: t.tipo,
          titulo: t.titulo,
          detalhe: t.tipo === 'teoria' ? 'Estude a teoria e marque o status no edital' : t.tipo === 'questoes' ? 'Resolva questões do tópico e revise os erros' : 'Revise o conteúdo (ainda não há questões deste tópico no banco)',
          minutos: t.minutos,
          disciplina_id: t.topico.disciplina_id,
          topico_id: t.topico.id,
          link: t.tipo === 'teoria' ? `/edital?disciplina=${t.topico.disciplina_id}` : linkQuestoes(t.topico),
          ref: `${t.topico.id}`,
        });
        if (t.tipo === 'teoria') { teoriasHoje.push(t); fimDaTeoria = data; }
      }
      estudadosEm.set(data, teoriasHoje);
    } else {
      // Semana final: revisão por bloco, alternando.
      let k = i;
      while (resta >= 20) {
        const b = blocos[k++ % blocos.length];
        const min = Math.min(resta, 30);
        add({ tipo: 'revisao', titulo: `Revisão geral: ${b.nome}`, detalhe: 'Questões variadas do bloco e releitura dos pontos fracos', minutos: min, disciplina_id: disciplinaDoBloco.get(b.id) ?? null, topico_id: null, link: `/praticar/questoes?disciplina=${disciplinaDoBloco.get(b.id) ?? ''}&modo=todas`, ref: `${b.id}-${k}` });
      }
      fase = 'revisao_final';
    }

    minutosPlanejados += sessoes.reduce((s, x) => s + x.minutos, 0);
    dias.push({ data, diaSemana: ds, fase, minutosDisponiveis: disponivel, sessoes });
  }

  const pendentes = [...filas.values()].flat().map((t) => ({ topico_id: t.topico.id, titulo: t.titulo, minutos: t.minutos }));
  return { dias, pendentes, minutosPendentes: pendentes.reduce((s, p) => s + p.minutos, 0), fimDaTeoria, minutosPlanejados };
}
