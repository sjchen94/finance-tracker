# finance-tracker

A simple personal finance tracker built with Next.js and Yahoo Finance data.

## Features

- Live stock quote watchlist (refreshes every 30s)
- Add/remove tickers, persisted in localStorage
- Server-side quote fetching via [`yahoo-finance2`](https://github.com/gadicc/node-yahoo-finance2)

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- yahoo-finance2

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API

- `GET /api/quote?symbols=AAPL,MSFT` → `{ quotes: Quote[] }`

## Notes

- Yahoo Finance has no official API — `yahoo-finance2` scrapes the public endpoints. Use responsibly.
- Not investment advice.
