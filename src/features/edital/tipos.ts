export type StatusTopico = 'nao_iniciado' | 'estudando' | 'revisando' | 'dominado';

export const STATUS: { valor: StatusTopico; rotulo: string; curto: string; peso: number }[] = [
  { valor: 'nao_iniciado', rotulo: 'Não iniciado', curto: 'A estudar', peso: 0 },
  { valor: 'estudando', rotulo: 'Estudando', curto: 'Estudando', peso: 1 / 3 },
  { valor: 'revisando', rotulo: 'Revisando', curto: 'Revisando', peso: 2 / 3 },
  { valor: 'dominado', rotulo: 'Dominado', curto: 'Dominado', peso: 1 },
];

export const pesoDoStatus = (s: StatusTopico): number => STATUS.find((x) => x.valor === s)?.peso ?? 0;
export const rotuloDoStatus = (s: StatusTopico): string => STATUS.find((x) => x.valor === s)?.rotulo ?? s;

export interface Concurso {
  id: string;
  nome: string;
  orgao: string;
  banca: string;
  cargo: string;
  codigo_cargo: string | null;
  vagas: number | null;
  vagas_ac: number | null;
  vagas_pcd: number | null;
  salario: number | null;
  carga_horaria: string | null;
  escolaridade: string | null;
  taxa_inscricao: number | null;
  prova_inicio: string | null;
  portao_abre: string | null;
  portao_fecha: string | null;
  duracao_min: number | null;
  total_questoes: number;
  alternativas: number;
  pontuacao_total: number;
  nota_minima: number;
  link_oficial: string | null;
  regras: RegrasConcurso;
}

export interface RegrasConcurso {
  aprovacao?: string[];
  etapas_selecao?: { etapa: string; descricao: string }[];
  desempate?: string[];
  titulos?: { item: string; pontos: string }[];
  dicas_prova?: string[];
}

export interface BlocoProva {
  id: string;
  nome: string;
  num_questoes: number;
  valor_questao: number;
  ordem: number;
}

export interface Disciplina {
  id: string;
  bloco_id: string;
  nome: string;
  sigla: string;
  cor: string;
  ordem: number;
}

export interface Topico {
  id: string;
  disciplina_id: string;
  parent_id: string | null;
  numero: string;
  titulo: string;
  referencia: string | null;
  link: string | null;
  ordem: number;
}

export interface Edital {
  concurso: Concurso;
  blocos: BlocoProva[];
  disciplinas: Disciplina[];
  topicos: Topico[];
}

/** Mapa topico_id → status (tópicos ausentes = não iniciado). */
export type MapaProgresso = Record<string, StatusTopico>;
