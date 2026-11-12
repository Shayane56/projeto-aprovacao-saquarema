/**
 * Credenciais PÚBLICAS do Supabase. A chave "publishable" só permite o que as
 * políticas de segurança (RLS) autorizam — por isso pode ficar no navegador.
 * Variáveis de ambiente (VITE_*) têm prioridade sobre os valores padrão.
 */
const PADRAO = {
  url: 'https://azydkohkesfcbaynzktx.supabase.co',
  chave: 'sb_publishable_6E462YfMYtqNBPLRDakCTA_76aoEGI5',
};

export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || PADRAO.url,
  supabaseChave: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || PADRAO.chave,
  concursoId: 'saquarema-ace-2026',
  fusoHorario: 'America/Sao_Paulo',
} as const;

/** Endereço do app sem rota (ex.: https://site/app/), usado em links de e-mail. */
export function urlBaseDoApp(rota = ''): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${rota ? `#${rota}` : ''}`;
}
