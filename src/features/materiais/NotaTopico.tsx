import { Check, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSalvarNota } from './hooks';

/** Anotação de um tópico: salva sozinha 1,5 s depois de parar de digitar (e ao sair do campo). */
export function NotaTopico({ topicoId, inicial, rotulo }: { topicoId: string; inicial: string; rotulo: string }) {
  const { usuario } = useAuth();
  const salvar = useSalvarNota();
  const [texto, setTexto] = useState(inicial);
  const [estado, setEstado] = useState<'salvo' | 'editando' | 'salvando'>('salvo');
  const ultimo = useRef(inicial);
  const timer = useRef<number | undefined>(undefined);

  const gravar = (valor: string) => {
    window.clearTimeout(timer.current);
    if (!usuario || valor === ultimo.current) return setEstado('salvo');
    ultimo.current = valor;
    setEstado('salvando');
    salvar.mutate({ userId: usuario.id, topicoId, conteudo: valor }, { onSettled: () => setEstado('salvo') });
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div className="space-y-1.5">
      <textarea
        className="campo min-h-[96px] text-sm"
        value={texto}
        aria-label={`Anotação: ${rotulo}`}
        placeholder="Resumo, macetes, artigos de lei, o que você não pode esquecer…"
        onChange={(e) => {
          setTexto(e.target.value);
          setEstado('editando');
          window.clearTimeout(timer.current);
          const valor = e.target.value;
          timer.current = window.setTimeout(() => gravar(valor), 1500);
        }}
        onBlur={() => gravar(texto)}
      />
      <p className="flex items-center gap-1 text-[11px] text-suave" aria-live="polite">
        {estado === 'salvando' ? <><Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Salvando…</> : estado === 'editando' ? 'Editando…' : <><Check className="h-3 w-3" aria-hidden /> Salvo</>}
      </p>
    </div>
  );
}
