# MWI Combat Advisor

Userscript for [Milky Way Idle](https://www.milkywayidle.com) that tells a (magic) fighter where to fight and what to
buy, by simulating *your own* character.

- **Overview** – your levels, gear, abilities, food/drinks and rule-based tips (empty slots, non-magic gear, …).
- **Focus slider (XP ↔ Gold)** – rank zones and upgrades by XP/h, by profit/h (loot at bid price minus food and
  drink cost), or a mix. Both are measured as a share of a reference (your current setup, or the best zone), so the
  slider simply weights them. Running costs are part of profit, so expensive drinks drop out under a gold focus by
  themselves. Moving the slider re-ranks instantly without simulating again.
- **Accept rare deaths** – by default a zone or upgrade counts only if you never die in the simulation. Tick this to
  accept up to 0.5 deaths/h; a death costs 150 s of waiting, which XP/h and profit already include, so a harder zone
  can be worth it. Re-ranks instantly. Zones where you kill faster than monsters spawn (max one encounter per 3 s)
  are marked ⏱ – upgrades hardly help there; a higher tier does.
- **Where to fight** – simulates your current setup in every combat zone (tier 0 up to the chosen max tier) and
  recommends the zone with the most XP/h where you never die. Also shows estimated profit/day.
- **Upgrades** – tries one change at a time (every magic weapon, armour piece, jewellery, pouch, charm – including
  enhanced +N copies for sale – new abilities, levelling equipped abilities with extra books, drinks and food you can
  use and afford), ranks them by XP/h gained per coin, builds a shopping list within your budget (type e.g. `500k`
  or `2M`) and simulates the whole list together. *Spending* (Frugal / Balanced / All in) sets how much XP a purchase
  must give per coin; pricier +N versions are only bought when they are clearly better. Changes that make you die
  more often are never recommended.
- **MWITools shopping cart** – every suggestion gets a **🛒 Add** button (and the shopping list an "add all purchases"
  button) that puts it in the MWITools cart through its public API (`window.MWITools.shopping`), including the +N
  enhancement level. Gear and books are added once; food and drinks as one day of combat. Something already in the
  cart is topped up to the suggested amount rather than added twice.
- **Guide** – short explanation of how combat XP, skills, abilities and consumables work.
- **Plan train** – a **🚂 Plan train** button next to *Calculate Step 3* in the MWITools planning tab. It reads the
  plan's goals (house level / item quantity) and the Full chain / One step / Buy choice of every step-2 row, works out
  the amounts again from the game's recipes and your inventory (the tab rounds large numbers), and orders the
  production steps so every ingredient comes before what is made from it. A small panel then walks through the stops:
  it opens each action (skill page → category tab → action), fills in the count and highlights the game's buttons.
  When the game confirms that the action reached the queue, the next stop opens. If nothing arrives (full queue), it
  waits and says so. Progress survives a reload. The panel also lists missing raw materials (with a 🛒 button for
  the MWITools cart) and warns where your skill level is too low. Inputs are counted without Artisan Tea, so you may
  end up with a little spare material.
- **Material costs** – in the MWITools planning tab, every step-2 row shows what the item costs to *Buy*, to make in
  *One step* (ingredients bought) or with the *Full chain* (only raw materials bought), cheapest in green. Above
  *Calculate Step 3* the same for the whole plan: your current choices, all Buy, all One step, all Full chain. Lowest
  ask prices; what is in your inventory is not bought again (each row on its own, the plan total shared). Coins for
  a house upgrade and Artisan Tea are not counted.
- **Phones** – on a narrow screen the panel fills the screen and wide tables turn into one card per row. On touch
  screens a tap shows the hints that a mouse would show on hover (dotted underline), the **⚔ Advisor** button can be
  dragged anywhere, and fewer simulation workers run so the phone doesn't overheat. The plan train starts compact
  (current stop and buttons only; ▸ shows the list) and ⇅ moves it between the top and bottom of the screen.

The script never buys, equips or queues anything by itself; you always click the game's own buttons.

## Install

1. Install Tampermonkey or Violentmonkey in your browser. On an iPhone, the Orion browser can run Violentmonkey from
   the Firefox add-on store.
2. Open <https://raw.githubusercontent.com/tarzanz/mwi-combat-advisor/main/dist/mwi-combat-advisor.user.js> and
   confirm the install. Updates come from the same link; "check for updates" in the script manager fetches them.
3. Reload the game. A **⚔ Advisor** button appears at the bottom right.

Pasting `dist/mwi-combat-advisor.user.js` into a new script works too, but then updates are manual.

The script must be running when the page loads (it reads your character from the game's connection), so reload
the game after installing or updating it. It works next to MWITools/Toolasha.

## How it works

- Combat engine: the community [MWICombatSimulator](https://github.com/shykai/MWICombatSimulatorTest) by
  AmVoidGuy/shykai (MIT), copied to `engine/` (see `engine/SOURCE.txt`). It runs in web workers on the game page.
- Game data (items, monsters, zones, abilities) is taken from the game client at runtime, so new patches are picked
  up automatically. Only tables the client lacks fall back to the simulator repository.
- Prices: the game's public `marketplace.json` (lowest ask for buying, best bid for loot value).
- Every suggestion is simulated several times with different random seeds (many short runs; the current setup gets
  three times as many). A one-sided Welch t-test against the current setup gives the **Sure** column – how certain it
  is that the change really improves your focus. Only suggestions that are at least 90% sure go on the shopping
  list, and a pricier option must also be 90% sure to beat the cheaper one it replaces. Because ~150 suggestions are
  tested at once, some useless ones would pass 90% by luck; so everything promising below 99% automatically gets two
  more rounds of fresh runs (up to 3× the normal count), and a button runs further rounds on demand.

## Limitations

- Solo combat only (no parties, no dungeons/labyrinth). Guild buffs are not modelled by the engine.
- At most five enhancement levels per item are tested (those where a higher level also costs more).
- Ability level-ups need the game's `levelExperienceTable`; if the client lacks it they are skipped (the panel says so).
- New food/drinks use the game's default triggers; your own trigger settings are used for things you already have.
- Results are estimates – a few percent either way is normal.
- The plan train relies on the class names of the MWITools planning tab and the game's action pages; it has only been
  tested against mock-ups of both.
- The phone layout has been tested at iPhone size in desktop Firefox, not on a real phone. Keep the screen on while
  an analysis runs: a phone pauses the page in the background.

## Development

```bash
npm install
npm run build                                   # -> dist/mwi-combat-advisor.user.js
npm test -- engine/data path/to/marketplace.json          # analysis logic in Node
node test/browser-test.mjs path/to/marketplace.json /tmp [mwitools.user.js]  # full userscript in headless Firefox
node test/train-browser-test.mjs /tmp                     # plan train against a mock planning tab and game
MOBILE=1 node test/browser-test.mjs …                     # either browser test at iPhone size with a touch screen
```

Installed scripts update from `dist/` on `main`, so a release is: bump `version` in `package.json`, `npm run build`,
commit and push.

To update the engine, copy `src/combatsimulator` from the simulator's `dev` branch over `engine/`.
