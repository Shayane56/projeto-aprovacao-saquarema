/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        fundo: token('fundo'),
        superficie: token('superficie'),
        'superficie-2': token('superficie-2'),
        borda: token('borda'),
        texto: token('texto'),
        suave: token('suave'),
        primaria: {
          DEFAULT: token('primaria'),
          forte: token('primaria-forte'),
          suave: token('primaria-suave'),
          texto: token('primaria-texto'),
        },
        destaque: token('destaque'),
        sucesso: token('sucesso'),
        alerta: token('alerta'),
        perigo: token('perigo'),
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        cartao: '0 1px 2px rgb(15 23 42 / 0.06), 0 4px 16px -6px rgb(15 23 42 / 0.10)',
      },
    },
  },
  plugins: [],
};
