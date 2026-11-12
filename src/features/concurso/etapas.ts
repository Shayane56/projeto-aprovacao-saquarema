import { diasEntre } from '@/lib/datas';
import type { Etapa, SituacaoEtapa } from './tipos';

export interface EtapaComSituacao extends Etapa {
  situacao: SituacaoEtapa;
  /** Dias até o início (negativo = já começou). */
  diasParaInicio: number | null;
  /** Dias até o fim (ou até o início, se for um dia só). */
  diasParaFim: number | null;
}

const DIAS_PROXIMA = 14;

export function situacaoDaEtapa(e: Etapa, hoje: string): EtapaComSituacao {
  if (!e.data_inicio) return { ...e, situacao: 'sem_data', diasParaInicio: null, diasParaFim: null };
  const fim = e.data_fim ?? e.data_inicio;
  const diasParaInicio = diasEntre(hoje, e.data_inicio);
  const diasParaFim = diasEntre(hoje, fim);
  let situacao: SituacaoEtapa;
  if (diasParaFim < 0) situacao = 'encerrada';
  else if (diasParaInicio <= 0 && e.data_fim && diasParaFim >= 0) situacao = diasParaInicio === 0 && diasParaFim === 0 ? 'hoje' : 'em_andamento';
  else if (diasParaInicio === 0) situacao = 'hoje';
  else if (diasParaInicio <= DIAS_PROXIMA) situacao = 'proxima';
  else situacao = 'futura';
  return { ...e, situacao, diasParaInicio, diasParaFim };
}

export function classificarEtapas(etapas: Etapa[], hoje: string): EtapaComSituacao[] {
  return [...etapas].sort((a, b) => a.ordem - b.ordem).map((e) => situacaoDaEtapa(e, hoje));
}

/** Próximos prazos relevantes: em andamento ou futuros, priorizando os que pedem ação. */
export function proximosPrazos(etapas: EtapaComSituacao[], concluidas: Set<string>, limite = 3): EtapaComSituacao[] {
  return etapas
    .filter((e) => e.situacao !== 'encerrada' && e.situacao !== 'sem_data')
    .filter((e) => !(e.acao && concluidas.has(e.id)))
    .sort((a, b) => (a.diasParaInicio ?? 0) - (b.diasParaInicio ?? 0))
    .slice(0, limite);
}

export function descreverPrazo(e: EtapaComSituacao): string {
  if (e.situacao === 'sem_data') return 'Data a definir';
  if (e.situacao === 'encerrada') return 'Encerrado';
  if (e.situacao === 'hoje') return 'É hoje';
  if (e.situacao === 'em_andamento') {
    const d = e.diasParaFim ?? 0;
    return d === 0 ? 'Termina hoje' : d === 1 ? 'Termina amanhã' : `Termina em ${d} dias`;
  }
  const d = e.diasParaInicio ?? 0;
  return d === 1 ? 'Amanhã' : `Em ${d} dias`;
}
