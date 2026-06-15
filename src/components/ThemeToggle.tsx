"use client";

import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { resolved, setTheme } = useTheme();

  function toggle() {
    setTheme(resolved === "dark" ? "light" : "dark");
  }

  return (
    <button
      onClick={toggle}
      title={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-black/10 text-zinc-600 transition-colors hover:bg-black/5 dark:border-white/15 dark:text-zinc-400 dark:hover:bg-white/5"
    >
      {resolved === "dark" ? (
        // Sun icon
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // Moon icon
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
