# MWI Advisor

Userscript for [Milky Way Idle](https://www.milkywayidle.com) that tells you where to fight and what to buy (magic,
ranged or melee, by simulating *your own* character), what to make and sell, how to level and which teas to drink.
(It started as *MWI Combat Advisor*; the install and update link is unchanged.)

- **Overview** – your levels, gear, abilities, food/drinks and rule-based tips (empty slots, armour that hurts your
  style's accuracy, a focus charm for your lowest combat skill, a style you hardly trained, …). *Total level* says how
  many levels are left to the next pouch (Medium at 250, Large at 500, Giant at 750 – one more drink slot) and lists
  every skill by the XP its next level needs, cheapest first.
- **Fight as** – Magic, Ranged or Melee, or whatever your weapon is. Another style than your weapon's starts from the
  best weapon for it in your inventory, else the cheapest you can wear on the market (one that trains the style's own
  skill: a bow or crossbow, a sword or mace, a staff). Zones and upgrades are simulated with it, it heads the shopping
  list, and better weapons of the style, armour and charms that suit it are tested as upgrades (a better weapon on
  the list is bought instead of it).
- **Count levels, not XP** (Where to fight, Upgrades, Skilling) – the XP is counted as the levels it gives each skill
  from where it is now, over a day of training. Each level needs more XP than the one before, so XP in a low skill (a
  style at level 1, a gathering skill at 45) buys far more levels than in a high one: the fastest way up in total
  level. Zones and upgrades show *Levels/day*, Skilling rows add *lvl/day*; the focus slider weighs levels against gold
  as it does XP. A focus charm on your lowest combat skill is measured the same way. Ticking it re-ranks instantly.
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
- **Skilling** – every gathering and production action your levels allow (milking, foraging, woodcutting,
  cheesesmithing, crafting, tailoring, cooking, brewing), ranked by gold per day, with XP per day beside it. It uses
  your levels, the buffs the game sends (house, equipment, community, guild, achievements, Moo Pass, personal) and the
  teas in each skill's drink slots: efficiency from levels above the requirement and from buffs, action speed (3 s
  floor), quantity, Artisan, Processing and Wisdom Tea, 12 drinks an hour (more with a Guzzling Pouch). Materials
  and teas are bought at the cheapest ask; products sell at the ask (a listing) or the best bid (*Sell at*), minus
  the 4% market tax. A listing is never valued above the item's usual (7-day median) ask once 12 hours of prices are
  collected, nor – before that – above 1.5× the best bid, so a troll order at 999B can't top the list. Filter by skill; tap a row for its buttons and short headings (speed, gold, XP, how many, teas) that
  open to the whole calculation. For each action it also tries every tea
  setup that fits your slots (one, plus what your pouch adds – the same as in combat), shows the one that earns the most and what each of its teas earns above its cost; *Teas:
  Best teas* ranks with those setups. ⚠ marks thin markets (no buy orders, or an ask far above the bid),
  materials nobody sells and thin margins (a price drop under 5% wipes out the profit). *Max sold/day* sets how many
  of one crafted item the market takes a day; past it the action only runs part of the day (gathered raw materials
  are never limited). Crates and caches from rare drops are worth what they hold, a cowbell a tenth of a bag.
  **Plan** sets the job: *Away (8 h)* is careful – materials take at most 60% of your coins on a 🟢 stable market,
  30% on a 🟡 ok one and 10% on a 🔴 thin one, and margins under 5% or under the price's usual swing are left out of
  the list (*Show all* still has them); *Active (1 h)* plans short jobs with 80/50/20% of the coins and shows thin
  margins with a ⚠. The market's rating comes from the last 7 days of collected prices (at least 12 hours): stable
  when there was both a buyer and a seller in ≥ 90% of the hours, the spread was ≤ 5%, the price swung ≤ ±3% and the
  lowest ask moved in ≥ 30% of the hours (a sign that it sells and gets relisted); ok with ≥ 75%, ≤ 15% and ≤ ±8%;
  thin otherwise, or with too little history. **How many to make:** for each crafted item a row suggests a count
  without opening the market: the planned hours of crafting, less what you already have in the inventory or on your
  own sell orders (and within your *Max sold/day*), smaller on a swinging price, and no more than the rating's share
  of your coins buys materials for (using materials you have first). The materials you still have to buy are rated
  too, and the thinnest market of the product and those materials sets the share. A material you opened on the
  market in the last 12 hours caps the job at what others had listed within 5% of its lowest ask (plus what you
  have) – worth a look for a 🔴 material before buying a lot of it. The game only trades within a price band
  (*Tradable range*) the order book doesn't include, so listings near the top of it may not be buyable. The list is ranked by what the planned hours
  give, so a job your coins or your stock keep short ranks lower, and an item you already hold a whole job of goes
  last. The row and *📦 How many* show the rating, what the batch's materials cost (and how much of it you still have
  to buy) and its profit once it sells, and each material to buy with its rating; the product's order book, if you
  saw it on the market, is shown there too, but doesn't set the count. *▶ Make N* opens the action in the game with the count filled in; you click the game's button. **🍵 Buy teas** puts the best teas for the job in the MWITools
  cart (a gathering job runs for the planned hours), less what you have. The **Focus** slider ranks by gold, XP or a mix
  (each as a share of the most any action in the list can give with its best teas in the planned hours within your
  coins – so a fortune your coins can't buy materials for doesn't shrink everything else – not with the teas in your
  slots, so following the advice doesn't change it); a craft that loses gold is planned within your coins too, so its
  XP counts only for what you can afford; the best teas follow it, picked within the action's own skill so they are
  the same whichever skill the list shows, so an XP focus picks Wisdom Tea. **⛓ Yourself** compares buying the materials with making every one your levels
  allow (gathered or crafted, each step with that skill's teas): gold per hour of the whole chain and how the hour
  splits between the steps; a row says when it beats buying. When the chain pays at least as well as buying, **🚂 Train
  N** starts an advisor train for it: the raw materials gathered, the crafted materials made, then the item – N sized
  so the whole chain takes about the planned hours (less what you hold), with what it still buys within the coin
  share of its thinnest market. **Upgrades that pay back** (pick a skill): every tool,
  skilling top/bottoms, necklace, earrings, ring, charm, cape and pouch your levels allow – also +N copies for sale and
  ones in your inventory – tried in place of what you wear, plus the skill's house room one level up (a pouch with
  more drink slots is measured with the best teas for both the old and the new number of slots); ranked by days
  until it is earned back on what you'd make – the top of the Skilling list with your settings, not an action your
  coins or the market can't carry – counting what it sells for again at the bid for its +level (with nobody buying that level, the nearest lower level's bid as a floor; else the vendor price). Each +level
  also shows its step over the next lower level for sale: what the step costs and adds a day, and its own payback.
  🛒 buttons add them to the MWITools cart. If the item stats
  don't add up to the action speed the game reports for your gear, it says so. **🏪 Market** opens the item on the marketplace (through MWITools when it is installed), which
  also reads its order book (shown under *📦 How many*); closing the market brings the panel back on the same row. Open rows and headings stay
  open while you switch around. *Unlocks soon* lists the actions within 10 levels, with how long it takes to get there
  using the skill's fastest XP action you have now. The same formulas as MWITools.
