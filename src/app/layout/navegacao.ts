import { BookOpenCheck, CalendarClock, House, Settings, type LucideIcon } from 'lucide-react';

export interface ItemNav {
  para: string;
  rotulo: string;
  icone: LucideIcon;
}

export const NAVEGACAO: ItemNav[] = [
  { para: '/', rotulo: 'Início', icone: House },
  { para: '/edital', rotulo: 'Edital', icone: BookOpenCheck },
  { para: '/concurso', rotulo: 'Concurso', icone: CalendarClock },
  { para: '/ajustes', rotulo: 'Ajustes', icone: Settings },
];
