export function Logo({ className }: { className?: string }) {
  return (
    <svg
      width="137"
      height="24"
      viewBox="0 0 137 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="VectorEnglish"
      className={className}
    >
      <text
        y="19"
        fontFamily="var(--font-geist), -apple-system, sans-serif"
        fontSize="18"
        fontWeight="600"
        letterSpacing="-0.3"
      >
        <tspan fill="#f4c46b">Vector</tspan>
        <tspan fill="#ffffff">English</tspan>
        <tspan fill="rgba(255,255,255,0.30)">.io</tspan>
      </text>
    </svg>
  );
}
