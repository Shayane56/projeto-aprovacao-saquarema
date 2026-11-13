import { exigir, supabase } from '@/lib/supabase';
import type { Anotacao, Material, ResultadoBusca } from './tipos';

const BUCKET = 'materiais';
const COLUNAS = 'id, titulo, tipo, arquivo_path, url, tamanho_bytes, paginas, disciplina_id, topico_id, criado_em';

export async function listarMateriais(): Promise<Material[]> {
  return exigir(await supabase.from('materiais').select(COLUNAS).order('criado_em', { ascending: false }).limit(1000)) as Material[];
}

export interface NovoPdf {
  userId: string;
  arquivo: File;
  titulo: string;
  disciplinaId: string | null;
  topicoId: string | null;
  paginas: string[];
}

/** Envia o PDF ao Storage, registra o material e o texto de cada página (para a busca). */
export async function enviarPdf(v: NovoPdf): Promise<Material> {
  const id = crypto.randomUUID();
  const caminho = `${v.userId}/${id}.pdf`;
  const envio = await supabase.storage.from(BUCKET).upload(caminho, v.arquivo, { contentType: 'application/pdf', upsert: false });
  if (envio.error) throw envio.error;
  try {
    const material = exigir(
      await supabase
        .from('materiais')
        .insert({
          id, user_id: v.userId, titulo: v.titulo, tipo: 'pdf', arquivo_path: caminho, tamanho_bytes: v.arquivo.size,
          paginas: v.paginas.length, disciplina_id: v.disciplinaId, topico_id: v.topicoId,
        })
        .select(COLUNAS)
        .single(),
    ) as Material;
    const linhas = v.paginas.map((texto, i) => ({ material_id: id, pagina: i + 1, user_id: v.userId, texto: texto.slice(0, 50_000) })).filter((l) => l.texto.trim());
    for (let i = 0; i < linhas.length; i += 50) exigir(await supabase.from('materiais_paginas').insert(linhas.slice(i, i + 50)));
    return material;
  } catch (e) {
    // Não deixa arquivo órfão no Storage se o registro falhar.
    await supabase.storage.from(BUCKET).remove([caminho]);
    await supabase.from('materiais').delete().eq('id', id);
    throw e;
  }
}

export interface NovoLink {
  userId: string;
  titulo: string;
  url: string;
  disciplinaId: string | null;
  topicoId: string | null;
}

export async function criarLink(v: NovoLink): Promise<void> {
  exigir(await supabase.from('materiais').insert({ user_id: v.userId, titulo: v.titulo, tipo: 'link', url: v.url, disciplina_id: v.disciplinaId, topico_id: v.topicoId }));
}

export async function excluirMaterial(m: Material): Promise<void> {
  if (m.arquivo_path) {
    const r = await supabase.storage.from(BUCKET).remove([m.arquivo_path]);
    if (r.error) throw r.error;
  }
  exigir(await supabase.from('materiais').delete().eq('id', m.id));
}

export async function baixarPdf(caminho: string): Promise<ArrayBuffer> {
  const r = await supabase.storage.from(BUCKET).download(caminho);
  if (r.error) throw r.error;
  return r.data.arrayBuffer();
}

export async function buscarNosMateriais(consulta: string): Promise<ResultadoBusca[]> {
  const { data, error } = await supabase.rpc('buscar_materiais', { p_consulta: consulta, p_limite: 40 });
  if (error) throw error;
  return (data ?? []) as ResultadoBusca[];
}

export async function listarAnotacoes(): Promise<Anotacao[]> {
  return exigir(await supabase.from('anotacoes').select('id, topico_id, titulo, conteudo, atualizado_em').order('atualizado_em', { ascending: false }).limit(2000)) as Anotacao[];
}

export interface SalvarNota {
  userId: string;
  topicoId: string;
  conteudo: string;
}

export async function salvarNotaDoTopico({ userId, topicoId, conteudo }: SalvarNota): Promise<void> {
  if (!conteudo.trim()) {
    exigir(await supabase.from('anotacoes').delete().eq('user_id', userId).eq('topico_id', topicoId));
    return;
  }
  exigir(await supabase.from('anotacoes').upsert({ user_id: userId, topico_id: topicoId, conteudo }, { onConflict: 'user_id,topico_id' }));
}
