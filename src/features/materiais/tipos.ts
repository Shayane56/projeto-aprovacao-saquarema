export interface Material {
  id: string;
  titulo: string;
  tipo: 'pdf' | 'link';
  arquivo_path: string | null;
  url: string | null;
  tamanho_bytes: number | null;
  paginas: number | null;
  disciplina_id: string | null;
  topico_id: string | null;
  criado_em: string;
}

export interface ResultadoBusca {
  material_id: string;
  titulo: string;
  pagina: number;
  trecho: string;
  relevancia: number;
}

export interface Anotacao {
  id: string;
  topico_id: string | null;
  titulo: string | null;
  conteudo: string;
  atualizado_em: string;
}

/** Divide o trecho destacado ("[[palavra]]") em partes para exibir com <mark>. */
export function partesDoTrecho(trecho: string): { texto: string; destaque: boolean }[] {
  return trecho
    .split(/(\[\[.*?\]\])/g)
    .filter(Boolean)
    .map((p) => (p.startsWith('[[') && p.endsWith(']]') ? { texto: p.slice(2, -2), destaque: true } : { texto: p, destaque: false }));
}

export function formatarTamanho(bytes: number | null): string {
  if (!bytes) return '';
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

export const TAMANHO_MAXIMO = 25 * 1024 * 1024;
