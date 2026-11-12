import { useId } from 'react';
import { cn } from '@/lib/cn';

export function IconeMarca({ className }: { className?: string }) {
  const id = `marca-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563EB" />
          <stop offset="1" stopColor="#1E3A8A" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${id})`} />
      <path d="M32 12 L49 18 V30 C49 41 41.5 48.5 32 52 C22.5 48.5 15 41 15 30 V18 Z" fill="#fff" opacity=".14" />
      <path d="M23.5 32.5 L29.5 38.5 L41.5 25" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Marca({ tamanho = 'normal', className }: { tamanho?: 'normal' | 'grande'; className?: string }) {
  const grande = tamanho === 'grande';
  return (
    <div className={cn('flex items-center gap-2.5', grande && 'flex-col gap-3', className)}>
      <IconeMarca className={grande ? 'h-14 w-14' : 'h-9 w-9'} />
      <div className={cn('leading-tight', grande && 'text-center')}>
        <div className={cn('font-bold tracking-tight', grande ? 'text-2xl' : 'text-[15px]')}>Projeto Aprovação</div>
        <div className={cn('font-medium text-primaria', grande ? 'text-base' : 'text-xs')}>Saquarema · ACE</div>
      </div>
    </div>
  );
}
