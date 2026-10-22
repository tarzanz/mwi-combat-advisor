// Just enough statistics to say how sure we are that a change is an improvement.

// log Γ(x), Lanczos approximation.
function logGamma(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x;
    const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
    let series = 1.000000000190015;
    for (const coefficient of c) series += coefficient / ++y;
    return -tmp + Math.log((2.5066282746310005 * series) / x);
}

// Continued fraction for the incomplete beta function (Numerical Recipes).
function betaContinuedFraction(a, b, x) {
    const tiny = 1e-30;
    let c = 1;
    let d = 1 - ((a + b) * x) / (a + 1);
    if (Math.abs(d) < tiny) d = tiny;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 200; m++) {
        const m2 = 2 * m;
        let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < tiny) d = tiny;
        c = 1 + aa / c;
        if (Math.abs(c) < tiny) c = tiny;
        d = 1 / d;
        h *= d * c;
        aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
        d = 1 + aa * d;
        if (Math.abs(d) < tiny) d = tiny;
        c = 1 + aa / c;
        if (Math.abs(c) < tiny) c = tiny;
        d = 1 / d;
        const delta = d * c;
        h *= delta;
        if (Math.abs(delta - 1) < 3e-12) break;
    }
    return h;
}

// Regularised incomplete beta I_x(a, b).
function incompleteBeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2)
        ? (front * betaContinuedFraction(a, b, x)) / a
        : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

// P(T ≤ t) for Student's t with df degrees of freedom.
export function studentTCdf(t, df) {
    const tail = 0.5 * incompleteBeta(df / (df + t * t), df / 2, 0.5);
    return t > 0 ? 1 - tail : tail;
}

// How likely it is that the true mean of paired differences is above zero
// (one-sided paired t-test). null when there are too few pairs to say.
export function confidenceAboveZero(diffs) {
    const n = diffs.length;
    if (n < 2) return null;
    const mean = diffs.reduce((a, b) => a + b, 0) / n;
    const variance = diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
    if (variance <= 1e-18) return mean > 0 ? 1 : mean < 0 ? 0 : 0.5;
    return studentTCdf(mean / Math.sqrt(variance / n), n - 1);
}

// How likely it is that the true mean of a is above the true mean of b, for two
// independent samples with possibly different spreads (one-sided Welch t-test).
export function confidenceGreater(a, b) {
    const stats = (x) => {
        const mean = x.reduce((s, v) => s + v, 0) / x.length;
        return { n: x.length, mean, variance: x.reduce((s, v) => s + (v - mean) ** 2, 0) / (x.length - 1) };
    };
    if (a.length < 2 || b.length < 2) return null;
    const A = stats(a);
    const B = stats(b);
    const va = A.variance / A.n;
    const vb = B.variance / B.n;
    const diff = A.mean - B.mean;
    if (va + vb <= 1e-18) return diff > 0 ? 1 : diff < 0 ? 0 : 0.5;
    const df = (va + vb) ** 2 / ((va * va) / (A.n - 1) + (vb * vb) / (B.n - 1));
    return studentTCdf(diff / Math.sqrt(va + vb), df);
}
