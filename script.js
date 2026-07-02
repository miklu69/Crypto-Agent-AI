/**
 * Crypto Signal AI — script.js
 * Fetches real-time candlestick data from the Binance public API,
 * computes EMA 5 and EMA 13, and generates an AI trading signal.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Binance Klines endpoint (no API key required) */
const BINANCE_API_URL = "https://api.binance.com/api/v3/klines";

/** Number of candles to fetch from Binance */
const CANDLE_LIMIT = 50;

/** EMA periods */
const EMA_SHORT  = 5;
const EMA_LONG   = 13;

/** If the EMA percentage difference is below this threshold → HOLD */
const HOLD_THRESHOLD_PCT = 0.1;

// ─── DOM References ───────────────────────────────────────────────────────────

const coinSelect      = document.getElementById("coin-select");
const timeframeSelect = document.getElementById("timeframe-select");
const analyzeBtn      = document.getElementById("analyze-btn");
const errorBanner     = document.getElementById("error-banner");
const errorMessage    = document.getElementById("error-message");
const errorCloseBtn   = document.getElementById("error-close-btn");
const emptyState      = document.getElementById("empty-state");
const resultsSection  = document.getElementById("results-section");

const elCurrentPrice  = document.getElementById("current-price");
const elEma5          = document.getElementById("ema5-value");
const elEma13         = document.getElementById("ema13-value");
const elSignalValue   = document.getElementById("signal-value");
const elTrendValue    = document.getElementById("trend-value");
const elLastUpdated   = document.getElementById("last-updated");
const elSignalPair    = document.getElementById("signal-pair");
const elSignalTfm     = document.getElementById("signal-timeframe");
const elSignalBanner  = document.getElementById("signal-banner");
const elEma5Pill      = document.getElementById("ema5-pill");
const elEma13Pill     = document.getElementById("ema13-pill");
const elEmaBar        = document.getElementById("ema-bar");
const elEmaBarTrack   = document.getElementById("ema-bar-track");
const elSpreadPct     = document.getElementById("spread-pct");
const elAnalysisNote  = document.getElementById("analysis-note");
const elTradeEntry    = document.getElementById("trade-entry");
const elTradeSL       = document.getElementById("trade-sl");
const elTradeTP       = document.getElementById("trade-tp");
const elTradeSlPct    = document.getElementById("trade-sl-pct");
const elTradeTpPct    = document.getElementById("trade-tp-pct");
const elSignalPair2   = document.getElementById("signal-pair-2");
const elSignalValue2  = document.getElementById("signal-value-2");
const elTrendValue2   = document.getElementById("trend-value-2");
const elExitPrice     = document.getElementById("exit-price");
const elTarget1       = document.getElementById("target1");
const elTarget3       = document.getElementById("target3");
const elT1Pct         = document.getElementById("t1-pct");
const elT3Pct         = document.getElementById("t3-pct");
const elRiskReward    = document.getElementById("risk-reward");
const elConfidencePct = document.getElementById("confidence-pct");
const elConfidenceBar = document.getElementById("confidence-bar");
const elRecommendation= document.getElementById("recommendation");
const elHistoryList   = document.getElementById("signal-history-list");

// ─── EMA Calculation ──────────────────────────────────────────────────────────

/**
 * Calculates the Exponential Moving Average for a given period.
 * Uses the standard smoothing multiplier: k = 2 / (period + 1)
 *
 * @param {number[]} closes  - Array of closing prices (oldest first)
 * @param {number}   period  - EMA period (e.g. 5 or 13)
 * @returns {number}           The final EMA value
 */
function calculateEMA(closes, period) {
  if (!closes || closes.length < period) {
    throw new Error(`Not enough data to calculate EMA ${period}. Need at least ${period} candles.`);
  }

  const k = 2 / (period + 1);

  // Seed the EMA with the SMA of the first `period` candles
  let ema = closes.slice(0, period).reduce((sum, price) => sum + price, 0) / period;

  // Roll forward using the EMA formula for the remaining prices
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }

  return ema;
}

// ─── Trading Signal Logic ─────────────────────────────────────────────────────

