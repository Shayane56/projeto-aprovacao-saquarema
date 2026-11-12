export type CategoriaEtapa = 'edital' | 'isencao' | 'inscricao' | 'pcd' | 'prova' | 'gabarito' | 'resultado' | 'titulos' | 'formacao';

export interface Etapa {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: CategoriaEtapa;
  data_inicio: string | null;
  data_fim: string | null;
  acao: boolean;
  ordem: number;
}

export type SituacaoEtapa = 'encerrada' | 'em_andamento' | 'hoje' | 'proxima' | 'futura' | 'sem_data';
