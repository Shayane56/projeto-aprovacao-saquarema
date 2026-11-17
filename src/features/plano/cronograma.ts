/**
 * Cronograma firmado e recuperação de atrasos (funções puras).
 *
 * - Os próximos dias do plano ficam guardados ("firmados"). O que passou do dia
 *   sem ser concluído vira ATRASO, com a data de origem.
 * - Nem tudo vira atraso: flashcards e caderno de erros são contínuos; simulado
 *   perdido conta só o mais recente; tópico marcado como dominado dispensa as
 *   tarefas dele; revisão de um tópico que nunca foi estudado não conta.
 * - A recuperação usa a margem reservada em cada dia de estudo, na ordem:
 *   o que vale mais na prova → teoria antes de questões → o mais antigo.
 */
import type { MapaProgresso } from '@/features/edital/tipos';
import { dataLocal, diasEntre } from '@/lib/datas';
import { chaveTarefa, ehRevisaoDeSeteDias, somarDias, type DiaPlano, type SessaoPlano, type TipoSessao } from './gerador';

/** Dias à frente que ficam firmados (incluindo hoje). */
export const JANELA_FIRMADA = 7;
/** Acima disso (minutos), o atraso merece atenção mesmo que dê para zerar. */
export const LIMITE_ATENCAO_MIN = 360;
/** Simulado perdido há mais tempo que isso não é mais recuperado. */
const VALIDADE_SIMULADO_DIAS = 7;
/** Peso de um simulado na fila de recuperação (equivale a um item de peso médio). */
const PESO_SIMULADO = 2;
const ORDEM_TIPO: Partial<Record<TipoSessao, number>> = { teoria: 0, questoes: 1, revisao: 2, simulado: 3 };

export interface DiaFirmado {
  data: string;
  sessoes: SessaoPlano[];
}

export interface Concluida {
  chave: string;
  data: string;
  tipo: TipoSessao;
  topico_id: string | null;
  minutos: number;
  concluida_em: string;
}

export interface TarefaAtrasada {
  sessao: SessaoPlano;
  /** Dia em que a tarefa estava prevista. */
  origem: string;
  /** Peso do tópico na prova (para priorizar). */
  peso: number;
}

export type StatusAtraso = 'em_dia' | 'leve' | 'atencao';

export interface DiaRecuperacao {
  data: string;
  tarefas: TarefaAtrasada[];
  minutos: number;
  /** Minutos reservados no dia (a recuperação pode passar um pouco, se a tarefa for maior). */
  margem: number;
}

export interface Recuperacao {
  status: StatusAtraso;
  atrasos: TarefaAtrasada[];
  minutosPendentes: number;
  /** Concluídas depois do dia previsto. */
  recuperadas: { quantidade: number; minutos: number };
  /** Distribuição dos atrasos nos próximos dias de estudo, a partir de hoje. */
  plano: DiaRecuperacao[];
  /** Tarefas de recuperação de hoje. */
  hoje: TarefaAtrasada[];
  /** Último dia com recuperação: depois dele, tudo em dia. null = não cabe antes da semana final. */
  previsao: string | null;
  /** Tarefas que não cabem nas margens antes da semana final. */
  naoCabem: TarefaAtrasada[];
  /** Primeiro dia da semana final (sem recuperação). */
  inicioSemanaFinal: string;
}

/** A tarefa não precisa mais ser feita por causa do que já foi marcado no edital. */
export function dispensada(s: Pick<SessaoPlano, 'tipo' | 'topico_id' | 'titulo'>, progresso: MapaProgresso): boolean {
  if (!s.topico_id) return false;
  const status = progresso[s.topico_id] ?? 'nao_iniciado';
  if (status === 'dominado') return true;
  if (s.tipo === 'teoria' && status === 'revisando') return true; // a teoria já foi estudada
  if (ehRevisaoDeSeteDias(s) && status === 'nao_iniciado') return true; // revisão de 7 dias só do que foi estudado
  return false;
}

/** Tarefas firmadas em dias anteriores a hoje que ainda não foram feitas, por ordem de prioridade. */
export function calcularAtrasos(entrada: {
  firmados: DiaFirmado[];
  concluidas: Concluida[];
  progresso: MapaProgresso;
  pesos: Map<string, number>;
  hoje: string;
}): TarefaAtrasada[] {
  const { firmados, concluidas, progresso, pesos, hoje } = entrada;
  const feitas = new Set(concluidas.map((c) => c.chave));
  // Tarefa do tópico feita em outro dia também resolve o atraso.
  const feitasPorTarefa = new Set(concluidas.filter((c) => c.topico_id).map((c) => chaveTarefa(c.tipo, c.topico_id!)));
  const porTarefa = new Map<string, TarefaAtrasada>();
  let simulado: TarefaAtrasada | null = null;

  for (const dia of [...firmados].sort((a, b) => a.data.localeCompare(b.data))) {
    if (dia.data >= hoje) continue;
    for (const s of dia.sessoes) {
      if (s.minutos <= 0 || feitas.has(s.chave)) continue;
      if (s.tipo === 'simulado') {
        if (diasEntre(dia.data, hoje) <= VALIDADE_SIMULADO_DIAS) simulado = { sessao: s, origem: dia.data, peso: PESO_SIMULADO };
        continue;
      }
      if (!(s.tipo in ORDEM_TIPO) || !s.topico_id || dispensada(s, progresso)) continue;
      const k = chaveTarefa(s.tipo, s.topico_id);
      if (feitasPorTarefa.has(k) || porTarefa.has(k)) continue; // feita em outro dia, ou já contada (fica a mais antiga)
      porTarefa.set(k, { sessao: s, origem: dia.data, peso: pesos.get(s.topico_id) ?? 0 });
    }
  }
  // Simulado: só o mais recente, e se nenhum simulado foi feito depois dele.
  if (simulado && concluidas.some((c) => c.tipo === 'simulado' && c.data >= simulado!.origem)) simulado = null;

  const lista = [...porTarefa.values(), ...(simulado ? [simulado] : [])];
  return lista.sort(
    (a, b) => b.peso - a.peso || (ORDEM_TIPO[a.sessao.tipo] ?? 9) - (ORDEM_TIPO[b.sessao.tipo] ?? 9) || a.origem.localeCompare(b.origem),
  );
}

