import Watchlist from "@/components/Watchlist";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-3xl flex flex-col items-center px-6 sm:px-12 py-16">
        <header className="w-full mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Finance Tracker
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Live quotes from Yahoo Finance. Add tickers to your watchlist — refreshes every 30s.
          </p>
        </header>
        <Watchlist />
        <footer className="mt-16 text-xs text-zinc-500 dark:text-zinc-500">
          Data via Yahoo Finance. Not investment advice.
        </footer>
      </main>
    </div>
  );
}
