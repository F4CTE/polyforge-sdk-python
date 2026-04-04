export function PolyforgeLogomark({
  size = 24,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.4"
      />
      <path d="M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z" fill="currentColor" />
    </svg>
  );
}