- **Levelling Enhancing and Alchemy** – two more choices in the Skilling tab's *Skill* list (not part of *All
  skills*). These skills mostly cost gold, so the **Focus** slider weighs time against money there: *Gold only* ranks
  the cheapest coins per XP first, *XP only* the most XP a day whatever it costs, and in between each counts as a
  share of the best in the list (coins per XP against the cheapest, XP a day against the fastest). Every row shows its
  coins per XP; tap it for the whole calculation, with your level, buffs and the best teas.
  - **Enhancing:** enhance an item towards a target +level again and again. A failure drops it back to +0 (no
    protection), so the item is bought once per success while every attempt costs its enhancing materials; at the
    target the +level is sold and a new item bought. One row per item, at the target (+1 … +20) that suits the focus –
    *🎚 Targets* lists them all with attempts, gold and XP a day. Success = the game's rate for the +level × (1 + 0.05%
    per level above the item, or −50% × (1 − level / item level) below it, + the tool's and the Observatory's success);
    12 s / (1 + speed, +1% per level above the item); XP 1.4 × (1 + +level) × (10 + item level) × wisdom, a tenth on a
    failure; Blessed Tea's double steps; Enhancing Essence ((100 + item level) / 1000) and Artisan's Crates on every
    attempt (checked against the game's Enhancing window). The attempts per target come from a closed formula (the same as a Markov
    solve). The +level sells at the lowest ask, never above its usual ask at that level (from the price history), or
    at the bid (*Sell at*) – a listing only counts when a buyer at that +level, its usual ask or its sales back it, so
    a lone listing nobody buys from is ignored; otherwise the nearest lower +level's bid is a floor. The market takes
    only so many a day (its sales, once collected, else *Max sold/day*): the rest is valued at the floor. An item you
    have at +0 is used first, valued at its bid. Within your coins as with crafting (*Plan*): the item and the planned
    hours of materials and teas may take the share of your coins that the item's market allows; a row whose item you
    can't afford fades and goes last, one your coins carry only part of the hours ranks by that part. **▶ Enhance to +N** opens Enhancing with the item from your inventory in the slot
    and the target set (without it, the page opens and says to buy it first); **🛒 Materials** adds what the planned
    hours use.
  - **Alchemy:** every coinify, decompose and transmute of an item on the market, bought at the ask. Success = base
    (70%, 60%, the item's transmute rate) × (1 + catalyst + Catalytic Tea + 0.9 / item level per level below the item);
    20 s / (1 + speed) with efficiency +1% per level above the item; the bulk size (10 essences at once), the coins it
    costs (decompose 5 × (10 + item level), transmute max(50, sell price / 5)), XP 1.0 / 1.4 / 1.6 × (10 + item level),
    a tenth on a failure, Alchemy Essence ((100 + item level) / 1800) and Artisan's Crates. The catalyst (none, the
    action's own or Prime) that suits the focus is picked; it is used up only on a success. A transmute that gives the
    item back saves buying one. *Plan*, the market's rating and *How many* work as for crafting; **▶ Coinify N**
    (Decompose, Transmute) opens that tab with the item from your inventory and the count filled in.
  - Only the 40 items that do best without teas in gold, in XP and in XP per coin (and those you have) are tried with
    every tea setup, so the list stays quick.
- **Teas, coffee and food in the action window** – when you open an action in the game, a box above the *Start*
  button says which teas to have in the skill's slots for it (➕ put in, ✓ already there, ➖ take out), with the
  advisor's settings and focus, how many you have and a 🛒 button for the teas the job needs. For a combat zone it
  shows the drinks and food from your latest *Analyze upgrades* for that zone (kept per zone, also after a reload)
  and buys what you lack for a day. Hour buttons (0.5, 1, 2 … 12) fill in the *Fight* count for that many hours at
  the pace the analysis simulated with your current gear, and the 🛒 button then buys for those hours. They show only
  when the window's difficulty is the tier that was analysed.
- **Better tools on the Equipment page** – under the slots a box lists every tool slot where your skill level now
  allows a higher tier than the tool you wear (or an empty slot): the tool, its price, what it adds a day on what
  you'd make (the top of the skill's Skilling list) and when it pays back, counting a resale at the bid (gathering and production skills), with a 🛒 button each and one for
  all. A tool already in your inventory just says to equip it.
