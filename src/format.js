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


export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
