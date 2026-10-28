// The script's version, very small next to the character's name in the game's
// header. At start (and every few hours) it asks GitHub for the newest version;
// if there is a newer one the number turns red and opens the update.

// Set by build.mjs; "dev" when the sources run unbuilt.
const VERSION = typeof __MWIA_VERSION__ !== "undefined" ? __MWIA_VERSION__ : "dev";
const UPDATE_URL = typeof __MWIA_UPDATE_URL__ !== "undefined" ? __MWIA_UPDATE_URL__ : "";
// package.json beside the built script: a few hundred bytes instead of the whole script.
const LATEST_URL = UPDATE_URL.replace(/dist\/[^/]+$/, "package.json");
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const SCAN_MS = 400;
// The name in the header (not in chat, lists or profiles).
const NAME = '[class*="Header_characterInfo"] [class*="Header_name__"]';
const NAME_ROW = '[class*="CharacterName_characterName__"]';

const versionTag = { latest: null, checked: 0, scanTimer: null };

export const scriptVersion = () => VERSION;

// Whether version a is newer than b ("0.37.0" > "0.36.2").
export function isNewer(a, b) {
    const pa = String(a).split(".").map(Number);
    const pb = String(b).split(".").map(Number);
    if (pa.some(Number.isNaN) || pb.some(Number.isNaN)) return false;
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
    }
    return false;
}

export function startVersionTag() {
    new MutationObserver((records) => {
        if (records.every((r) => r.target.closest?.(".mwia-version"))) return;
        scheduleScan();
    }).observe(document.body, { childList: true, subtree: true });
    scheduleScan();
    if (!LATEST_URL || VERSION === "dev") return;
    checkLatest();
    setInterval(checkLatest, CHECK_EVERY_MS);
    // Phones pause timers in the background: catch up on return.
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && Date.now() - versionTag.checked > CHECK_EVERY_MS) checkLatest();
    });
}

async function checkLatest() {
    versionTag.checked = Date.now();
    try {
        const response = await fetch(LATEST_URL, { cache: "no-store", signal: AbortSignal.timeout?.(30000) });
        if (!response.ok) return;
        const latest = (await response.json()).version;
        if (typeof latest === "string") versionTag.latest = latest;
        scan();
    } catch {
        // Offline or GitHub unreachable: keep what was known.
    }
}

function scheduleScan() {
    if (versionTag.scanTimer) return;
    versionTag.scanTimer = setTimeout(() => {
        versionTag.scanTimer = null;
        scan();
    }, SCAN_MS);
}

function scan() {
    const name = document.querySelector(NAME);
    if (!name) return;
    const row = name.querySelector(NAME_ROW) || name;
    let tag = row.querySelector(".mwia-version");
    if (!tag) {
        tag = document.createElement("a");
        tag.className = "mwia-version";
        tag.target = "_blank";
        tag.rel = "noopener";
        // The header's own clicks (menus) are not for this.
        tag.addEventListener("click", (event) => {
            event.stopPropagation();
            if (!tag.classList.contains("mwia-version-old")) event.preventDefault();
        });
        row.appendChild(tag);
    }
    const old = versionTag.latest && isNewer(versionTag.latest, VERSION);
    const text = old ? `v${VERSION} – update` : `v${VERSION}`;
    if (tag.textContent !== text) tag.textContent = text;
    tag.classList.toggle("mwia-version-old", Boolean(old));
    tag.title = old ? `MWI Advisor v${versionTag.latest} is out (you have v${VERSION}): tap to update` : `MWI Advisor v${VERSION}`;
    if (old) tag.href = UPDATE_URL;
    else tag.removeAttribute("href");
}
