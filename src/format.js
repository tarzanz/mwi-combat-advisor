// Coin amounts typed by the user.

// "2M", "500k", "1.5m", "1,5M", "2 000 000" -> number of coins (null if unreadable).
export function parseCoins(text) {
    const cleaned = String(text).trim().toLowerCase().replace(/\s+/g, "");
    const match = cleaned.match(/^(\d+(?:[.,]\d+)?|\d{1,3}(?:[.,]\d{3})+)([kmb]?)$/);
    if (!match) return null;
    const [, number, suffix] = match;
    const value = suffix
        ? Number(number.replace(",", "."))
        : Number(number.replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", "."));
    const factor = { "": 1, k: 1e3, m: 1e6, b: 1e9 }[suffix];
    return Number.isFinite(value) ? Math.round(value * factor) : null;
}

export function coinsInput(n) {
    if (n >= 1e9 && n % 1e7 === 0) return n / 1e9 + "B";
    if (n >= 1e6 && n % 1e4 === 0) return n / 1e6 + "M";
    if (n >= 1e3 && n % 10 === 0) return n / 1e3 + "k";
    return String(n);
}

// 950 / 12.5k / 1.27M / 2.10B: short enough for a line under a button row.
export function shortCoins(n) {
    const abs = Math.abs(n);
    const fixed = (value, digits) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    if (abs >= 1e9) return fixed(n / 1e9, 2) + "B";
    if (abs >= 1e6) return fixed(n / 1e6, abs >= 1e7 ? 1 : 2) + "M";
    if (abs >= 1e4) return fixed(n / 1e3, abs >= 1e5 ? 0 : 1) + "k";
    return Math.round(n).toLocaleString("en-US");
}

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
