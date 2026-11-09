// The 📈 Plan tab: the N-day plan the Pi worked out (src/horizon.js), what to
// do in the next 8 hours, how the best plans compare with earning the most
// every block and with keeping to the skill that earns now, and each plan
// step by step.

import { itemName } from "./game-data.js";
import { esc, shortCoins } from "./format.js";
import { horizonOptions, horizonState, markHorizonSeen } from "./horizon-sync.js";

const DAY_CHOICES = [7, 14, 30, 60, 90];
const LEVEL_DAY_CHOICES = [0, 3, 7, 14, 30];

const coins = (n) => (n < 0 ? "−" : "") + shortCoins(Math.abs(n));
const signed = (n) => (n >= 0 ? "+" : "−") + shortCoins(Math.abs(n));
const skillLabel = (hrid) => {
    const name = String(hrid || "").split("/").pop();
    return name.charAt(0).toUpperCase() + name.slice(1);
};
const dayText = (d) => {
    const rounded = Math.round(d * 3) / 3;
    const whole = Math.floor(rounded + 1e-9);
    const third = Math.round((rounded - whole) * 3);
    return third ? `${whole}${third === 1 ? "⅓" : "⅔"}` : String(whole);
};
function ago(ms) {
    if (!ms) return "—";
    const minutes = Math.round((Date.now() - ms) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 90) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}
function inTime(ms) {
    const minutes = Math.round((ms - Date.now()) / 60000);
    if (minutes <= 0) return "now";
    if (minutes < 90) return `in ${minutes} min`;
    return `in ${Math.round(minutes / 60)} h`;
}
const teaText = (teas) => (teas?.length ? teas.map((t) => esc(itemName(t))).join(", ") : "no teas");

function settingsHtml(settings) {
    const o = horizonOptions(settings);
    const option = (value, label, current) => `<option value="${value}" ${Number(current) === value ? "selected" : ""}>${label}</option>`;
    return `<div class="mwia-settings">
      <label title="How far ahead the plan looks.">Days <select data-setting="horizonDays">${DAY_CHOICES.map((d) => option(d, `${d} days`, o.days)).join("")}</select></label>
      <label title="Levels can't be sold, so the plan counts what the character can earn a day at the end, this many times, on top of what it is worth. With 0 a plan never trains near its end.">Levels worth <select data-setting="horizonLevelDays">${LEVEL_DAY_CHOICES.map((d) => option(d, d ? `${d} days of income` : "nothing", o.levelDays)).join("")}</select></label>
      <button class="mwia-btn" data-action="horizon-run" title="Send your character to the Pi now and have it work the plan out (it takes the Pi up to a minute or two).">▶ Plan now</button>
    </div>`;
}

function statusHtml(st, settings) {
    const lines = [];
    const plan = st.plan;
    if (plan) {
        const o = horizonOptions(settings);
        const changed = plan.options && (plan.options.days !== o.days || plan.options.levelDays !== o.levelDays);
        lines.push(`Worked out ${ago(plan.at)} (${Math.round((plan.ms || 0) / 100) / 10} s on the Pi, ${plan.tried} plans tried) from your character as it was ${ago(plan.snapshotAt)}${changed ? ` – <b>with other settings</b> (${plan.options.days} days, levels worth ${plan.options.levelDays} days): tap ▶ Plan now` : ""}.`);
    }
    if (st.waiting) lines.push(`<span class="mwia-warn">⏳ The Pi is working the plan out…</span>`);
    else if (st.status?.running) lines.push(`<span class="mwia-warn">⏳ The Pi is working the plan out…</span>`);
    else if (st.status?.next) lines.push(`Next plan ${inTime(st.status.next)}.`);
    if (st.status?.error) lines.push(`<span class="mwia-bad">The Pi's last try failed: ${esc(st.status.error)}</span>`);
    if (st.error) lines.push(`<span class="mwia-bad">${esc(st.error)}</span>`);
    return lines.length ? `<p class="mwia-dim">${lines.join(" ")}</p>` : "";
}