/** Sessões de dias firmados anteriores concluídas depois do dia previsto. */
export function calcularRecuperadas(firmados: DiaFirmado[], concluidas: Concluida[], hoje: string): { quantidade: number; minutos: number } {
  const passadas = new Set(firmados.filter((d) => d.data < hoje).flatMap((d) => d.sessoes.map((s) => s.chave)));
  let quantidade = 0;
  let minutos = 0;
  for (const c of concluidas) {
    if (!passadas.has(c.chave) || !c.concluida_em) continue;
    if (dataLocal(new Date(c.concluida_em)) > c.data) {
      quantidade++;
      minutos += c.minutos;
    }
  }
  return { quantidade, minutos };
}

/**
 * Distribui os atrasos nas margens dos próximos dias de estudo (a partir de hoje).
 * `puxadas`: tarefas que a pessoa escolheu encaixar hoje (entram hoje mesmo além da margem).
 * Um dia sem nenhuma recuperação aceita uma tarefa maior que a margem, para não travar a fila.
 */
export function planejarRecuperacao(entrada: {
  atrasos: TarefaAtrasada[];
  dias: DiaPlano[];
  hoje: string;
  dataProva: string;
  puxadas?: Set<string>;
  firmados: DiaFirmado[];
  concluidas: Concluida[];
}): Recuperacao {
  const { atrasos, dias, hoje, dataProva, firmados, concluidas } = entrada;
  const puxadas = entrada.puxadas ?? new Set<string>();
  const inicioSemanaFinal = somarDias(dataProva, -7);
  const fila = [...atrasos].sort((a, b) => Number(puxadas.has(b.sessao.chave)) - Number(puxadas.has(a.sessao.chave)));
  const plano: DiaRecuperacao[] = [];
  let i = 0;

  for (const d of dias) {
    if (i >= fila.length) break;
    if (d.data < hoje || d.data >= inicioSemanaFinal || d.fase !== 'estudo' || d.margem <= 0) continue;
    const tarefas: TarefaAtrasada[] = [];
    let naMargem = 0; // minutos usados da margem (as puxadas para hoje ficam fora dela)
    let normais = 0;
    while (i < fila.length) {
      const t = fila[i];
      const puxadaHoje = d.data === hoje && puxadas.has(t.sessao.chave);
      if (!puxadaHoje) {
        if (normais > 0 && naMargem + t.sessao.minutos > d.margem) break;
        naMargem += t.sessao.minutos;
        normais++;
      }
      tarefas.push(t);
      i++;
    }
    plano.push({ data: d.data, tarefas, minutos: tarefas.reduce((s, t) => s + t.sessao.minutos, 0), margem: d.margem });
  }

  const naoCabem = fila.slice(i);
  const minutosPendentes = atrasos.reduce((t, a) => t + a.sessao.minutos, 0);
  const previsao = !atrasos.length ? hoje : naoCabem.length ? null : plano.at(-1)?.data ?? hoje;
  const status: StatusAtraso = !atrasos.length ? 'em_dia' : previsao === null || minutosPendentes > LIMITE_ATENCAO_MIN ? 'atencao' : 'leve';

  return {
    status,
    atrasos,
    minutosPendentes,
    recuperadas: calcularRecuperadas(firmados, concluidas, hoje),
    plano,
    hoje: plano.find((p) => p.data === hoje)?.tarefas ?? [],
    previsao,
    naoCabem,
    inicioSemanaFinal,
  };
}

/** Dias da janela firmada (de hoje até hoje + JANELA_FIRMADA − 1) que ainda não foram guardados. */
export function diasParaFirmar(plano: DiaPlano[], firmados: DiaFirmado[], hoje: string): DiaFirmado[] {
  const guardados = new Set(firmados.map((d) => d.data));
  const limite = somarDias(hoje, JANELA_FIRMADA - 1);
  return plano
    .filter((d) => d.data >= hoje && d.data <= limite && !guardados.has(d.data) && d.fase !== 'prova')
    .map((d) => ({ data: d.data, sessoes: d.sessoes }));
}
