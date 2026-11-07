// The skilling rooms' clear chance: exact, checked against a plain simulation of the same rules.
import { skillingBuffs, skillingRoomChance } from "../src/labyrinth-skilling.js";

let failed = 0;
const check = (name, ok, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail !== "" ? " — " + detail : ""}`);
    if (!ok) failed++;
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// Monte Carlo of the rules, written separately from the exact count.
function simulate(room, level, { efficiency = 0, speed = 0, success = 0, double = 0 } = {}, n = 40000) {
    const delta = level - room.level;
    const p = Math.min(1, Math.max(0, 0.8 * (1 + (delta >= 0 ? 0.005 : 0.01) * delta + success)));
    const tries = Math.floor(120 / ((room.skill === "enhancing" ? 8 : 10) / (1 + speed)));
    let wins = 0;
    for (let i = 0; i < n; i++) {
        let progress = 0;
        for (let t = 0; t < tries; t++) {
            const ok = Math.random() < p;
            if (room.skill === "enhancing") {
                progress = ok ? progress + (Math.random() < double ? 2 : 1) : Math.max(0, progress - 1);
                if (progress >= 5) break;
            } else if (ok) {
                progress += Math.floor(level * (1 + efficiency)) * (Math.random() < double ? 2 : 1);
                if (progress >= room.level * 10) break;
            }
        }
        if (room.skill === "enhancing" ? progress >= 5 : progress >= room.level * 10) wins++;
    }
    return wins / n;
}

const effBuff = (x) => ({ typeHrid: "/buff_types/efficiency", flatBoost: x });
const cases = [
    ["milking 60 vs room 40", { skill: "milking", level: 40 }, { level: 60 }],
    ["foraging 57 vs room 60", { skill: "foraging", level: 60 }, { level: 57 }],
    ["tailoring 93 vs room 60, +20% efficiency", { skill: "tailoring", level: 60 }, { level: 93, buffs: [[effBuff(0.2)]] }],
    ["woodcutting 55 vs room 75", { skill: "woodcutting", level: 75 }, { level: 55 }],
    ["enhancing 63 vs room 40", { skill: "enhancing", level: 40 }, { level: 63 }],
    ["enhancing 40 vs room 60", { skill: "enhancing", level: 60 }, { level: 40 }],
];
for (const [name, room, who] of cases) {
    const exact = skillingRoomChance(room, who).chance;
    const sim = simulate(room, who.level, { efficiency: who.buffs ? 0.2 : 0 });
    check(`${name}: exact ${exact.toFixed(3)} ≈ simulated ${sim.toFixed(3)}`, near(exact, sim, 0.015));
}

// Each part counts.
const base = skillingRoomChance({ skill: "milking", level: 60 }, { level: 58 }).chance;
const crate = skillingRoomChance({ skill: "milking", level: 60 }, { level: 58, crateBuffs: [{ typeHrid: "/buff_types/milking_level", flatBoost: 5 }] }).chance;
check("a tea crate's +5 levels helps", crate > base, `${base.toFixed(3)} → ${crate.toFixed(3)}`);
const shop = skillingRoomChance({ skill: "milking", level: 60 }, { level: 58, shop: { success: 12 } }).chance;
check("the shop's success upgrade helps", shop > base, `${base.toFixed(3)} → ${shop.toFixed(3)}`);
check("gathering doubles progress only for gathering skills", skillingBuffs("milking", [{ typeHrid: "/buff_types/gathering", flatBoost: 0.1 }]).double === 0.1 && skillingBuffs("tailoring", [{ typeHrid: "/buff_types/gathering", flatBoost: 0.1 }]).double === 0);
check("another skill's level buff doesn't count", skillingBuffs("milking", [{ typeHrid: "/buff_types/foraging_level", flatBoost: 5 }]).level === 0);
const slow = skillingRoomChance({ skill: "brewing", level: 60 }, { level: 60 });
check("12 tries at base speed, 10 successes needed at an equal level", slow.tries === 12 && slow.needed === 10, JSON.stringify(slow));

if (failed) {
    console.log(`${failed} check(s) failed`);
    process.exit(1);
}
console.log("All checks passed");
