import { Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { mensagemDeErro } from '@/lib/supabase';
import { Botao } from './Botao';

export function TelaCarregando() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-fundo" role="status" aria-label="Carregando">
      <Loader2 className="h-8 w-8 animate-spin text-primaria" aria-hidden />
    </div>
  );
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-suave" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {texto}
    </div>
  );
}

export function ErroCarga({ erro, tentarDeNovo }: { erro: unknown; tentarDeNovo?: () => void }) {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  return (
    <div className="cartao mx-auto my-10 max-w-md p-6 text-center">
      <WifiOff className="mx-auto h-8 w-8 text-suave" aria-hidden />
      <h2 className="mt-3 font-semibold">{offline ? 'Você está offline' : 'Não foi possível carregar'}</h2>
      <p className="mt-1 text-sm text-suave">
        {offline ? 'Conecte-se uma vez para baixar o conteúdo; depois ele fica disponível offline.' : mensagemDeErro(erro)}
      </p>
      {tentarDeNovo && (
        <Botao variante="secundario" className="mt-4" onClick={tentarDeNovo}>
          <RefreshCw className="h-4 w-4" aria-hidden /> Tentar de novo
        </Botao>
      )}
    </div>
  );
}
