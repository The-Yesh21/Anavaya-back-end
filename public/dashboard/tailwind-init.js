/* =====================================================================
   Tailwind (Play CDN) init for Anavaya — shared by index.html & courtroom.html
   ---------------------------------------------------------------------
   Tailwind is a COMPLEMENTARY utility layer over the existing hand-written
   CSS, NOT a replacement. Three rules keep it safe and evolutionary:

     • Preflight (Tailwind's base reset) is DISABLED, so the ~9k lines of
       existing CSS and default element styling are left completely intact.
     • Every utility is prefixed `tw-` (e.g. tw-flex, tw-bg-gold-600) so it
       can never collide with the app's semantic class names — which the JS
       relies on as behaviour hooks (classList toggles, closest(), etc.).
     • The theme MIRRORS tokens.css via var() references. tokens.css stays
       the single source of truth for the "White & Gold" palette; changing a
       token there automatically re-skins the matching Tailwind utilities.

   Load order matters: the cdn.tailwindcss.com <script> must come BEFORE this
   file so `window.tailwind` exists when we set its config.
   ===================================================================== */
if (typeof tailwind !== 'undefined') {
  tailwind.config = {
    prefix: 'tw-',
    corePlugins: { preflight: false },
    theme: {
      extend: {
        colors: {
          app: 'var(--bg-app)',
          card: 'var(--bg-card)',
          'card-hover': 'var(--bg-card-hover)',
          well: 'var(--bg-well)',
          line: 'var(--border-color)',
          gold: {
            50: 'var(--gold-50)',
            100: 'var(--gold-100)',
            300: 'var(--gold-300)',
            500: 'var(--gold-500)',
            600: 'var(--gold-600)',
            700: 'var(--gold-700)',
            800: 'var(--gold-800)',
          },
          ink: {
            DEFAULT: 'var(--text-primary)',
            secondary: 'var(--text-secondary)',
            muted: 'var(--text-muted)',
          },
          primary: {
            DEFAULT: 'var(--color-primary)',
            dark: 'var(--color-primary-dark)',
            fg: 'var(--color-primary-fg)',
          },
          high: 'var(--color-high)',
          medium: 'var(--color-medium)',
          low: 'var(--color-low)',
          success: 'var(--color-success)',
        },
        fontFamily: {
          heading: ['Fraunces', 'serif'],
          body: ['Nunito', 'sans-serif'],
        },
        borderRadius: {
          card: 'var(--radius-card)',
          pill: 'var(--radius-pill)',
          hero: 'var(--radius-hero)',
          organic: 'var(--radius-organic)',
        },
        boxShadow: {
          soft: 'var(--shadow-soft)',
          card: 'var(--shadow-card)',
          panel: 'var(--shadow-panel)',
          float: 'var(--shadow-float)',
          gold: 'var(--shadow-gold)',
        },
        transitionTimingFunction: {
          out: 'var(--ease-out)',
          spring: 'var(--ease-spring)',
        },
        transitionDuration: {
          fast: 'var(--dur-fast)',
          med: 'var(--dur-med)',
          slow: 'var(--dur-slow)',
        },
        // NOTE: the token spacing scale (--space-1..12 = 4/8/12/16/20/24/32/40/48px)
        // is identical to Tailwind's default numeric scale, so tw-p-4 == 16px etc.
        // No spacing override needed.
      },
    },
  };
}
