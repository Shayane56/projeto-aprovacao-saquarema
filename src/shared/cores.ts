/** Classes completas (o Tailwind precisa encontrá-las escritas no código). */
const CORES = {
  blue: { barra: 'bg-blue-500', chip: 'bg-blue-500/15 text-blue-700 dark:text-blue-300', ponto: 'bg-blue-500' },
  violet: { barra: 'bg-violet-500', chip: 'bg-violet-500/15 text-violet-700 dark:text-violet-300', ponto: 'bg-violet-500' },
  teal: { barra: 'bg-teal-500', chip: 'bg-teal-500/15 text-teal-700 dark:text-teal-300', ponto: 'bg-teal-500' },
  amber: { barra: 'bg-amber-500', chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', ponto: 'bg-amber-500' },
} as const;

export type CorDisciplina = keyof typeof CORES;
export const corDe = (cor: string) => CORES[(cor in CORES ? cor : 'blue') as CorDisciplina];
