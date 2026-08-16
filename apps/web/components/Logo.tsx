/**
 * delphi flat logo — a "?" mark (self-inquiry, oracle of Delphi).
 * Flat minimalist style; no mirror.
 */
export default function Logo({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      aria-label="delphi"
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-[9px] bg-gradient-to-br from-mirror-400 to-mirror-600 font-bold leading-none text-white shadow-soft ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.62) }}
    >
      ?
    </span>
  );
}