/**
 * Derives an AI signal and market trend from EMA 5 and EMA 13 values.
 *
 * Rules:
 *  - If pct difference < HOLD_THRESHOLD_PCT → HOLD / SIDEWAYS
 *  - If EMA5 > EMA13                        → BUY  / BULLISH
 *  - If EMA5 < EMA13                        → SELL / BEARISH
 *
 * @param {number} ema5   - EMA 5 value
 * @param {number} ema13  - EMA 13 value
 * @returns {{ signal: string, trend: string, pctDiff: number }}
 */
function deriveSignal(ema5, ema13) {
  // Percentage difference between EMA5 and EMA13 (relative to EMA13)
  const pctDiff = Math.abs((ema5 - ema13) / ema13) * 100;

  if (pctDiff < HOLD_THRESHOLD_PCT) {
    return { signal: "HOLD", trend: "SIDEWAYS", pctDiff };
  }

  if (ema5 > ema13) {
    return { signal: "BUY", trend: "BULLISH", pctDiff };
  }

  return { signal: "SELL", trend: "BEARISH", pctDiff };
}

// ─── Trade Level Calculation ──────────────────────────────────────────────────

/**
 * Calculates entry, stop loss, and target price levels based on signal direction.
 *
 * BUY:  Stop Loss = entry - 2%,  Target = entry + 4%
 * SELL: Stop Loss = entry + 2%,  Target = entry - 4%
 * HOLD: No directional trade — levels not applicable.
 *
 * @param {string} signal      - "BUY" | "SELL" | "HOLD"
 * @param {number} entryPrice  - Current market price used as entry
 * @returns {{ entry: number, stopLoss: number|null, target: number|null }}
 */
function calculateTradeLevels(signal, entryPrice) {
  if (signal === "BUY") {
    return {
      entry:    entryPrice,
      stopLoss: entryPrice * 0.98,
      target:   entryPrice * 1.04,
    };
  }
  if (signal === "SELL") {
    return {
      entry:    entryPrice,
      stopLoss: entryPrice * 1.02,
      target:   entryPrice * 0.96,
    };
  }
  return { entry: entryPrice, stopLoss: null, target: null };
}

// ─── Confidence & Recommendation ──────────────────────────────────────────────

/**
 * Calculates a confidence percentage from the EMA spread.
 * Larger spread → more decisive signal → higher confidence. Capped at 95%.
 *
 * @param {number} pctDiff - Absolute EMA percentage spread
 * @returns {number} Confidence 5–95
 */
function calculateConfidence(pctDiff) {
  return Math.min(Math.max((pctDiff / 0.5) * 95, 5), 95);
}

/**
 * Returns a one-line actionable recommendation based on signal + confidence tier.
 *
 * @param {string} signal     - "BUY" | "SELL" | "HOLD"
 * @param {number} confidence - 5–95
 * @returns {string}
 */
function getRecommendation(signal, confidence) {
  const tier = confidence >= 70 ? "high" : confidence >= 40 ? "medium" : "low";
  const recs = {
    BUY: {
      high:   "Strong upward momentum. EMA crossover confirms bullish bias. Consider entering long with defined stop.",
      medium: "Moderate bullish signal. EMA5 above EMA13. Wait for candle close confirmation before entering.",
      low:    "Weak bullish divergence. Narrow spread — treat as speculative. Use tight stop-loss if entering.",
    },
    SELL: {
      high:   "Strong downward pressure. EMA crossover confirms bearish bias. Consider short entry with defined stop.",
      medium: "Moderate bearish signal. EMA5 below EMA13. Await confirmation before committing to short.",
      low:    "Weak bearish divergence. Narrow spread — speculative. Use tight stop-loss if entering.",
    },
    HOLD: {
      high:   "EMAs converging tightly. No clear directional edge. Stay flat and wait for a clean breakout.",
      medium: "Market consolidating. EMA spread too narrow for a directional trade. Monitor for breakout.",
      low:    "Indecisive market. EMAs nearly flat. No trade recommended — wait for momentum to build.",
    },
  };
  return recs[signal][tier];
}

// ─── Signal History ────────────────────────────────────────────────────────────

/** In-memory signal history (newest first, max 8 entries) */
const signalHistory = [];
const HISTORY_MAX = 8;

/**
 * Adds an entry to signal history and re-renders the history list.
 *
 * @param {{ signal: string, symbol: string, interval: string, price: number }} entry
 */
