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
function calculateRSI(prices, period = 14) {
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const diff = prices[i] - prices[i - 1];

        if (diff >= 0) {
            gains += diff;
        } else {
            losses -= diff;
        }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}
