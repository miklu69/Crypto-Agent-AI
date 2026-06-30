function calculateEMA(prices, period) {
    if (prices.length < period) return null;

    const multiplier = 2 / (period + 1);

    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
        ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
}

function generateSignal(prices) {
    const ema5 = calculateEMA(prices, 5);
    const ema13 = calculateEMA(prices, 13);

    if (!ema5 || !ema13) {
        return {
            signal: "Loading...",
            ema5: 0,
            ema13: 0
        };
    }

    let signal = "🟡 HOLD";

    if (ema5 > ema13) {
        signal = "🟢 BUY";
    } else if (ema5 < ema13) {
        signal = "🔴 SELL";
    }

    return {
        signal,
        ema5,
        ema13
    };
}
