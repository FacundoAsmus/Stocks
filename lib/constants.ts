export const POPULAR_STOCKS = [
  { symbol: "AAPL", description: "Apple Inc." },
  { symbol: "MSFT", description: "Microsoft Corp." },
  { symbol: "NVDA", description: "NVIDIA Corp." },
  { symbol: "AMZN", description: "Amazon.com Inc." },
  { symbol: "GOOGL", description: "Alphabet Inc." },
  { symbol: "META", description: "Meta Platforms Inc." },
  { symbol: "TSLA", description: "Tesla Inc." },
  { symbol: "BRK.B", description: "Berkshire Hathaway Inc." },
  { symbol: "^GSPC", description: "S&P 500 Index" },
  { symbol: "^IXIC", description: "Nasdaq Composite Index" },
  { symbol: "^DJI", description: "Dow Jones Industrial Average" }
];

export const MAJOR_INDICES = [
  { symbol: "^GSPC", displaySymbol: "SPX", description: "S&P 500 Index", type: "Index" },
  { symbol: "^IXIC", displaySymbol: "IXIC", description: "Nasdaq Composite Index", type: "Index" },
  { symbol: "^DJI", displaySymbol: "DJI", description: "Dow Jones Industrial Average", type: "Index" },
  { symbol: "SPX", displaySymbol: "SPX", description: "S&P 500 Index", type: "Index" },
  { symbol: "NDX", displaySymbol: "NDX", description: "Nasdaq 100 Index", type: "Index" }
];

export const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "^GSPC"];

export const MARKET_BAR_SYMBOLS = [
  "^GSPC",
  "^IXIC",
  "GLD",
  "SMH",
  "AAPL",
  "NVDA",
  "MSFT",
  "META",
  "AMZN",
  "GOOGL"
];

export const MARKET_MOVER_FALLBACK_SYMBOLS = [
  "NVDA",
  "AMD",
  "AVGO",
  "TSLA",
  "AAPL",
  "MSFT",
  "META",
  "AMZN",
  "GOOGL",
  "NFLX",
  "PLTR",
  "COIN",
  "MSTR",
  "SMCI",
  "ARM",
  "CRWD",
  "SHOP",
  "UBER",
  "LLY",
  "JPM",
  "XOM",
  "GLD",
  "SLV",
  "QQQ",
  "SPY",
  "DIA",
  "IWM",
  "SMH",
  "SOXX",
  "TLT"
];
