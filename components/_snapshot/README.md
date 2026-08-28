# SNAPSHOT — pre-merge Watchlist design

These two files are a frozen copy of the watchlist page + stock card design
from before the PC watchlist/stock-page merge, kept only because you like the
look and might want to bring it back one day.

- `Watchlist.snapshot.tsx` — copy of `components/Watchlist.tsx` (the grid of cards)
- `StockCard.snapshot.tsx` — copy of `components/StockCard.tsx` (the individual card)

**They are not imported or referenced anywhere in the app.** They exist purely
as reference. The live app still uses the real `components/Watchlist.tsx` and
`components/StockCard.tsx` — those are untouched by the merge, since
`StockCard` is also used elsewhere (Market page, etc). Only what *renders* on
`/watchlist` for desktop changed, via `app/watchlist/page.tsx`.

Safe to delete this folder at any time — it has zero effect on the running app.
