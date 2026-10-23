// Phones (and phones turned sideways) get the full-screen layout.
export const NARROW = "(max-width: 700px), (max-height: 500px)";

export const CSS = `
.mwia-launcher {
  position: fixed; right: 44px; bottom: 74px; z-index: 999;
  padding: 6px 12px; border-radius: 16px; border: 1px solid #5b6bb0;
  background: #262c4a; color: #e8ebff; font: 600 13px/1.2 sans-serif; cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,.4); touch-action: none; user-select: none; -webkit-user-select: none;
}
.mwia-launcher:hover { background: #333b63; }
.mwia-panel {
  position: fixed; top: 48px; right: 44px; z-index: 1000;
  width: min(880px, calc(100vw - 58px)); max-height: calc(100vh - 64px);
  display: flex; flex-direction: column;
  background: #171b2e; color: #dfe3f5; border: 1px solid #3c4677; border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0,0,0,.55); font: 13px/1.45 sans-serif;
}
.mwia-hidden { display: none; }
.mwia-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid #2c3459; }
.mwia-tabs { display: flex; gap: 4px; padding: 8px 10px 0; border-bottom: 1px solid #2c3459; flex-wrap: wrap; }
.mwia-tab { background: none; border: none; color: #aab2d8; padding: 6px 12px; cursor: pointer; border-bottom: 2px solid transparent; font: inherit; }
.mwia-tab.mwia-active { color: #fff; border-bottom-color: #7c8cff; }
.mwia-body { padding: 12px 14px 16px; overflow: auto; }
.mwia-body h3 { margin: 14px 0 6px; font-size: 14px; color: #c9d0ff; }
.mwia-body p { margin: 6px 0; }
.mwia-body ul, .mwia-body ol { margin: 4px 0 8px; padding-left: 20px; }
.mwia-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.mwia-table { border-collapse: collapse; width: 100%; }
.mwia-table td, .mwia-table th { padding: 3px 6px; border-bottom: 1px solid #262d4d; text-align: left; vertical-align: top; }
.mwia-table th { color: #9aa3cf; font-weight: 600; }
.mwia-wide { font-size: 12px; margin-bottom: 6px; }
.mwia-num { text-align: right !important; white-space: nowrap; font-variant-numeric: tabular-nums; }
.mwia-sum td { font-weight: 700; }
.mwia-best td { background: #1f3326; }
.mwia-faded td { opacity: .55; }
.mwia-settings { display: flex; flex-wrap: wrap; gap: 8px 14px; margin: 8px 0; }
.mwia-settings label { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #9aa3cf; }
.mwia-settings select, .mwia-settings input { background: #0f1222; color: #e8ebff; border: 1px solid #3c4677; border-radius: 5px; padding: 3px 6px; font: inherit; max-width: 260px; }
.mwia-focus-row { display: flex; align-items: center; gap: 6px; color: #aab2d8; }
.mwia-settings .mwia-focus-row input { width: 130px; padding: 0; border: none; background: none; accent-color: #f2c25b; }
.mwia-focus-text { color: #e8ebff; }
.mwia-settings input.mwia-invalid { border-color: #ff7b7b; }
.mwia-cart-btn { background: #1e3a33; color: #8fe0c0; border: 1px solid #2f6b5a; border-radius: 4px; padding: 0 6px; font: 11px/1.6 sans-serif; cursor: pointer; white-space: nowrap; }
.mwia-cart-btn:hover { background: #26493f; }
.mwia-notice { padding: 6px 10px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #3c4677; background: #1d2440; }
.mwia-notice-ok { border-color: #2f6b5a; background: #17302a; }
.mwia-notice-warn { border-color: #7a6a2a; background: #2e2a17; }
.mwia-notice-bad { border-color: #a03a4c; background: #4a1f28; }
.mwia-notice-diag { margin-top: 6px; font: 11px/1.35 monospace; opacity: .8; overflow-wrap: anywhere; user-select: text; -webkit-user-select: text; }
.mwia-btn { background: #4c5bd4; color: #fff; border: none; border-radius: 6px; padding: 7px 14px; font: 600 13px sans-serif; cursor: pointer; margin: 4px 0 8px; }
.mwia-btn:disabled { opacity: .5; cursor: default; }
.mwia-link { background: none; border: none; color: #9aa3cf; cursor: pointer; font: inherit; padding: 2px 6px; }
.mwia-link:hover { color: #fff; }
.mwia-dim { color: #8189b0; }
.mwia-ok { color: #6fdc8c; }
.mwia-warn { color: #f2c25b; }
.mwia-bad { color: #ff7b7b; }
.mwia-enh { color: #7fd0ff; }
.mwia-tier { color: #f2a65b; font-weight: 700; }
.mwia-error { background: #4a1f28; border: 1px solid #a03a4c; padding: 8px 10px; border-radius: 6px; margin-bottom: 8px; }
.mwia-reco { background: #1d2b45; border-left: 3px solid #7c8cff; padding: 8px 10px; border-radius: 4px; margin: 8px 0; }
.mwia-progress { margin: 6px 0 10px; }
.mwia-progress-label { display: flex; justify-content: space-between; font-size: 12px; color: #aab2d8; }
.mwia-bar { height: 6px; background: #262d4d; border-radius: 3px; overflow: hidden; }
.mwia-bar div { height: 100%; background: #7c8cff; transition: width .2s; }
.mwia-tips li { margin: 3px 0; }
.mwia-tip-bad::marker { content: "✖ "; color: #ff7b7b; }
.mwia-tip-warn::marker { content: "⚠ "; color: #f2c25b; }
.mwia-tip-info::marker { content: "ℹ "; color: #7fd0ff; }
.mwia-tip-ok::marker { content: "✔ "; color: #6fdc8c; }
.mwia-plan li { margin: 3px 0; }
.mwia-guide p, .mwia-guide li { max-width: 72ch; }
.mwia-train {
  position: fixed; right: 44px; bottom: 112px; z-index: 1500;
  width: min(330px, calc(100vw - 58px)); max-height: 55vh; overflow: auto;
  padding: 8px 10px; background: #171b2e; color: #dfe3f5; border: 1px solid #3c4677; border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0,0,0,.55); font: 12px/1.45 sans-serif;
}
.mwia-train p { margin: 5px 0; }
.mwia-train-head { display: flex; align-items: center; gap: 4px; }
.mwia-train-head b { flex: 1; }
.mwia-train-now { margin: 4px 0; padding: 4px 8px; border-radius: 6px; background: #1d2b45; border-left: 3px solid #f2c25b; font-weight: 600; }
.mwia-train-buttons { display: flex; gap: 6px; margin: 4px 0 6px; }
.mwia-train-buttons button:disabled { opacity: .5; cursor: default; }
.mwia-train-stops { margin: 4px 0; padding-left: 22px; }
.mwia-train-stops li { margin: 1px 0; }
.mwia-train-stops .mwia-num { color: #c9d0ff; }
.mwia-train-done { opacity: .5; text-decoration: line-through; }
.mwia-train-current { color: #ffe27a; font-weight: 600; }
.mwia-train-start {
  margin-left: 8px; padding: 5px 10px; border-radius: 6px; border: 1px solid #f2c25b;
  background: #43351f; color: #ffe2a0; font: 600 12px sans-serif; cursor: pointer; white-space: nowrap;
}
/* MWITools lays rows out as grids or flex rows; the cost line takes a whole row of its own.
   The planning-tab prefix outweighs MWITools' own rules for text in a row. */
.planning-step .mwia-plan-cost, .planning-stage .mwia-plan-costs {
  grid-column: 1 / -1; flex-basis: 100%; width: 100%; box-sizing: border-box; text-align: left;
  font: 400 12px/1.4 sans-serif; color: #aab3dc;
}
.planning-step .mwia-plan-cost { margin-top: 4px; }
.planning-stage .mwia-plan-costs { margin: 6px 0; padding: 6px 10px; border: 1px solid #3c4677; border-radius: 6px; background: #1d2440; color: #dde2ff; }
.planning-step .mwia-plan-cost-best, .planning-stage .mwia-plan-cost-best { color: #7ee2b0; font-weight: 600; }
.mwia-skill-list { display: flex; flex-direction: column; }
.mwia-skill-row { border-bottom: 1px solid #262d4d; }
.mwia-skill-row.mwia-best { background: #1f3326; }
.mwia-skill-row.mwia-faded > summary { opacity: .6; }
.mwia-skill-row > summary { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 6px 4px; cursor: pointer; list-style: none; }
.mwia-skill-row > summary::-webkit-details-marker { display: none; }
.mwia-skill-row > summary::before { content: "▸"; color: #5b6bb0; flex: none; }
.mwia-skill-row[open] > summary::before { content: "▾"; }
.mwia-skill-name { flex: 1; min-width: 0; }
.mwia-skill-name small, .mwia-skill-hint { display: block; color: #8189b0; font-size: 11px; }
.mwia-skill-hint { color: #7ee2b0; }
.mwia-skill-nums { display: flex; flex-direction: column; align-items: flex-end; white-space: nowrap; font-variant-numeric: tabular-nums; }
.mwia-skill-nums .mwia-dim { font-size: 11px; }
.mwia-skill-detail { padding: 2px 8px 8px 20px; font-size: 12px; color: #c3c9e8; overflow-wrap: anywhere; }
.mwia-skill-detail p { margin: 4px 0; }
.mwia-skill-buttons { display: flex; flex-wrap: wrap; gap: 6px; margin: 2px 0 6px; }
.mwia-skill-buttons .mwia-btn { margin: 0; }
.mwia-btn-quiet { background: #2a3150; border: 1px solid #3c4677; }
.mwia-upgrade { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 6px 4px; border-bottom: 1px solid #262d4d; }
.mwia-upgrade small { display: block; color: #8189b0; font-size: 11px; }
.mwia-skill-sec { border-top: 1px solid #232a48; }
.mwia-skill-sec > summary { padding: 5px 0; cursor: pointer; list-style: none; }
.mwia-skill-sec > summary::-webkit-details-marker { display: none; }
.mwia-skill-sec > summary::before { content: "▸ "; color: #5b6bb0; }
.mwia-skill-sec[open] > summary::before { content: "▾ "; }
.mwia-skill-sec > p { margin: 2px 0 6px 14px; }
.mwia-train-target { outline: 3px solid #ffd257 !important; outline-offset: 2px; border-radius: 4px; }
.mwia-narrow-only { display: none; }
.mwia-tip-pop {
  position: fixed; z-index: 2000; max-width: min(300px, calc(100vw - 16px)); padding: 6px 9px; border-radius: 6px;
  background: #0f1222; color: #e8ebff; border: 1px solid #5b6bb0; box-shadow: 0 4px 16px rgba(0,0,0,.6); font: 12px/1.4 sans-serif;
}

/* Touch screens: bigger targets, and 16px inputs so iOS doesn't zoom in on focus. */
@media (hover: none), (pointer: coarse) {
  .mwia-panel button, .mwia-train button, .mwia-train-start { touch-action: manipulation; }
  .mwia-launcher { padding: 9px 14px; font-size: 14px; }
  .mwia-tab { padding: 10px 12px; }
  .mwia-link { padding: 6px 10px; }
  .mwia-btn { padding: 10px 16px; }
  .mwia-cart-btn { font-size: 13px; padding: 4px 10px; min-height: 32px; }
  .mwia-settings select, .mwia-settings input[type="text"] { font-size: 16px; padding: 6px 8px; }
  .mwia-settings input[type="checkbox"] { width: 22px; height: 22px; }
  .mwia-panel th[title], .mwia-panel span[title], .mwia-panel label[title] { text-decoration: underline dotted #5b6bb0; }
}

@media ${NARROW} {
  .mwia-panel {
    top: 0; right: 0; bottom: 0; left: 0; width: auto; max-height: none; z-index: 1400;
    border: none; border-radius: 0; box-sizing: border-box;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  .mwia-header .mwia-link { font-size: 20px; }
  .mwia-tabs { flex-wrap: nowrap; overflow-x: auto; }
  .mwia-tab { white-space: nowrap; }
  .mwia-body { flex: 1; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; padding: 10px 12px 24px; }
  .mwia-settings label { flex: 1 1 140px; }
  .mwia-settings select, .mwia-settings input[type="text"] { max-width: none; width: 100%; box-sizing: border-box; }

  /* Wide tables become one card per row. */
  .mwia-wide, .mwia-wide tbody { display: block; }
  .mwia-wide thead { display: none; }
  .mwia-wide tr { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 14px; padding: 8px 4px; border-bottom: 1px solid #2c3459; }
  .mwia-wide td { display: flex; justify-content: space-between; gap: 8px; padding: 0; border: none; text-align: left !important; }
  .mwia-wide td::before { content: attr(data-label); color: #8189b0; white-space: nowrap; }
  .mwia-wide td[data-label=""]::before, .mwia-wide td.mwia-card-title::before { content: none; }
  .mwia-wide td[data-label=""] { grid-column: 1 / -1; justify-content: flex-start; }
  .mwia-wide td[data-label=""]:empty { display: none; }
  .mwia-wide td.mwia-card-title { grid-column: 1 / -1; order: -1; font-size: 13px; font-weight: 600; color: #e8ebff; }
  .mwia-best { background: #1f3326; }
  .mwia-faded { opacity: .55; }
  .mwia-faded td { opacity: 1; }

  .mwia-train {
    top: calc(8px + env(safe-area-inset-top)); right: 8px; bottom: auto; left: 8px;
    width: auto; max-height: 45vh; font-size: 13px;
  }
  .mwia-train-buttons button { flex: 1; }
  .mwia-train.mwia-train-low { top: auto; bottom: calc(8px + env(safe-area-inset-bottom)); }
  .mwia-narrow-only { display: inline-block; }
}
`;
