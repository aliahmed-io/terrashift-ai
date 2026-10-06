import Link from "next/link";

export function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-mono text-xs tracking-[0.24em] uppercase text-bone-100 hover:text-signal-400 transition-colors">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10.5" stroke="#F2EEE6" strokeWidth="1.2" />
        <path d="M12 1.5v21" stroke="#FFB020" strokeWidth="1.6" />
        <path d="M12 12h10.5" stroke="#F2EEE6" strokeWidth="1.2" strokeDasharray="2 2" />
      </svg>
      TerraShift
    </Link>
  );
}

export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-4 lg:px-16 backdrop-blur-md bg-ink-950/40 border-b border-bone-100/5">
      <Wordmark />
      <nav aria-label="Primary" className="flex items-center gap-4 lg:gap-6 font-mono text-xs tracking-widest uppercase">
        <Link href="/benchmarks" className="text-bone-300 hover:text-signal-400 hidden transition-colors md:block">
          Benchmarks
        </Link>
        <Link href="/timeline" className="text-bone-300 hover:text-signal-400 hidden transition-colors md:block">
          Timeline
        </Link>
        <Link href="/lab" className="text-bone-300 hover:text-signal-400 hidden transition-colors lg:block">
          Image Lab
        </Link>
        <Link href="/carbon" className="text-bone-300 hover:text-signal-400 hidden transition-colors lg:block">
          Carbon & UHI
        </Link>
        <Link href="/watchlist" className="text-bone-300 hover:text-signal-400 hidden transition-colors sm:block">
          STAC Atlas
        </Link>
        <Link
          href="/analyze"
          className="rounded-full border border-signal-400/50 bg-signal-400/10 px-5 py-2 font-bold text-signal-400 backdrop-blur transition-all hover:bg-signal-400 hover:text-ink-950 shadow-[0_0_16px_rgba(255,176,32,0.2)]"
        >
          Launch Studio
        </Link>
      </nav>
    </header>
  );
}