function firstHtml(plan, best) {
    const first = best.first;
    if (!first?.jobs?.length) return `<p>Nothing pays right now – the plan has no job for the next ${plan.options.blockHours} hours.</p>`;
    const jobs = first.jobs.slice().sort((x, y) => y.hours - x.hours);
    const rows = jobs.map((j) => `<li><b>${esc(j.name)}</b> (${skillLabel(j.skill)}) – ${Math.round(j.hours * 10) / 10} h, about ${j.actions.toLocaleString("en-US")} actions, ${teaText(j.teas)}; ${coins(j.goldPerHour)}/h, ${j.xpPerHour.toLocaleString("en-US")} XP/h</li>`).join("");
    const buys = best.purchases.filter((x) => x.day === 0).map((x) => `<li>🛠 ${x.owned ? "Put on" : "Buy"} <b>${esc(itemName(x.itemHrid))}</b>${x.owned ? " (you have it)" : ` for ${coins(x.price)}`}${x.sold ? `, sell ${esc(itemName(x.sold))} (${coins(x.resale)})` : ""}</li>`).join("");
    const idle = first.idle > 0.1 ? `<li class="mwia-dim">${Math.round(first.idle * 10) / 10} h left: your coins or the market don't carry more.</li>` : "";
    return `<p><b>The next ${plan.options.blockHours} hours:</b></p><ul>${buys}${rows}${idle}</ul>`;
}

// The best plan against the two to compare with, in one sentence each.
function compareHtml(plan) {
    const best = plan.plans[plan.best];
    const out = [];
    const against = (index, label) => {
        if (index < 0 || index === plan.best) return;
        const other = plan.plans[index];
        const diff = (n) => (n >= 0 ? `${coins(n)} more` : `${coins(-n)} less`);
        out.push(`${label} (<i>${esc(other.name)}</i>): ${diff(best.gain - other.gain)} in ${plan.options.days} days, ${diff(best.endRate - other.endRate)} a day at the end`);
    };
    against(plan.only, "Against keeping to what earns now");
    against(plan.baseline, "Against earning the most every block");
    if (plan.cautiousBest !== null && plan.cautiousBest !== undefined) out.push(`<span class="mwia-warn">With cautious prices (buying at the week's upper quartile, selling at its lower) <i>${esc(plan.plans[plan.cautiousBest].name)}</i> does best – the choice is close.</span>`);
    return out.length ? `<ul>${out.map((line) => `<li>${line}</li>`).join("")}</ul>` : "";
}

function sparkline(values) {
    if (!values?.length || values.length < 2) return "";
    const low = Math.min(...values);
    const high = Math.max(...values);
    const span = high - low || 1;
    const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - low) / span) * 26}`).join(" ");
    return `<svg class="mwia-horizon-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-label="Worth day by day"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
}

function stepsHtml(p) {
    const segs = p.segments.map((s) => {
        const xp = Object.entries(s.xp).map(([skill, amount]) => `${skillLabel(skill)} ${shortCoins(amount)} XP`).join(", ");
        const also = s.also.length ? ` <span class="mwia-dim">(also ${s.also.slice(0, 4).map(esc).join(", ")}${s.also.length > 4 ? ", …" : ""} when the first can't fill the hours)</span>` : "";
        return `<tr><td>Day ${dayText(s.from)}–${dayText(s.to)}</td><td><b>${esc(s.name)}</b>${s.skill ? ` (${skillLabel(s.skill)})` : ""}${also}<br><span class="mwia-dim">${teaText(s.teas)}${s.tool ? ` · ${esc(itemName(s.tool))}` : ""}</span></td><td class="mwia-num">${coins(s.gold)}</td><td>${xp}</td></tr>`;
    }).join("");
    const buys = p.purchases.map((x) => `<li>Day ${dayText(x.day)}: ${x.owned ? "put on" : "buy"} ${esc(itemName(x.itemHrid))}${x.owned ? "" : ` for ${coins(x.price)}`}${x.sold ? `, sell ${esc(itemName(x.sold))} for ${coins(x.resale)}` : ""} (+${coins(x.gainPerDay)}/day)</li>`).join("");
    const levels = Object.entries(p.levels).map(([skill, [from, to]]) => `${skillLabel(skill)} ${from} → ${to}`).join(", ");
    return `<table class="mwia-horizon-steps"><thead><tr><th>When</th><th>Job</th><th>Gold</th><th>XP</th></tr></thead><tbody>${segs}</tbody></table>
      ${buys ? `<p><b>Tools</b></p><ul>${buys}</ul>` : ""}
      ${levels ? `<p><b>Levels</b>: ${levels}</p>` : ""}
      <p class="mwia-dim">Worth day by day: ${sparkline(p.worthByDay)}</p>`;
}