function addToHistory({ signal, symbol, interval, price }) {
  const coin = symbolToName(symbol);
  const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  signalHistory.unshift({ signal, coin, tf: intervalLabel(interval), price, time });
  if (signalHistory.length > HISTORY_MAX) signalHistory.pop();
  renderHistory();
}

/** Renders the signal history list into the DOM */
function renderHistory() {
  if (!elHistoryList) return;
  if (signalHistory.length === 0) {
    elHistoryList.innerHTML = '<div class="history-empty">No signals yet — run your first analysis above.</div>';
    return;
  }
  elHistoryList.innerHTML = signalHistory.map(h => `
    <div class="history-item">
      <span class="hist-chip ${h.signal.toLowerCase()}">${h.signal}</span>
      <span class="hist-pair">${h.coin}/USDT</span>
      <span class="hist-tf">${h.tf}</span>
      <span class="hist-price">$${formatPrice(h.price)}</span>
      <span class="hist-time">${h.time}</span>
    </div>
  `).join('');
}

// ─── Candlestick Background ────────────────────────────────────────────────────

/**
 * Generates and injects a realistic SVG candlestick chart as the page background.
 * Uses a seeded pseudo-random sequence so the pattern is consistent on every load.
 */
function renderCandlestickBackground() {
  const container = document.getElementById('chart-bg');
  if (!container) return;

  let seed = 98765;
  function rand(min, max) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return min + ((seed >>> 0) / 0xffffffff) * (max - min);
  }

  const W = 1440, H = 700, N = 44;
  const spacing = W / N;
  const bodyW = Math.floor(spacing * 0.52);

  let price = 300;
  const candles = [];
  for (let i = 0; i < N; i++) {
    const open  = price;
    const close = Math.max(60, Math.min(620, open + rand(-20, 28)));
    candles.push({
      open, close,
      highPrice: Math.max(open, close) + rand(4, 22),
      lowPrice:  Math.min(open, close) - rand(4, 18),
    });
    price = close;
  }

  const allP  = candles.flatMap(c => [c.highPrice, c.lowPrice]);
  const minP  = Math.min(...allP) - 40;
  const maxP  = Math.max(...allP) + 40;
  const range = maxP - minP;
  const toY   = p => H * 0.92 - ((p - minP) / range) * H * 0.82;

  // Build two shape arrays — green candles and red candles
  // Applying one SVG filter per color group (2 total) is far more efficient
  // than applying a filter per individual candle element (N total)
  const greenShapes = [];
  const redShapes   = [];

  candles.forEach((c, i) => {
    const cx      = spacing * i + spacing / 2;
    const isGreen = c.close >= c.open;
    const color   = isGreen ? '#00e676' : '#ff4d4f';
    const bodyTop = Math.min(toY(c.open), toY(c.close));
    const bodyH   = Math.max(Math.abs(toY(c.close) - toY(c.open)), 2);
    const wickTop = toY(c.highPrice);
    const wickBot = toY(c.lowPrice);
    const target  = isGreen ? greenShapes : redShapes;

    target.push(
      `<line x1="${cx.toFixed(1)}" y1="${wickTop.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${wickBot.toFixed(1)}" stroke="${color}" stroke-width="1.5" stroke-opacity="0.75"/>`,
      `<rect x="${(cx - bodyW / 2).toFixed(1)}" y="${bodyTop.toFixed(1)}" width="${bodyW}" height="${bodyH.toFixed(1)}" fill="${color}" fill-opacity="0.88" rx="2"/>`
    );
  });

  // SVG glow filters — feGaussianBlur + feMerge gives a cheap additive glow.
  // Two filters total regardless of candle count.
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">`,
    `<defs>`,
    `  <filter id="glow-g" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="linearRGB">`,
    `    <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b"/>`,
    `    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>`,
    `  </filter>`,
    `  <filter id="glow-r" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="linearRGB">`,
    `    <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b"/>`,
    `    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>`,
    `  </filter>`,
    `</defs>`,
    `<g filter="url(#glow-g)">${greenShapes.join('')}</g>`,
    `<g filter="url(#glow-r)">${redShapes.join('')}</g>`,
    `</svg>`,
  ];

  container.innerHTML = svg.join('');
}

// ─── Binance API Fetch ────────────────────────────────────────────────────────

