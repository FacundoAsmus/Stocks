# Stock News and Fundamentals Starter

A clean, dark-mode starter for a stock watchlist, fundamentals, charting, news, and analyst data app built with Next.js 15, React, TypeScript, Tailwind CSS, Recharts, and Finnhub.

## Windows setup for this generated project

1. Install Node.js 20 or newer from https://nodejs.org.
2. Open this folder in VS Code.
3. Open the VS Code terminal with `Ctrl + backtick`.
4. Install dependencies:

```powershell
npm install
```

5. Open `.env.local` and replace `your_finnhub_api_key_here` with your Finnhub API key.
6. Start the dev server:

```powershell
npm run dev
```

7. Open http://localhost:3000.

## If you want to recreate this manually

```powershell
npx create-next-app@latest stock-news-app --ts --app --eslint
cd stock-news-app
npm install recharts lucide-react clsx tailwind-merge
npm install -D tailwindcss @tailwindcss/postcss postcss
Copy-Item .env.local.example .env.local
```

Then copy the `app`, `components`, `lib`, and `types` folders from this starter into your new project.

## Folder structure

```text
app/
  api/
    candles/route.ts
    search/route.ts
    stocks/route.ts
  stock/[symbol]/
    loading.tsx
    page.tsx
  globals.css
  layout.tsx
  page.tsx
components/
  AddToWatchlistButton.tsx
  AnalystSection.tsx
  EmptyWatchlist.tsx
  ErrorState.tsx
  FundamentalsGrid.tsx
  MarketSentiment.tsx
  NewsCard.tsx
  PriceChart.tsx
  SearchBar.tsx
  StockCard.tsx
  ToastProvider.tsx
  Watchlist.tsx
lib/
  constants.ts
  finnhub.ts
  format.ts
  utils.ts
types/
  stock.ts
```

## Notes

- Watchlists are stored in each visitor's browser using `localStorage`.
- Finnhub calls are proxied through server code so the API key is never exposed to the browser.
- The Finnhub service includes a small in-memory cache to reduce free-tier rate-limit pressure.
- The detail chart loads 1M, 3M, 6M, and 1Y candle periods through `/api/candles`. Finnhub is tried first; if the free-tier key cannot access `/stock/candle`, the server falls back to a public historical chart source so the UI still renders real price history.
- Major indices such as `^GSPC`, `^IXIC`, `^DJI`, `SPX`, and `NDX` are supported in search and watchlists.
