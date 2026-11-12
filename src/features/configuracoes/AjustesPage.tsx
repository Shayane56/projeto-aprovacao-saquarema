import { Download, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { cn } from '@/lib/cn';
import { mensagemDeErro, supabase } from '@/lib/supabase';
import { useInstalar } from '@/shared/hooks/useInstalar';
import { useOnline } from '@/shared/hooks/useOnline';
import { useTema, type Tema } from '@/shared/tema';
import { Aviso, Botao, Campo } from '@/shared/ui';

const TEMAS: { valor: Tema; rotulo: string; icone: typeof Sun }[] = [
  { valor: 'claro', rotulo: 'Claro', icone: Sun },
  { valor: 'escuro', rotulo: 'Escuro', icone: Moon },
  { valor: 'sistema', rotulo: 'Automático', icone: Monitor },
];

export function AjustesPage() {
  const { usuario, sair } = useAuth();
  const [tema, setTema] = useTema();
  const { podeInstalar, instalado, instalar } = useInstalar();
  const online = useOnline();
  const [nome, setNome] = useState<string>((usuario?.user_metadata?.nome as string | undefined) ?? '');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [saindo, setSaindo] = useState(false);

  async function salvarNome(e: FormEvent) {
    e.preventDefault();
    if (!usuario) return;
    setSalvando(true);
    setMensagem(null);
    try {
      const limpo = nome.trim();
      const { error } = await supabase.auth.updateUser({ data: { nome: limpo } });
      if (error) throw error;
      const r = await supabase.from('perfis').update({ nome: limpo || null }).eq('id', usuario.id);
      if (r.error) throw r.error;
      setMensagem({ tipo: 'sucesso', texto: 'Nome atualizado.' });
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: mensagemDeErro(err) });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>

      <section className="cartao p-5" aria-labelledby="titulo-perfil">
        <h2 id="titulo-perfil" className="font-semibold">Perfil</h2>
        <form onSubmit={salvarNome} className="mt-4 space-y-3">
          <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="given-name" />
          <p className="text-sm text-suave">E-mail: <span className="font-medium text-texto">{usuario?.email}</span></p>
          {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}
          <Botao type="submit" variante="secundario" carregando={salvando}>Salvar nome</Botao>
        </form>
      </section>

      <section className="cartao p-5" aria-labelledby="titulo-aparencia">
        <h2 id="titulo-aparencia" className="font-semibold">Aparência</h2>
        <div className="mt-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema">
          {TEMAS.map(({ valor, rotulo, icone: Icone }) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={tema === valor}
              onClick={() => setTema(valor)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-sm font-medium transition-colors',
                tema === valor ? 'border-primaria bg-primaria-suave text-primaria' : 'border-borda hover:bg-superficie-2',
              )}
            >
              <Icone className="h-5 w-5" aria-hidden /> {rotulo}
            </button>
          ))}
        </div>
      </section>

      <section className="cartao p-5" aria-labelledby="titulo-app">
        <h2 id="titulo-app" className="font-semibold">Aplicativo</h2>
        <div className="mt-3 space-y-3 text-sm">
          <p className="flex items-center gap-2">
            <span className={cn('h-2.5 w-2.5 rounded-full', online ? 'bg-sucesso' : 'bg-alerta')} aria-hidden />
            {online ? 'Conectado — seus dados estão sincronizados com a nuvem.' : 'Offline — o que você marcar será enviado quando a conexão voltar.'}
          </p>
          {instalado ? (
            <p className="text-suave">O app já está instalado neste aparelho.</p>
          ) : podeInstalar ? (
            <Botao onClick={() => void instalar()}><Download className="h-4 w-4" aria-hidden /> Instalar na tela inicial</Botao>
          ) : (
            <p className="text-suave">
              Para instalar: no Chrome do Android, toque em <strong>⋮</strong> → <strong>Adicionar à tela inicial</strong> (ou “Instalar app”).
            </p>
          )}
        </div>
      </section>

      <section className="cartao p-5">
        <Botao variante="perigo" carregando={saindo} onClick={async () => { setSaindo(true); await sair(); }}>
          <LogOut className="h-4 w-4" aria-hidden /> Sair da conta
        </Botao>
        <p className="mt-4 text-xs text-suave">Projeto Aprovação Saquarema · versão {__VERSAO__}</p>
      </section>
    </div>
  );
}
