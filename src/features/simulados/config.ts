export type TipoSimulado = 'completo' | 'rapido';

export interface ConfigSimulado {
  tipo: TipoSimulado;
  nome: string;
  descricao: string;
  /** Questões por bloco, na ordem dos blocos do edital (CE, PT, SUS+Município). */
  porBloco: Record<string, number>;
  duracaoMin: number;
}

export const SIMULADOS: ConfigSimulado[] = [
  {
    tipo: 'completo',
    nome: 'Simulado completo',
    descricao: '40 questões em 3 horas, como na prova do IBAM.',
    porBloco: { 'ace26-bloco-ce': 20, 'ace26-bloco-pt': 10, 'ace26-bloco-sm': 10 },
    duracaoMin: 180,
  },
  {
    tipo: 'rapido',
    nome: 'Simulado rápido',
    descricao: '10 questões em 45 minutos, mesmo ritmo e mesmos pesos.',
    porBloco: { 'ace26-bloco-ce': 5, 'ace26-bloco-pt': 3, 'ace26-bloco-sm': 2 },
    duracaoMin: 45,
  },
];

export const configDe = (tipo: TipoSimulado) => SIMULADOS.find((s) => s.tipo === tipo)!;
