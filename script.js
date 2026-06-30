function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  let ema = prices[0];

  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }

  return ema;
}

function calculateSignal(prices) {
  const ema5 = calculateEMA(prices, 5);
  const ema13 = calculateEMA(prices, 13);

  let trend = "🟡 SIDEWAYS";

if (signal === "🟢 BUY") {
    trend = "🟢 BULLISH";
}

if (signal === "🔴 SELL") {
    trend = "🔴 BEARISH";
}

  if (ema5 > ema13) {
    signal = "🟢 BUY";
  } else if (ema5 < ema13) {
    signal = "🔴 SELL";
  }

  return {
    ema5,
    ema13,
    signal
  };
}
const coinMap = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple"
};

async function startTrading() {

  const symbol = document.getElementById("symbol").value.toUpperCase().trim();
  const timeframe = document.getElementById("timeframe").value;
  const result = document.getElementById("result");

  if (!coinMap[symbol]) {
    result.innerHTML = "❌ Supported: BTC, ETH, SOL, BNB, XRP";
    return;
  }

  result.innerHTML = "⏳ Loading...";

  try {

    const pair = symbol + "USDT";

const url =
`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${timeframe}&limit=30`;

    const response = await fetch(url);
    const data = await response.json();
const prices = data.map(candle => Number(candle[4]));

const price = prices[prices.length - 1];

const signalData = calculateSignal(prices);

const signal = signalData.signal;
const ema5 = signalData.ema5;
const ema13 = signalData.ema13;
    


    let confidence = 80;
let trend = "🟡 SIDEWAYS";

if (signal === "🟢 BUY") {
    trend = "🟢 BULLISH";
} else if (signal === "🔴 SELL") {
    trend = "🔴 BEARISH";
  }
if (signal === "🟢 BUY") {
    confidence = Math.min(95, Math.round((ema5 / ema13) * 100));
} else if (signal === "🔴 SELL") {
    confidence = Math.min(95, Math.round((ema13 / ema5) * 100));
}

    const entry = price;
const stopLoss = signal === "🟢 BUY" ? price * 0.98 : price * 1.02;
const target1 = signal === "🟢 BUY" ? price * 1.03 : price * 0.97;
const target2 = signal === "🟢 BUY" ? price * 1.05 : price * 0.95;
const target3 = signal === "🟢 BUY" ? price * 1.08 : price * 0.92;

const risk = Math.abs(entry - stopLoss);
const reward = Math.abs(target1 - entry);

const rr = (reward / risk).toFixed(2);
result.innerHTML = `
<h2>${symbol}</h2>

<b>⏱️ Timeframe:</b> ${timeframe}<br>
<b>💰 Price:</b> ₹${price.toLocaleString()}<br>
<br><b>🏆 Target 3:</b> ₹${Math.round(target3).toLocaleString()}<br>
<b>⚖️ Risk / Reward:</b> 1 : ${rr}
<b>📈 EMA 5:</b> ${ema5.toFixed(2)}<br>
<b>📉 EMA 13:</b> ${ema13.toFixed(2)}<br><br>
<b>🤖 AI Signal:</b> ${signal}<br>
<b>📈 Market Trend:</b> ${trend}<br>
<b>⭐ Confidence:</b> ${confidence}%<br><br>
<b>🎯 Entry:</b> ₹${entry.toLocaleString()}<br>
<b>🛑 Stop Loss:</b> ₹${Math.round(stopLoss).toLocaleString()}<br>
<b>🎯 Target 1:</b> ₹${Math.round(target1).toLocaleString()}<br>
<b>🚀 Target 2:</b> ₹${Math.round(target2).toLocaleString()}
`;

  } catch (e) {

    result.innerHTML = "❌ Failed to load data.";

  }

}
setInterval(() => {
    const symbol = document.getElementById("symbol").value.trim();

    if (symbol !== "") {
        startTrading();
    }
}, 10000);
