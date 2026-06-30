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

  let signal = "🟡 HOLD";
let confidence = 60;

if (change > 5) confidence = 95;
else if (change > 2) confidence = 85;
else if (change < -5) confidence = 95;
else if (change < -2) confidence = 85;
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

    const url =
`https://api.coingecko.com/api/v3/coins/${coinMap[symbol]}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;

    const response = await fetch(url);

    const data = await response.json();

    const price = data.market_data.current_price.inr;

    const change = data.market_data.price_change_percentage_24h;

    let signal = "🟡 HOLD";

    if (change > 2) signal = "🟢 BUY";

    if (change < -2) signal = "🔴 SELL";

    const entry = price;
const stopLoss = price * 0.98;
const target1 = price * 1.03;
const target2 = price * 1.05;

result.innerHTML = `
<h2>${symbol}</h2>

<b>⏱️ Timeframe:</b> ${timeframe}<br>
<b>💰 Price:</b> ₹${price.toLocaleString()}<br>
<b>📊 24h Change:</b> ${change.toFixed(2)}%<br><br>

<b>🤖 AI Signal:</b> ${signal}<br><br>

<b>🎯 Entry:</b> ₹${entry.toLocaleString()}<br>
<b>🛑 Stop Loss:</b> ₹${Math.round(stopLoss).toLocaleString()}<br>
<b>🎯 Target 1:</b> ₹${Math.round(target1).toLocaleString()}<br>
<b>🚀 Target 2:</b> ₹${Math.round(target2).toLocaleString()}
`;

  } catch (e) {

    result.innerHTML = "❌ Failed to load data.";

  }

}
