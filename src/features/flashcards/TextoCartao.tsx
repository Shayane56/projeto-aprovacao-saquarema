import { partesDoTrecho } from '@/features/materiais/tipos';

/**
 * Texto de um cartão. Trechos entre [[ ]] aparecem destacados — usado nos
 * cartões de ocultar palavras, para mostrar no verso a palavra que faltava.
 */
export function TextoCartao({ texto }: { texto: string }) {
  return (
    <>
      {partesDoTrecho(texto).map((p, i) =>
        p.destaque ? (
          <mark key={i} className="rounded bg-primaria-suave px-1 font-bold text-primaria">{p.texto}</mark>
        ) : (
          <span key={i}>{p.texto}</span>
        ),
      )}
    </>
  );
}
