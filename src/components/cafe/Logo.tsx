/**
 * Pizzara Coffee brand mark — vector redraw of the official logo (dark espresso
 * disc, golden cup whose handle forms the "P", steam flames, saucer swoosh).
 * Fixed brand colors on purpose: the logo must not shift with the UI theme.
 * Drop the original bitmap at public/logo.png anytime to use it instead.
 */

const GOLD = "#d18b4a";
const DARK = "#2b1a10";

export function PizzaraMark({ className, withText = false }: { className?: string; withText?: boolean }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="Pizzara Coffee">
      <circle cx="256" cy="256" r="252" fill={DARK} />
      <g fill="none" stroke={GOLD} strokeWidth="22" strokeLinecap="round">
        {/* steam */}
        <path d="M292 92c-26 30 16 46-8 78" />
        <path d="M336 106c-20 24 12 38-6 62" />
        {/* cup bowl */}
        <path d="M118 234h236c4 66-50 112-118 112s-120-46-118-112z" fill={GOLD} stroke="none" />
        {/* P stem + loop (the handle) */}
        <path d="M368 322V150" strokeWidth="24" />
        <path d="M368 158h26a48 48 0 0 1 0 96h-26" strokeWidth="24" />
        {/* saucer swoosh */}
        <path d="M96 372c52 34 262 32 322-16" strokeWidth="20" />
      </g>
      {withText && (
        <g fill={GOLD} fontFamily="Georgia, 'Times New Roman', serif" textAnchor="middle" fontWeight="700">
          <text x="256" y="448" fontSize="58" letterSpacing="4">PIZZARA</text>
          <text x="256" y="492" fontSize="34" letterSpacing="10">COFFEE</text>
        </g>
      )}
    </svg>
  );
}
