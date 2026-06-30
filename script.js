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