/**
 * Fetches candlestick data from Binance's public klines endpoint.
 *
 * @param {string} symbol    - Trading pair symbol (e.g. "BTCUSDT")
 * @param {string} interval  - Chart interval (e.g. "15m", "1h")
 * @returns {Promise<number[]>} Array of closing prices (oldest first)
 * @throws {Error} On network failure or non-2xx HTTP response
 */
async function fetchClosePrices(symbol, interval) {
  const url = new URL(BINANCE_API_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(CANDLE_LIMIT));

  let response;
  try {
    response = await fetch(url.toString());
  } catch (networkErr) {
    throw new Error(
      "Network error: could not reach Binance. Check your internet connection and try again."
    );
  }

  if (!response.ok) {
    // Binance returns JSON errors with a "msg" field
    let hint = "";
    try {
      const errJson = await response.json();
      hint = errJson.msg ? ` — ${errJson.msg}` : "";
    } catch (_) {
      /* ignore parse failure */
    }
    throw new Error(`Binance API error ${response.status}${hint}.`);
  }

  const candles = await response.json();

  if (!Array.isArray(candles) || candles.length === 0) {
    throw new Error("Binance returned no data. The symbol or interval may be unavailable.");
  }

  // Each kline entry: [openTime, open, high, low, close, volume, ...]
  // Index 4 is the close price (string from Binance → convert to number)
  return candles.map((kline) => parseFloat(kline[4]));
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

/**
 * Formats a price for display, choosing decimal places by magnitude.
 *
 * @param {number} price
 * @returns {string}
 */
function formatPrice(price) {
  if (price >= 10000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 100)   return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  if (price >= 1)     return price.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return price.toLocaleString("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 6 });
}

/**
 * Extracts the readable coin name from a Binance symbol (e.g. "BTCUSDT" → "BTC").
 *
 * @param {string} symbol
 * @returns {string}
 */
function symbolToName(symbol) {
  return symbol.replace(/USDT$/, "");
}

/**
 * Returns a human-readable label for a Binance interval.
 *
 * @param {string} interval
 * @returns {string}
 */
function intervalLabel(interval) {
  const labels = { "1m": "1 Min", "5m": "5 Min", "15m": "15 Min", "30m": "30 Min", "1h": "1 Hour", "4h": "4 Hour", "1d": "1 Day" };
  return labels[interval] || interval;
}

// ─── UI State Helpers ─────────────────────────────────────────────────────────

/** Sets the Analyze button into loading state */
function setLoading(isLoading) {
  if (isLoading) {
    analyzeBtn.classList.add("loading");
    analyzeBtn.disabled = true;
  } else {
    analyzeBtn.classList.remove("loading");
    analyzeBtn.disabled = false;
  }
}

/** Shows a friendly error message in the error banner */
function showError(message) {
  errorMessage.textContent = message;
  errorBanner.classList.remove("hidden");
}

/** Hides the error banner */
function hideError() {
  errorBanner.classList.add("hidden");
  errorMessage.textContent = "";
}

/** Shows the results section, hides the empty state */
function showResults() {
  emptyState.classList.add("hidden");
  resultsSection.classList.remove("hidden");
}

/** Shows the empty state, hides the results section */
function showEmptyState() {
  emptyState.classList.remove("hidden");
  resultsSection.classList.add("hidden");
}

// ─── UI Rendering ─────────────────────────────────────────────────────────────

/**
 * Renders all result elements with the computed signal data.
 *
 * @param {object} params
 * @param {string} params.symbol      - e.g. "BTCUSDT"
 * @param {string} params.interval    - e.g. "15m"
 * @param {number} params.currentPrice
 * @param {number} params.ema5
 * @param {number} params.ema13
 * @param {string} params.signal      - "BUY" | "SELL" | "HOLD"
 * @param {string} params.trend       - "BULLISH" | "BEARISH" | "SIDEWAYS"
 * @param {number} params.pctDiff     - Percentage spread between EMA5 and EMA13
 */
function renderResults({ symbol, interval, currentPrice, ema5, ema13, signal, trend, pctDiff }) {
  const signalLower = signal.toLowerCase();
  const trendLower  = trend.toLowerCase();
  const coin        = symbolToName(symbol);

  // ── Signal Header ──
  elSignalPair.textContent = `${coin} / USDT`;
  elSignalTfm.textContent  = intervalLabel(interval);

  elSignalValue.textContent = signal;
  elSignalValue.className   = `sig-val ${signalLower}`;

  elTrendValue.textContent = trend;
  elTrendValue.className   = `sig-trend ${trendLower}`;

  elSignalBanner.className = `card signal-card signal-${signalLower}`;

  // ── Core Metrics ──
  elCurrentPrice.textContent = `$${formatPrice(currentPrice)}`;
  elEma5.textContent  = `$${formatPrice(ema5)}`;
  elEma13.textContent = `$${formatPrice(ema13)}`;

  const ema5Above = ema5 >= currentPrice;
  elEma5Pill.textContent  = ema5Above ? "ABOVE" : "BELOW";
  elEma5Pill.className    = `pill ${ema5Above ? "above" : "below"}`;
  elEma13Pill.textContent = ema13 >= currentPrice ? "ABOVE" : "BELOW";
  elEma13Pill.className   = `pill ${ema13 >= currentPrice ? "above" : "below"}`;

  // ── Time ──
  elLastUpdated.textContent = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });

  // ── EMA Spread Bar ──
  const barPct = Math.min((pctDiff / HOLD_THRESHOLD_PCT) * 100, 100);
  // Use scaleX (GPU composited) instead of width (triggers layout reflow)
  elEmaBar.style.transform = `scaleX(${(barPct / 100).toFixed(4)})`;
  elEmaBar.className        = `ema-fill ${trendLower !== "bullish" ? trendLower : ""}`.trim();
  elEmaBarTrack.setAttribute("aria-valuenow", String(Math.round(barPct)));
  elSpreadPct.textContent = `${pctDiff.toFixed(4)}%`;

  // ── Analysis Note ──
  const notesBySignal = {
    BUY:  `EMA 5 ($${formatPrice(ema5)}) is ${pctDiff.toFixed(3)}% above EMA 13 ($${formatPrice(ema13)}), signalling upward momentum. Short-term price action is outpacing the medium-term average — a bullish crossover pattern.`,
    SELL: `EMA 5 ($${formatPrice(ema5)}) is ${pctDiff.toFixed(3)}% below EMA 13 ($${formatPrice(ema13)}), signalling downward momentum. Short-term price action is lagging the medium-term average — a bearish crossover pattern.`,
    HOLD: `EMA 5 ($${formatPrice(ema5)}) and EMA 13 ($${formatPrice(ema13)}) are within ${pctDiff.toFixed(4)}% of each other (threshold: ${HOLD_THRESHOLD_PCT}%). The market is consolidating — no clear directional edge at this time.`,
  };
  elAnalysisNote.textContent = notesBySignal[signal];

  // ── Trade Levels ──
  const levels = calculateTradeLevels(signal, currentPrice);
  elTradeEntry.textContent = `$${formatPrice(levels.entry)}`;

  if (levels.stopLoss !== null && levels.target !== null) {
    elTradeSL.textContent    = `$${formatPrice(levels.stopLoss)}`;
    elTradeTP.textContent    = `$${formatPrice(levels.target)}`;
    elTradeSlPct.textContent = signal === "BUY" ? "−2.00%" : "+2.00%";
    elTradeTpPct.textContent = signal === "BUY" ? "+4.00%" : "−4.00%";
  } else {
    elTradeSL.textContent    = "N/A";
    elTradeTP.textContent    = "N/A";
    elTradeSlPct.textContent = "";
    elTradeTpPct.textContent = "";
  }

  // ── Extended Display Fields ──
  const confidence = calculateConfidence(pctDiff);

  if (elSignalPair2) elSignalPair2.textContent = `${coin} / USDT`;

  if (elSignalValue2) {
    elSignalValue2.textContent = signal;
    elSignalValue2.className   = `rr-val bold ${signalLower}`;
  }
  if (elTrendValue2) {
    elTrendValue2.textContent = trend;
    elTrendValue2.className   = `rr-val bold ${trendLower}`;
  }

  if (elExitPrice) {
    elExitPrice.textContent = levels.target !== null ? `$${formatPrice(levels.target)}` : "N/A";
  }

  if (elTarget1) {
    const t1 = signal === "BUY" ? currentPrice * 1.02 : signal === "SELL" ? currentPrice * 0.98 : null;
    elTarget1.textContent = t1 !== null ? `$${formatPrice(t1)}` : "N/A";
    if (elT1Pct) elT1Pct.textContent = signal === "BUY" ? "+2.00%" : signal === "SELL" ? "−2.00%" : "";
  }

  if (elTarget3) {
    const t3 = signal === "BUY" ? currentPrice * 1.06 : signal === "SELL" ? currentPrice * 0.94 : null;
    elTarget3.textContent = t3 !== null ? `$${formatPrice(t3)}` : "N/A";
    if (elT3Pct) elT3Pct.textContent = signal === "BUY" ? "+6.00%" : signal === "SELL" ? "−6.00%" : "";
  }

  if (elRiskReward) {
    elRiskReward.textContent = signal !== "HOLD" ? "1 : 2  (SL −2% / T2 +4%)" : "N/A";
  }

  if (elConfidencePct) elConfidencePct.textContent = `${Math.round(confidence)}%`;
  if (elConfidenceBar) {
    // Use scaleX (GPU composited) instead of width (triggers layout reflow)
    elConfidenceBar.style.transform = `scaleX(${(confidence / 100).toFixed(4)})`;
    elConfidenceBar.className        = `conf-fill ${signalLower !== "buy" ? signalLower : ""}`.trim();
  }

  if (elRecommendation) {
    elRecommendation.textContent = getRecommendation(signal, confidence);
  }

  showResults();
}