function plansHtml(plan) {
    return plan.plans.map((p, i) => {
        const tags = [i === plan.best ? "📈 best" : "", i === plan.baseline ? "earn the most" : "", i === plan.only ? "what earns now" : ""].filter(Boolean).join(" · ");
        const cautious = p.cautious ? `cautious ${signed(p.cautious.gain)}` : "";
        return `<details class="mwia-horizon-plan" ${i === plan.best ? "open" : ""}><summary><b>${esc(p.name)}</b>${tags ? ` <span class="mwia-dim">${tags}</span>` : ""}<br>
          <span class="mwia-num">${signed(p.gain)}</span> in ${plan.options.days} days · ${coins(p.endRate)}/day at the end · score ${coins(p.score)}${cautious ? ` · <span class="mwia-dim">${cautious}</span>` : ""}</summary>
          ${stepsHtml(p)}</details>`;
    }).join("");
}

function aboutHtml(plan) {
    const o = plan.options;
    const unknown = plan.unknownSales?.length ? ` No sales are known yet for ${plan.unknownSales.slice(0, 5).map((h) => esc(itemName(h))).join(", ")}${plan.unknownSales.length > 5 ? ", …" : ""}: the market takes any number of them.` : "";
    return `<details><summary class="mwia-dim">How the plan is worked out</summary><p class="mwia-dim">
      Time goes in ${o.blockHours}-hour blocks. In each the character runs the job that earns the most – or, while a plan trains a skill to a level where a job or tool unlocks, that skill's job with the most gold or the fastest XP; when your coins or the market cut a job short, the rest of the block goes to the next best one queued behind it (two jobs at most, none under an hour).
      Prices are the usual ones, not today's: the week's median ask to buy and to list at (never above 1.5× the usual bid), the median bid as the floor.
      The market takes ${Math.round(o.marketShare * 100)}% of what sells of an item a day: the rest waits in stock and sells first in later blocks; the same share caps what you can buy of a material.
      A better tool for the skill you work is bought when its extra gold over the days left pays for it (less what it sells for again); the old one is sold at the bid.
      Worth = coins + tools at the bid + stock (at the bid for up to a day of sales, the shop price for the rest). The score adds ${o.levelDays} days of what the character earns a day at the end, so levels count.
      Plans compared: earning the most every block, keeping to one skill, and up to two training phases before earning. Gathering and production only – no Enhancing, Alchemy or combat yet, and materials are bought, not gathered yourself.${unknown}
    </p></details>`;
}

export function renderHorizon(settings) {
    const st = horizonState();
    let html = `<h3>📈 Plan ${horizonOptions(settings).days} days ahead</h3>`;
    if (!st.linked) return html + `<p>The plan is worked out on your own Pi, a few times a day: link this browser to it first (the price box in the marketplace, <i>Chart and details</i>; setup in <code>pi/README.md</code>).</p>`;
    if (st.piOk && !st.makesPlans) return html + `<p>Your Pi doesn't make plans: it needs <code>MWIA_ORDERS=1</code> in <code>pi/.env</code> and the newest server (<code>git pull && docker compose up -d --build</code> in <code>pi/</code>).</p>`;
    html += settingsHtml(settings) + statusHtml(st, settings);
    const plan = st.plan;
    if (!plan?.plans?.length) return html + `<p>No plan yet. ${st.makesPlans ? "Your character goes to the Pi with the next sync (every 15 minutes) and the plan comes 10 minutes later – or tap <b>▶ Plan now</b>." : "Waiting for the Pi…"}</p>`;
    markHorizonSeen();
    const best = plan.plans[plan.best];
    html += `<div class="mwia-horizon-best"><p>📈 <b>${esc(best.name)}</b>: ${signed(best.gain)} in ${plan.options.days} days, then ${coins(best.endRate)}/day.</p>${firstHtml(plan, best)}${compareHtml(plan)}</div>`;
    html += `<h3>Plans</h3>${plansHtml(plan)}${aboutHtml(plan)}`;
    return html;
}
