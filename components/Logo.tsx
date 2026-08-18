import { theme } from "@/lib/theme";

// The wordmark, drawn rather than loaded, so it stays crisp at any size,
// inherits the brand colour and needs no image request. Size it with a
// className such as "h-9 w-auto".
export default function Logo({
  className,
  priority: _priority = false,
}: {
  className?: string;
  // Accepted so callers can express intent alongside next/image usage
  // elsewhere. Inline SVG is already in the first paint.
  priority?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 320 96"
      className={className}
      role="img"
      aria-label={theme.logo.alt}
    >
      <text
        x="160"
        y="70"
        textAnchor="middle"
        fill="var(--brand-primary)"
        fontSize="72"
        fontWeight="800"
        letterSpacing="10"
        fontFamily="var(--font-sans), Arial, Helvetica, sans-serif"
      >
        {theme.shopName}
      </text>
    </svg>
  );
}
