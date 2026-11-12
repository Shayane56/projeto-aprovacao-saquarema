import { useEffect, useState } from 'react';
import { registrarServiceWorker } from '@/app/pwa';
import { Botao } from '@/shared/ui';

/** Mostra "Nova versão disponível" quando o app é atualizado. */
export function AvisoAtualizacao() {
  const [atualizar, setAtualizar] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => registrarServiceWorker((fn) => setAtualizar(() => fn)), []);

  if (!atualizar) return null;
  return (
    <div className="fixed inset-x-3 bottom-24 z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-borda bg-superficie p-3 pl-4 shadow-cartao lg:bottom-6" role="status">
      <span className="text-sm font-medium">Nova versão disponível.</span>
      <div className="flex gap-2">
        <Botao pequeno variante="fantasma" onClick={() => setAtualizar(null)}>Depois</Botao>
        <Botao pequeno onClick={() => void atualizar()}>Atualizar</Botao>
      </div>
    </div>
  );
}
