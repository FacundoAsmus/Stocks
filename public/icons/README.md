# Optional UI SVG icons

## Stock and ETF logos

Add a ticker-specific fallback logo here as `<TICKER>.svg`, using the exact uppercase
symbol shown by the app. Examples: `SPY.svg`, `QQQ.svg`, `BRK.B.svg`. This file is used
when a stock has no provider logo and for ETFs. If it is not present, the app uses
`stock_fallback_icon.svg` automatically. The generic arrow is tinted from the active theme
accent (white in dark mode and black in light mode); its surrounding circle is drawn
by the app.

The default stock/ETF fallback is `stock_fallback_icon.svg`. `general_icon.svg` is
reserved for the general market heatmap group icon.

## Market heatmap group icons

These SVGs are requested from this folder by the market heatmap and ETF lists:

- `broad_tresury_icon.svg`
- `consumer_discr_icon.svg`
- `consumer_staples_icon.svg`
- `energy_icon.svg`
- `financials_icon.svg`
- `general_icon.svg`
- `health_care_icon.svg`
- `industrails_icon.svg`
- `materials_icon.svg`
- `metals_icon.svg`
- `real_state_icon.svg`
- `semiconductors_icon.svg`
- `tech_icon.svg`
- `utilities_icon.svg`

Upload SVG files into this folder using the names below. Icons are tinted by the UI and sized by their component. If a file is missing, its icon is omitted without leaving a placeholder.

## Navigation

- `market.svg`, `market-selected.svg`
- `watchlist.svg`, `watchlist-selected.svg`
- `settings.svg`, `settings-selected.svg`

The same files are used on desktop and phone. Each layout controls its own size and selected tint.

## Desktop brand image

Upload the PC header image as `site-logo.png` in this folder (`public/icons/site-logo.png`).
It appears at 90 × 90 px at the top-left of the desktop Market and Watchlist pages, before the navigation buttons. The header layout stays at its original size.

## Market heatmap groups

Use the group id for the unselected and selected versions:

- `broad.svg`, `broad-selected.svg`
- `tech.svg`, `tech-selected.svg`
- `semiconductors.svg`, `semiconductors-selected.svg`
- `financials.svg`, `financials-selected.svg`
- `energy.svg`, `energy-selected.svg`
- `health-care.svg`, `health-care-selected.svg`
- `industrials.svg`, `industrials-selected.svg`
- `consumer-discretionary.svg`, `consumer-discretionary-selected.svg`
- `consumer-staples.svg`, `consumer-staples-selected.svg`
- `materials.svg`, `materials-selected.svg`
- `real-estate.svg`, `real-estate-selected.svg`
- `utilities.svg`, `utilities-selected.svg`
- `metals.svg`, `metals-selected.svg`
- `treasury-bonds.svg`, `treasury-bonds-selected.svg`

## Stock page sections

- `stock-sentiment.svg`
- `indicators.svg`
- `capex.svg`
- `r-and-d.svg`
- `free-cash-flow.svg`
- `news.svg`
- `description.svg`
- `calendar.svg`
- `ai.svg`
- `alerts.svg`
- `filled-bell.svg`
- `tools.svg`
- `star.svg`, `star-selected.svg`
- `star-crossed.svg`
- `cancel-alert.svg`
- `close.svg`

## Settings

- `horizontal-crosshair.svg`
- `candlestick-chart.svg`
- `volume-chart.svg`
- `color-bars.svg`
- `alert-price-lines.svg`
- `theme-dark.svg`
- `theme-light.svg`
- `theme-system.svg`

## Analyst and stock tools

- `analyst.svg` — Analyst section heading (desktop and comparison)
- `tools-ma-7.svg` — MA(7) action in the desktop Function menu
- `tools-ma-25.svg` — MA(25) action in the desktop Function menu
- `tools-ma-99.svg` — MA(99) action in the desktop Function menu
- `tools-line.svg` — Draw price line action in the right-click chart tools menu
- `tools-rectangle.svg` — Draw a rectangle in the right-click chart tools menu
- `tools-diagonal.svg` — Draw a diagonal line in the right-click chart tools menu
- `tools-erase.svg` — Erase chart drawings in the right-click chart tools menu
- `compare.svg` — Compare-stock action in desktop watchlist search results and recents
- `server-error.svg` — AI server-error notice shown after the automatic retry fails
- `back.svg` — Back control on the phone individual stock page
- `send.svg` — Send action in AI chat input buttons
- `icon-error.svg` — Red fallback displayed whenever a requested UI icon file is missing
