import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { pedirArmazenamentoPersistente } from '@/lib/armazenamento';
import { limparCacheLocal } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

interface EstadoAuth {
  sessao: Session | null;
  usuario: User | null;
  carregando: boolean;
  /** true depois de abrir o link "redefinir senha" do e-mail. */
  recuperandoSenha: boolean;
  concluirRecuperacao: () => void;
  sair: () => Promise<void>;
}

const Contexto = createContext<EstadoAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [recuperandoSenha, setRecuperandoSenha] = useState(false);

  useEffect(() => {
    let ativo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      setSessao(data.session);
      setCarregando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      setSessao(novaSessao);
      setCarregando(false);
      if (evento === 'PASSWORD_RECOVERY') setRecuperandoSenha(true);
    });
    return () => {
      ativo = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // Com login feito, pede para o navegador não apagar a sessão salva no aparelho.
  const logado = sessao !== null;
  useEffect(() => {
    if (logado) void pedirArmazenamentoPersistente();
  }, [logado]);

  const valor = useMemo<EstadoAuth>(
    () => ({
      sessao,
      usuario: sessao?.user ?? null,
      carregando,
      recuperandoSenha,
      concluirRecuperacao: () => setRecuperandoSenha(false),
      sair: async () => {
        await supabase.auth.signOut();
        await limparCacheLocal();
      },
    }),
    [sessao, carregando, recuperandoSenha],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): EstadoAuth {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
