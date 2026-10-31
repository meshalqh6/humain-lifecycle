export function HumainLogo({
  light = false,
  className = "",
}: {
  light?: boolean;
  className?: string;
}) {
  return (
    <img
      src="/branding/humain-logo.png"
      alt="HUMAIN"
      className={`humain-logo ${light ? "logo-light" : ""} ${className}`}
    />
  );
}

// Filled geometric capitals match the supplied CHAT logo's bold silhouette.
// The supplied raster wordmark does not include an installable brand font.
export function LifecycleWordmark() {
  return (
    <svg
      className="lifecycle-wordmark"
      viewBox="0 0 266 32"
      role="img"
      aria-label="LIFECYCLE"
    >
      <g fill="currentColor">
        <path d="M0 2h6v22h16v6H0Z" />
        <path d="M30 2h6v28h-6Z" />
        <path d="M46 2h22v6H52v6h14v6H52v10h-6Z" />
        <path d="M76 2h22v6H82v5h14v6H82v5h16v6H76Z" />
        <path d="M129.9 6.1a14 14 0 1 0 0 19.8l-4.24-4.24a8 8 0 1 1 0-11.32Z" />
        <path d="M142 2h7l7 11 7-11h7l-11 17v11h-6V19Z" />
        <path d="M201.9 6.1a14 14 0 1 0 0 19.8l-4.24-4.24a8 8 0 1 1 0-11.32Z" />
        <path d="M214 2h6v22h16v6h-22Z" />
        <path d="M244 2h22v6h-16v5h14v6h-14v5h16v6h-22Z" />
      </g>
    </svg>
  );
}
