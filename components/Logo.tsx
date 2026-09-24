export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="logo-lockup">
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        role="img"
        aria-label="Syaahi"
      >
        <rect width="48" height="48" rx="14" fill="#214b40" />
        <path
          d="M12 33V14c5-1 9 0 12 3 3-3 7-4 12-3v19c-5-1-9 0-12 3-3-3-7-4-12-3Z"
          fill="none"
          stroke="#f7f2e8"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M24 18v18" stroke="#f7f2e8" strokeWidth="2" />
        <path d="m29 22 3-5 3 5-3 7Z" fill="#e7b477" />
      </svg>
      <span>
        Syaahi<span className="logo-dot">.</span>
      </span>
    </span>
  );
}
