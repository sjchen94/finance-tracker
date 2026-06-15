import PortfolioTracker from "@/components/portfolio/PortfolioTracker";
import Link from "next/link";

export const metadata = {
  title: "Portfolio · Momentum Tech Tracker",
};

export default function PortfolioPage() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <nav className="border-b border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-950">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="font-mono text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Dashboard
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span className="font-mono text-xs font-semibold">Portfolio</span>
        </div>
      </nav>
      <main>
        <PortfolioTracker />
      </main>
      <footer className="px-6 pb-8 text-xs text-zinc-500">
        Data via Yahoo Finance. Stored locally. Not investment advice.
      </footer>
    </div>
  );
}
