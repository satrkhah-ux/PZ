/**
 * Pizzara Coffee brand mark — the OFFICIAL logo (public/logo.png, the owner's
 * real circular coffee mark, trimmed to a transparent-corner 256px coin so it
 * sits cleanly on any background).
 */
export function PizzaraMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.png" alt="Pizzara Coffee" className={className} loading="lazy" />
  );
}
