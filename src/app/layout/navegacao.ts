import { BarChart3, BookOpenCheck, CalendarCheck, CalendarClock, FolderOpen, House, PencilLine, Settings, type LucideIcon } from 'lucide-react';

export interface ItemNav {
  para: string;
  rotulo: string;
  icone: LucideIcon;
  /** false = só na barra lateral do computador (no celular, acessível pelo Início e pelo Plano). */
  noCelular?: boolean;
}

export const NAVEGACAO: ItemNav[] = [
  { para: '/', rotulo: 'Início', icone: House },
  { para: '/plano', rotulo: 'Plano', icone: CalendarCheck },
  { para: '/edital', rotulo: 'Edital', icone: BookOpenCheck },
  { para: '/materiais', rotulo: 'Materiais', icone: FolderOpen, noCelular: false },
  { para: '/praticar', rotulo: 'Praticar', icone: PencilLine },
  { para: '/estatisticas', rotulo: 'Estatísticas', icone: BarChart3, noCelular: false },
  { para: '/concurso', rotulo: 'Concurso', icone: CalendarClock, noCelular: false },
  { para: '/ajustes', rotulo: 'Ajustes', icone: Settings },
];
