// Phones and tablets: touch screens have no hover, so tooltips open on a tap,
// and the launcher button can be dragged out of the way of the game's buttons.

import { NARROW } from "./style.js";

export const isTouch = () => !!window.matchMedia?.("(hover: none)").matches;
export const isNarrow = () => !!window.matchMedia?.(NARROW).matches;

const POSITION_KEY = "mwia-launcher-pos";
const DRAG_THRESHOLD = 8;

let tip = null;
let hidingTips = false;

function hideTip() {
    tip?.remove();
    tip = null;
}

export function showTip(anchor, text) {
    hideTip();
    tip = document.createElement("div");
    tip.className = "mwia-tip-pop";
    tip.textContent = text;
    document.body.appendChild(tip);
    const box = anchor.getBoundingClientRect();
    const left = Math.min(Math.max(8, box.left + box.width / 2 - tip.offsetWidth / 2), innerWidth - tip.offsetWidth - 8);
    const below = box.bottom + 6;
    const top = below + tip.offsetHeight < innerHeight - 8 ? below : Math.max(8, box.top - tip.offsetHeight - 6);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
}

// A tap on anything with a title (that isn't a control) shows the title.
export function enableTapTips(root) {
    if (!hidingTips) {
        hidingTips = true;
        document.addEventListener("pointerdown", hideTip, true);
        document.addEventListener("scroll", hideTip, true);
    }
    root.addEventListener("click", (event) => {
        if (!isTouch() || event.target.closest("button, select, input, textarea, a")) return;
        const owner = event.target.closest("[title]");
        if (owner && root.contains(owner) && owner.title) showTip(owner, owner.title);
    });
}

// Drag to move; a short tap is still a click. The spot is kept as a share of
// the screen, so it survives turning the phone.
export function makeDraggable(button) {
    let start = null;
    let moved = false;
    const place = (x, y) => {
        button.style.left = `${Math.min(Math.max(4, x), innerWidth - button.offsetWidth - 4)}px`;
        button.style.top = `${Math.min(Math.max(4, y), innerHeight - button.offsetHeight - 4)}px`;
        button.style.right = "auto";
        button.style.bottom = "auto";
    };
    const placeSaved = () => {
        try {
            const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || "null");
            if (saved) place(saved.x * innerWidth, saved.y * innerHeight);
        } catch {
            // stays in its default corner
        }
    };
    const save = () => {
        const box = button.getBoundingClientRect();
        try {
            localStorage.setItem(POSITION_KEY, JSON.stringify({ x: box.left / innerWidth, y: box.top / innerHeight }));
        } catch {
            // the spot is just not remembered
        }
    };

    button.addEventListener("pointerdown", (event) => {
        if (event.button) return;
        const box = button.getBoundingClientRect();
        start = { x: event.clientX, y: event.clientY, left: box.left, top: box.top };
        moved = false;
        button.setPointerCapture?.(event.pointerId);
    });
    button.addEventListener("pointermove", (event) => {
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        moved = true;
        place(start.left + dx, start.top + dy);
    });
    const end = () => {
        if (start && moved) save();
        start = null;
    };
    button.addEventListener("pointerup", end);
    button.addEventListener("pointercancel", end);
    // Registered before the opener's own click handler, so a drag doesn't open the panel.
    button.addEventListener(
        "click",
        (event) => {
            if (!moved) return;
            moved = false;
            event.stopImmediatePropagation();
            event.preventDefault();
        },
        true
    );
    window.addEventListener("resize", placeSaved);
    requestAnimationFrame(placeSaved);
}

// Narrow screens show wide tables as one card per row; every cell gets its
// column name as a label, and the name column becomes the card's title.
const TITLE_COLUMNS = new Set(["Zone", "Item", "Ability", "Food", "Drink"]);

export function labelTableCells(container) {
    for (const table of container.querySelectorAll(".mwia-wide")) {
        const headers = [...table.querySelectorAll("thead th")].map((th) => th.textContent.trim());
        for (const row of table.querySelectorAll("tbody tr")) {
            [...row.cells].forEach((cell, i) => {
                cell.dataset.label = headers[i] || "";
                if (TITLE_COLUMNS.has(headers[i])) cell.classList.add("mwia-card-title");
            });
        }
    }
}