- **Tea slots on a skill page** – the first job in your queue for that skill decides which teas are right (the same
  ones the action window suggests: the Skilling tab's best setup with your focus, or the teas you have when nothing
  scores better). On the Enhancing and Alchemy pages it is the item in that job, and for Enhancing the target set
  for it; the Enhancing and Alchemy windows get the same tea box, for the item in the slot (and the target or tab). A slot with a wrong tea, or an empty one while a right tea is missing, glows red. Tap it and in the
  game's tea picker the right teas glow green ("Remove" does when a wrong tea has nothing to replace it). Right teas
  you don't have are named in the picker, with a 🛒 button that tops all of them up to 8 hours in the MWITools cart.
  Nothing shows when the skill has no job in the queue.
- **Guide** – short explanation of how combat XP, skills, abilities and consumables work.
- **Plan train** – a **🚂 Plan train** button next to *Calculate Step 3* in the MWITools planning tab. It reads the
  plan's goals (house level / item quantity) and the Full chain / One step / Buy choice of every step-2 row, works out
  the amounts again from the game's recipes and your inventory (the tab rounds large numbers), and orders the
  production steps so every ingredient comes before what is made from it. A small panel then walks through the stops:
  it opens each action (skill page → category tab → action), fills in the count and highlights the game's buttons.
  When the game confirms that the action reached the queue, the next stop opens. If nothing arrives (full queue), it
  waits and says so. Progress survives a reload. Raw materials you have the level to gather (foraging, woodcutting,
  milking) become stops of their own at the start, enough actions that the average yield plus a margin covers the need
  about nine times in ten; *buy instead* / *gather* switches each one. The panel also lists the materials left to buy
  (with a 🛒 button for the MWITools cart) and warns where your skill level is too low. Inputs are counted without Artisan Tea, so you may
  end up with a little spare material.
