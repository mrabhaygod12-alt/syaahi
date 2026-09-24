"use client";

/** Topic-aware SVG hero (not clipart): security / science / history / generic. */
export default function ConceptHero({
  title,
  seed = "s",
}: {
  title: string;
  seed?: string;
}) {
  const t = `${title} ${seed}`.toLowerCase();
  if (/cyber|hack|security|network|password|malware|encrypt/.test(t))
    return <CyberHero />;
  if (/bio|cell|plant|photo|body|dna/.test(t)) return <BioHero />;
  if (/hist|war|revolut|empire|king/.test(t)) return <HistHero />;
  return <GenericHero />;
}

function CyberHero() {
  return (
    <svg viewBox="0 0 220 160" width="180" height="130" aria-hidden>
      <rect
        x="70"
        y="28"
        width="80"
        height="70"
        rx="10"
        fill="#eef2ff"
        stroke="#6366f1"
        strokeWidth="3"
      />
      <rect
        x="82"
        y="40"
        width="56"
        height="36"
        rx="4"
        fill="#c7d2fe"
        className="svg-pulse"
      />
      <rect x="96" y="98" width="28" height="18" fill="#6366f1" />
      <rect x="70" y="116" width="80" height="10" rx="4" fill="#a5b4fc" />
      <circle
        cx="40"
        cy="50"
        r="10"
        fill="none"
        stroke="#7c3aed"
        strokeWidth="3"
        className="svg-dash"
      />
      <circle
        cx="180"
        cy="70"
        r="8"
        fill="none"
        stroke="#2563eb"
        strokeWidth="3"
        className="svg-dash"
      />
      <path d="M40 50h20M180 70h-22" stroke="#94a3b8" strokeWidth="2" />
      <circle cx="28" cy="118" r="14" fill="#ddd6fe" />
      <path d="M22 118h12M28 112v12" stroke="#5b21b6" strokeWidth="2" />
    </svg>
  );
}
function BioHero() {
  return (
    <svg viewBox="0 0 220 160" width="180" height="130" aria-hidden>
      <ellipse
        cx="110"
        cy="90"
        rx="28"
        ry="48"
        fill="#bbf7d0"
        stroke="#16a34a"
        strokeWidth="3"
      />
      <path d="M110 140v-96" stroke="#15803d" strokeWidth="3" />
      <path
        d="M110 70c-36-8-48 18-40 36M110 70c36-8 48 18 40 36"
        fill="none"
        stroke="#22c55e"
        strokeWidth="3"
        className="svg-dash"
      />
      <circle cx="110" cy="88" r="10" fill="#166534" className="svg-pulse" />
    </svg>
  );
}
function HistHero() {
  return (
    <svg viewBox="0 0 220 160" width="180" height="130" aria-hidden>
      <rect
        x="40"
        y="70"
        width="28"
        height="60"
        fill="#fde68a"
        stroke="#b45309"
        strokeWidth="2"
      />
      <rect
        x="96"
        y="40"
        width="28"
        height="90"
        fill="#fef3c7"
        stroke="#b45309"
        strokeWidth="2"
      />
      <rect
        x="152"
        y="58"
        width="28"
        height="72"
        fill="#fde68a"
        stroke="#b45309"
        strokeWidth="2"
      />
      <path d="M30 130h160" stroke="#92400e" strokeWidth="4" />
    </svg>
  );
}
function GenericHero() {
  return (
    <svg viewBox="0 0 220 160" width="180" height="130" aria-hidden>
      <rect
        x="50"
        y="36"
        width="120"
        height="88"
        rx="16"
        fill="#fff7ed"
        stroke="#f0c06a"
        strokeWidth="3"
      />
      <path
        d="M70 70h80M70 90h56M70 110h40"
        stroke="#1f3a5f"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="168" cy="48" r="14" fill="#1f3a5f" className="svg-pulse" />
    </svg>
  );
}
