import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { useEdital } from '@/features/edital/hooks';
import { chavesPratica } from '@/features/questoes/hooks';
import { mensagemDeErro } from '@/lib/supabase';
import { Aviso, Botao, Campo, Carregando, ErroCarga } from '@/shared/ui';
import { EditorQuestao, rascunhoValido, rascunhoVazio, type Rascunho } from './EditorQuestao';
import { salvarRascunhos } from './salvar';

export function NovaQuestaoPage() {
  const { usuario } = useAuth();
  const edital = useEdital();
  const qc = useQueryClient();
  const [rascunho, setRascunho] = useState<Rascunho>(() => rascunhoVazio());
  const [fonte, setFonte] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'sucesso' | 'erro' | 'alerta'; texto: string } | null>(null);

  if (edital.isPending) return <Carregando />;
  if (!edital.data) return <ErroCarga erro={edital.error} />;

  async function salvar() {
    if (!usuario) return;
    setSalvando(true);
    setMsg(null);
    try {
      const r = await salvarRascunhos(usuario.id, [rascunho], [], 'manual', fonte);
      await qc.invalidateQueries({ queryKey: chavesPratica.questoes(usuario.id) });
      setMsg(r.novas ? { tipo: 'sucesso', texto: 'Questão salva no seu banco.' } : { tipo: 'alerta', texto: 'Essa questão já existe no seu banco.' });
      if (r.novas) setRascunho(rascunhoVazio(rascunho.disciplina_id));
    } catch (e) {
      setMsg({ tipo: 'erro', texto: mensagemDeErro(e) });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/praticar" className="rounded-lg p-1.5 text-suave hover:bg-superficie-2" aria-label="Voltar para Praticar"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-xl font-bold tracking-tight">Nova questão</h1>
      </div>
      <div className="cartao space-y-4 p-5">
        <EditorQuestao valor={rascunho} aoMudar={setRascunho} edital={edital.data} />
        <Campo rotulo="Fonte (opcional)" value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="Ex.: IBAM · Prefeitura de Maricá · 2023 · ACE" />
        {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
        <Botao onClick={() => void salvar()} carregando={salvando} disabled={!rascunhoValido(rascunho)}>Salvar questão</Botao>
      </div>
    </div>
  );
}