- **Material costs** – in the MWITools planning tab, every step-2 row shows what the item costs to *Buy*, to make in
  *One step* (ingredients bought) or with the *Full chain* (only raw materials bought), cheapest in green. Above
  *Calculate Step 3* the same for the whole plan: your current choices, all Buy, all One step, all Full chain. Lowest
  ask prices; what is in your inventory is not bought again (each row on its own, the plan total shared). Coins for
  a house upgrade and Artisan Tea are not counted.
- **Price history** – while the game is open the script saves every item's ask and bid every 30 minutes, each +level
  of an item on its own (one point per hour for two weeks, then one per day for a year; in the browser's IndexedDB, on
  that device only, keeping only what changed since the point before, so prices that stand still take no room), and how
  many of each sold that hour and at what average price, as the market file says. In the game's
  marketplace a box under the open item (at the +level on its icon) shows one summary line – ask and bid now against their usual price, trend and
  typical swing – and folds open (*Chart and details*) to the price now against its usual price – the median of the last 7 and 30
  days, so one odd listing hardly moves it – with ±%, a trend arrow (this week's median against last week's) and a
  chart of ask and bid for 30 days or a year (prices up the side, dates along the bottom) (plus 90-day and 1-year medians). The Skilling tab warns when a product
  sells more than 10% above or below its usual price, or a material costs more than 10% above it. Until an item has
  12 hours over 2 days of data the box says how far it has come and roughly when it is ready; from 2 hours on it
  already shows its numbers, marked *preliminary* (the Skilling tab warns only once both are reached). Prices that
  swing are taken into account in *How many*: when a product's price usually swings more than ±5% (half the week's
  prices lie within that share of the median) the batch gets smaller – down to 40% – since the price may fall before
  it all sells; when it is also more than 10% above its usual price now the batch is halved again, to sell while it
  lasts; more than 10% below says waiting may pay. A ⚠ warns when the margin is smaller than the price's usual swing.
  **⬇ Export all prices** in the box prepares every stored price as one CSV (hourly rows only where an item's price
  changed, daily rows with low/high), then **Download CSV** or **📋 Copy** – to read in a spreadsheet or hand to an AI.
- **Listing prices** – the game's *Sell Listing* and *Buy Listing* windows get price buttons under the price box:
  **Match** (the best offer now), **Wall** (one price step in front of the first level in the order book holding a
  fifth of everything others offer within the tradable range – passing the small undercuts, staying in front of the
  big pile), **Usual** (the week's median ask or bid) and **Patient** (the upper quartile of the week's asks when
  selling, the lower quartile of its bids when buying), each kept within the tradable range. The game's own −/+ make
  the steps, so the price is always one the game takes. A line says how many others offer a better price than the one
  in the box and how it compares with the usual price. Usual and Patient need 12 hours of prices. +N items use that
  level's order book, history and tradable range (the range the game sends with the order book when the window
  doesn't show it); open the item at that level on the market first.
- **Phones** – on a narrow screen the panel fills the screen and wide tables turn into one card per row. On touch
  screens a tap shows the hints that a mouse would show on hover (dotted underline), the round **🧭** button (44 px on a
  touch screen, 36 px with a mouse) can be
  dragged anywhere, and fewer simulation workers run so the phone doesn't overheat. The plan train starts compact
  (current stop and buttons only; ▸ shows the list) and ⇅ moves it between the top and bottom of the screen.

The script never buys, equips or queues anything by itself; you always click the game's own buttons.

## Install

1. Install Tampermonkey or Violentmonkey in your browser. On an iPhone, the Orion browser can run Violentmonkey from
   the Firefox add-on store.
