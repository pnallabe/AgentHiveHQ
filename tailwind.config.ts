import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        body:    ['Inter', 'Space Grotesk', 'sans-serif'],
        mono:    ['var(--font-geist-mono)', 'Geist Mono', 'ui-monospace', 'monospace'],
        // Keep legacy aliases
        headline: ['Space Grotesk', 'sans-serif'],
        code:     ['var(--font-geist-mono)', 'Geist Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        // ── Core brand ──────────────────────────────────────────────────────
        brand: {
          50:  '#eef5ff',
          100: '#d9e9ff',
          200: '#bcd4fe',
          300: '#8eb6fd',
          400: '#598df9',
          500: '#3366f4',  // PRIMARY — electric blue
          600: '#1d48e8',
          700: '#1838cc',
          800: '#1a30a5',
          900: '#1b2e82',
          950: '#141e50',
        },
        // ── Decision semantic colors ─────────────────────────────────────────
        approve: {
          DEFAULT: '#10b981',
          muted:   '#064e3b',
          text:    '#34d399',
        },
        reject: {
          DEFAULT: '#ef4444',
          muted:   '#450a0a',
          text:    '#f87171',
        },
        review: {
          DEFAULT: '#f59e0b',
          muted:   '#451a03',
          text:    '#fbbf24',
        },
        // ── Surface hierarchy (dark-first) ──────────────────────────────────
        surface: {
          base:    '#09090b',   // zinc-950
          raised:  '#111113',
          overlay: '#18181b',   // zinc-900
          border:  '#27272a',   // zinc-800
          muted:   '#3f3f46',   // zinc-700
        },
        // ── Data ink ────────────────────────────────────────────────────────
        data: {
          positive: '#10b981',
          negative: '#ef4444',
          neutral:  '#71717a',
          accent:   '#3366f4',
        },
        // ── shadcn/ui CSS var tokens (preserved) ────────────────────────────
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        'fade-in-up': {
          '0%': {
            opacity: '0',
            transform: 'translateY(20px)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)'
          },
        },
        'fade-in-down': {
          '0%': {
            opacity: '0',
            transform: 'translateY(-16px)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)'
          },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'ticker-scroll': {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in-up': 'fade-in-up 0.7s ease-out forwards',
        'fade-in-down': 'fade-in-down 0.5s ease-out forwards',
        'scale-in': 'scale-in 0.3s ease-out forwards',
        'ticker': 'ticker-scroll 28s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
