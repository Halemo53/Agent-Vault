import { useEffect, useState } from "react";

export function DotGrid({ cols = 10, rows = 10, gap = 18, className = "" }: { cols?: number; rows?: number; gap?: number; className?: string }) {
  return (
    <svg width={cols * gap} height={rows * gap} className={className} aria-hidden>
      {Array.from({ length: cols * rows }).map((_, i) => (
        <circle key={i} cx={(i % cols) * gap + gap / 2} cy={Math.floor(i / cols) * gap + gap / 2} r={1.2} className="fill-border" />
      ))}
    </svg>
  );
}

export function HeroGeometry() {
  const [block, setBlock] = useState(18452301);
  useEffect(() => {
    const t = setInterval(() => setBlock((b) => b + 1 + Math.floor(Math.random() * 3)), 3000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="mx-auto w-full max-w-[460px]">
      <svg viewBox="0 0 400 400" className="h-full w-full" aria-hidden>
        {[180, 145, 110, 75, 40].map((r) => (
          <circle key={r} cx="200" cy="200" r={r} fill="none" className="stroke-border" strokeWidth="1" />
        ))}
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2, r1 = i % 5 === 0 ? 186 : 190;
          return <line key={i} x1={200 + Math.cos(a) * r1} y1={200 + Math.sin(a) * r1} x2={200 + Math.cos(a) * 196} y2={200 + Math.sin(a) * 196} className="stroke-border" strokeWidth="1" />;
        })}
        <line x1="20" y1="200" x2="380" y2="200" className="stroke-border" strokeWidth="1" />
        <line x1="200" y1="20" x2="200" y2="380" className="stroke-border" strokeWidth="1" />
        <g className="animate-dial">
          <path d="M 200 20 A 180 180 0 0 1 355.9 290" fill="none" className="stroke-primary" strokeWidth="2" />
          <circle cx="355.9" cy="290" r="5" className="fill-primary" />
        </g>
        <circle cx="200" cy="200" r="4" className="fill-ink" />
      </svg>
      <p className="mt-4 text-center font-mono text-[11px] tracking-[0.08em] text-muted-foreground tabular">
        POLICY ENFORCED ON-CHAIN · BLOCK #{block.toLocaleString("en-US")}
      </p>
    </div>
  );
}

export function BrokenKeyDiagram() {
  return (
    <svg viewBox="0 0 420 220" className="w-full max-w-[460px]" aria-hidden>
      <rect x="10" y="80" width="130" height="60" rx="8" fill="none" className="stroke-ink" strokeWidth="1" />
      <text x="75" y="115" textAnchor="middle" className="fill-ink font-mono" fontSize="11">PRIVATE KEY</text>
      <rect x="280" y="80" width="130" height="60" rx="8" fill="none" className="stroke-ink" strokeWidth="1" />
      <text x="345" y="115" textAnchor="middle" className="fill-ink font-mono" fontSize="11">AGENT</text>
      <line x1="140" y1="110" x2="195" y2="110" className="stroke-ink" strokeWidth="1" />
      <line x1="225" y1="110" x2="280" y2="110" className="stroke-ink" strokeWidth="1" strokeDasharray="4 4" />
      <line x1="198" y1="96" x2="222" y2="124" className="stroke-primary" strokeWidth="2" />
      <line x1="222" y1="96" x2="198" y2="124" className="stroke-primary" strokeWidth="2" />
      <text x="210" y="160" textAnchor="middle" className="fill-primary font-mono" fontSize="10">UNBOUNDED ACCESS</text>
      <line x1="10" y1="200" x2="410" y2="200" className="stroke-border" strokeWidth="1" />
      <line x1="10" y1="20" x2="410" y2="20" className="stroke-border" strokeWidth="1" />
    </svg>
  );
}

export function EmptyGeometry({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <svg viewBox="0 0 120 120" className="h-[120px] w-[120px]" aria-hidden>
        <circle cx="60" cy="60" r="50" fill="none" className="stroke-border" />
        <circle cx="60" cy="60" r="30" fill="none" className="stroke-border" />
        <line x1="10" y1="60" x2="110" y2="60" className="stroke-border" />
        <circle cx="60" cy="60" r="3" className="fill-primary" />
      </svg>
      <p className="font-display text-lg font-semibold text-ink">{label}</p>
    </div>
  );
}