2. Open <https://raw.githubusercontent.com/tarzanz/mwi-combat-advisor/main/dist/mwi-combat-advisor.user.js> and
   confirm the install. Updates come from the same link; "check for updates" in the script manager fetches them.
3. Reload the game. A small round **🧭** button appears at the bottom right (drag it anywhere on a phone).

Pasting `dist/mwi-combat-advisor.user.js` into a new script works too, but then updates are manual.

The script must be running when the page loads (it reads your character from the game's connection), so reload
the game after installing or updating it. It works next to MWITools/Toolasha.

## How it works

- Combat engine: the community [MWICombatSimulator](https://github.com/shykai/MWICombatSimulatorTest) by
  AmVoidGuy/shykai (MIT), copied to `engine/` (see `engine/SOURCE.txt`). It runs in web workers on the game page.
- Game data (items, monsters, zones, abilities) is taken from the game client at runtime, so new patches are picked
  up automatically. Only tables the client lacks fall back to the simulator repository.
- Prices: the game's public `marketplace.json` (lowest ask for buying, best bid for loot value; the Skilling tab
  lets you pick ask or bid for what you sell).
- Every suggestion is simulated several times with different random seeds (many short runs; the current setup gets
  three times as many). A one-sided Welch t-test against the current setup gives the **Sure** column – how certain it
  is that the change really improves your focus. Only suggestions that are at least 90% sure go on the shopping
  list, and a pricier option must also be 90% sure to beat the cheaper one it replaces. Because ~150 suggestions are
  tested at once, some useless ones would pass 90% by luck; so everything promising below 99% automatically gets two
  more rounds of fresh runs (up to 3× the normal count), and a button runs further rounds on demand.

## Limitations

- Solo combat only (no parties, no dungeons/labyrinth). Guild buffs are not modelled by the engine.
- *Fight as* picks one starter weapon; other weapons of the style are tested as upgrades within the budget left after
  it. Levels are counted over a day at today's rate, so a skill you would level past in an hour is still worth a lot.
- At most five enhancement levels per item are tested (those where a higher level also costs more).
- Ability level-ups need the game's `levelExperienceTable`; if the client lacks it they are skipped (the panel says so).
- New food/drinks use the game's default triggers; your own trigger settings are used for things you already have.
- Results are estimates – a few percent either way is normal.
- The plan train relies on the class names of the MWITools planning tab and the game's action pages; it has only been
  tested against mock-ups of both.
- Skilling: the market's rating rests on prices alone – a calm item that sells only a few a day can still look
  stable. The price history now also saves how many were sold each hour (the market file's `v`, with the average
  trade price `p`), and *How many* shows about how many sell a day once 12 hours of that are collected; the rating
  doesn't use it yet. *Max sold/day* caps it when you know better.
- Enhancing: no protection (Mirror of Protection, copies) yet, and no Observatory/Enhancer
  upgrades under *Upgrades that pay back*. Alchemy: no Unrefine.
  The ⛓ chain makes every material it can (by the fastest source), even where buying one of them would pay better.
- The phone layout has been tested at iPhone size in desktop Firefox, not on a real phone. Keep the screen on while
  an analysis runs: a phone pauses the page in the background.

## Development

```bash
npm install
npm run build                                   # -> dist/mwi-combat-advisor.user.js
npm test -- engine/data path/to/marketplace.json          # analysis logic in Node
node test/browser-test.mjs path/to/marketplace.json /tmp [mwitools.user.js]  # full userscript in headless Firefox
node test/train-browser-test.mjs /tmp                     # plan train against a mock planning tab and game
node test/skilling-browser-test.mjs /tmp                  # Skilling tab against a mock game and market
node test/price-history-test.mjs                          # price-history maths in Node
node test/leveling-test.mjs                               # Enhancing and Alchemy rules in Node
node test/price-history-browser-test.mjs /tmp             # price history: marketplace box and Skilling warnings
MOBILE=1 node test/browser-test.mjs …                     # any browser test at iPhone size with a touch screen
BROWSER_PATH=/path/to/chromium node test/skilling-browser-test.mjs /tmp  # any browser test in Chromium instead of Firefox
```

Installed scripts update from `dist/` on `main`, so a release is: bump `version` in `package.json`, `npm run build`,
commit and push.

To update the engine, copy `src/combatsimulator` from the simulator's `dev` branch over `engine/`.
