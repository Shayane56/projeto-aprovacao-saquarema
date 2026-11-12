import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { urlBaseDoApp } from '@/lib/config';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { Marca } from '@/app/layout/Marca';
import { Aviso, Botao, Campo } from '@/shared/ui';
import { useAuth } from './AuthProvider';

type Modo = 'entrar' | 'cadastrar' | 'recuperar';

export function EntrarPage() {
  const { usuario, carregando } = useAuth();
  const local = useLocation();
  const [modo, setModo] = useState<Modo>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviadoPara, setEnviadoPara] = useState<{ email: string; tipo: 'confirmacao' | 'recuperacao' } | null>(null);

  if (!carregando && usuario) {
    const destino = (local.state as { de?: string } | null)?.de ?? '/';
    return <Navigate to={destino} replace />;
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) throw error;
      } else if (modo === 'cadastrar') {
        if (senha.length < 8) throw new Error('Password should be at least 8 characters');
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { data: { nome: nome.trim() }, emailRedirectTo: urlBaseDoApp() },
        });
        if (error) throw error;
        if (!data.session) setEnviadoPara({ email: email.trim(), tipo: 'confirmacao' });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: urlBaseDoApp('/redefinir-senha') });
        if (error) throw error;
        setEnviadoPara({ email: email.trim(), tipo: 'recuperacao' });
      }
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  const trocar = (m: Modo) => {
    setModo(m);
    setErro(null);
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-primaria-suave/70 to-fundo px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Marca tamanho="grande" />
          <p className="mt-3 text-sm text-suave">Agente de Combate às Endemias · Saquarema/RJ</p>
        </div>

        <div className="cartao p-6">
          {enviadoPara ? (
            <div className="text-center">
              <MailCheck className="mx-auto h-10 w-10 text-primaria" aria-hidden />
              <h1 className="mt-3 text-lg font-semibold">Verifique seu e-mail</h1>
              <p className="mt-2 text-sm text-suave">
                {enviadoPara.tipo === 'confirmacao'
                  ? 'Enviamos um link de confirmação para '
                  : 'Se existir uma conta, enviamos um link para criar uma nova senha em '}
                <strong className="text-texto">{enviadoPara.email}</strong>.
              </p>
              <Botao variante="secundario" className="mt-5 w-full" onClick={() => { setEnviadoPara(null); trocar('entrar'); }}>
                Voltar para entrar
              </Botao>
            </div>
          ) : (
            <form onSubmit={enviar} className="space-y-4" noValidate>
              <h1 className="text-lg font-semibold">
                {modo === 'entrar' ? 'Entrar' : modo === 'cadastrar' ? 'Criar conta' : 'Recuperar senha'}
              </h1>
              {modo === 'cadastrar' && (
                <Campo rotulo="Como quer ser chamada?" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="given-name" placeholder="Seu nome" />
              )}
              <Campo rotulo="E-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" placeholder="voce@email.com" />
              {modo !== 'recuperar' && (
                <Campo
                  rotulo="Senha"
                  type="password"
                  required
                  minLength={modo === 'cadastrar' ? 8 : undefined}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                  dica={modo === 'cadastrar' ? 'Mínimo de 8 caracteres.' : undefined}
                />
              )}
              {erro && <Aviso tipo="erro">{erro}</Aviso>}
              <Botao type="submit" className="w-full" carregando={enviando} disabled={!email || (modo !== 'recuperar' && !senha)}>
                {modo === 'entrar' ? 'Entrar' : modo === 'cadastrar' ? 'Criar conta' : 'Enviar link'}
              </Botao>
              <div className="flex flex-col items-center gap-2 pt-1 text-sm">
                {modo === 'entrar' ? (
                  <>
                    <button type="button" className="text-primaria hover:underline" onClick={() => trocar('recuperar')}>Esqueci minha senha</button>
                    <button type="button" className="text-suave hover:text-texto" onClick={() => trocar('cadastrar')}>Primeiro acesso? <span className="font-medium text-primaria">Criar conta</span></button>
                  </>
                ) : (
                  <button type="button" className="text-primaria hover:underline" onClick={() => trocar('entrar')}>Já tenho conta — entrar</button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
