import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { Marca } from '@/app/layout/Marca';
import { Aviso, Botao, Campo } from '@/shared/ui';
import { TelaCarregando } from '@/shared/ui/Estados';
import { useAuth } from './AuthProvider';

export function RedefinirSenhaPage() {
  const { usuario, carregando, concluirRecuperacao } = useAuth();
  const navegar = useNavigate();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (carregando) return <TelaCarregando />;
  if (!usuario) return <Navigate to="/entrar" replace />;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.');
    if (senha !== confirmacao) return setErro('As senhas não conferem.');
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) return setErro(mensagemDeErro(error));
    concluirRecuperacao();
    navegar('/', { replace: true });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-fundo px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center"><Marca /></div>
        <form onSubmit={salvar} className="cartao space-y-4 p-6">
          <h1 className="text-lg font-semibold">Criar nova senha</h1>
          <Campo rotulo="Nova senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" dica="Mínimo de 8 caracteres." />
          <Campo rotulo="Repita a nova senha" type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="new-password" />
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <Botao type="submit" className="w-full" carregando={enviando}>Salvar nova senha</Botao>
        </form>
      </div>
    </div>
  );
}
