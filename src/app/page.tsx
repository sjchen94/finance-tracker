import MomentumDashboard from "@/components/momentum/MomentumDashboard";
import Watchlist from "@/components/Watchlist";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <div className="flex flex-col lg:flex-row">
        <aside className="w-full border-b border-black/10 bg-white px-4 py-4 dark:border-white/10 dark:bg-zinc-950 lg:w-80 lg:shrink-0 lg:border-b-0 lg:border-r">
          <h2 className="mb-3 font-mono text-sm font-semibold tracking-tight">
            ⭐ Watchlist
          </h2>
          <Watchlist />
          <div className="mt-6 border-t border-black/10 pt-4 dark:border-white/10">
            <Link
              href="/portfolio"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <span>📊</span>
              <span>Portfolio Tracker</span>
            </Link>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <MomentumDashboard />
          <footer className="px-6 pb-8 text-xs text-zinc-500">
            Data via Yahoo Finance. Cached ~15 min. Not investment advice.
          </footer>
        </main>
      </div>
    </div>
  );
}