// ─── Input Validation ─────────────────────────────────────────────────────────

/** Valid Binance symbols offered in the UI */
const VALID_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"];

/** Valid Binance intervals offered in the UI */
const VALID_INTERVALS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];

/**
 * Validates user-selected coin and timeframe.
 *
 * @param {string} symbol
 * @param {string} interval
 * @throws {Error} If validation fails
 */
function validateInputs(symbol, interval) {
  if (!symbol || !VALID_SYMBOLS.includes(symbol)) {
    throw new Error("Invalid asset selected. Please choose a valid cryptocurrency.");
  }
  if (!interval || !VALID_INTERVALS.includes(interval)) {
    throw new Error("Invalid timeframe selected. Please choose a valid timeframe.");
  }
}

// ─── Main Analysis Function ───────────────────────────────────────────────────

/**
 * Orchestrates the full analysis flow:
 * 1. Validate inputs
 * 2. Show loading state
 * 3. Fetch Binance candles
 * 4. Calculate EMA 5 and EMA 13
 * 5. Derive trading signal
 * 6. Render results
 */
async function runAnalysis() {
  const symbol   = coinSelect.value;
  const interval = timeframeSelect.value;

  hideError();
  setLoading(true);

  try {
    // 1. Validate inputs
    validateInputs(symbol, interval);

    // 2. Fetch candlestick closing prices from Binance
    const closes = await fetchClosePrices(symbol, interval);

    // 3. The most recent close is the current price
    const currentPrice = closes[closes.length - 1];

    // 4. Calculate EMA 5 and EMA 13
    const ema5  = calculateEMA(closes, EMA_SHORT);
    const ema13 = calculateEMA(closes, EMA_LONG);

    // 5. Derive AI signal and market trend
    const { signal, trend, pctDiff } = deriveSignal(ema5, ema13);

    // 6. Render results to the DOM
    renderResults({ symbol, interval, currentPrice, ema5, ema13, signal, trend, pctDiff });

    // 7. Record this signal in the history list
    addToHistory({ signal, symbol, interval, price: currentPrice });

  } catch (err) {
    showError(err.message || "An unexpected error occurred. Please try again.");
    showEmptyState();
  } finally {
    setLoading(false);
  }
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

/** Analyze button click */
analyzeBtn.addEventListener("click", runAnalysis);

/** Allow pressing Enter on either select to trigger analysis */
coinSelect.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runAnalysis();
});
timeframeSelect.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runAnalysis();
});

/** Dismiss error banner */
errorCloseBtn.addEventListener("click", hideError);

// ─── Initialise ───────────────────────────────────────────────────────────────

// Generate the fixed candlestick chart background
renderCandlestickBackground();

// Show the empty state on first load
showEmptyState();
