import Link from "next/link";

export function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2 font-mono text-xs tracking-[0.24em] uppercase">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10.5" stroke="#F2EEE6" strokeWidth="1" />
        <path d="M12 1.5v21" stroke="#FFB020" strokeWidth="1.5" />
        <path d="M12 12h10.5" stroke="#F2EEE6" strokeWidth="1" strokeDasharray="2 2" />
      </svg>
      TerraShift
    </Link>
  );
}

export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-4 lg:px-16">
      <Wordmark />
      <nav aria-label="Primary" className="flex items-center gap-6 font-mono text-xs tracking-widest uppercase">
        <a href="#story" className="text-bone-300 hover:text-signal-400 hidden transition-colors sm:block">
          Story
        </a>
        <a href="#pipeline" className="text-bone-300 hover:text-signal-400 hidden transition-colors sm:block">
          Pipeline
        </a>
        <Link
          href="/analyze"
          className="border-bone-100/30 bg-ink-950/40 hover:border-signal-400 hover:text-signal-400 rounded-full border px-4 py-2 backdrop-blur transition-colors"
        >
          Launch
        </Link>
      </nav>
    </header>
  );
}
