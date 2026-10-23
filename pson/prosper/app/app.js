/* Prosper web app (https://wills.im/pson/prosper/app/).
   The extension's panel, laid out for a desktop screen: sidebar (search, pinned, recent), company or person view in the
   centre, AI summary and chat on the right. The UI code is the userscript's, with the parts that depend on a host page
   (highlight pill, edge tab, LinkedIn tab, hotkeys, userscript manager) replaced; see app-tail section at the end. */
'use strict';


const APP_CSS = `
/* ---------- web app layout ---------- */
.root.app .panel { position: fixed; inset: 0; width: auto; max-width: none; border: 0; border-radius: 0; box-shadow: none; display: grid;
  grid-template-columns: 268px minmax(0, 1fr) clamp(360px, 29vw, 460px); grid-template-rows: minmax(0, 1fr);
  opacity: 1; transform: none; visibility: visible; pointer-events: auto; }
.side { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--line); position: relative; background: var(--bg); }
.root.app .in-settings .sb, .in-settings .side .sb { display: block; }
.side .sb { border-bottom: 1px solid var(--line); }
.side .srow { flex-wrap: wrap; }
.side .srow input { flex: 1 1 100%; }
.side .srow select { flex: 1; }
.slist { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 8px; }
.slist h6 { margin: 10px 8px 4px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--fg3); font-weight: 600; }
.slist h6:first-child { margin-top: 4px; }
.slist .none { padding: 4px 8px 6px; font-size: 12px; color: var(--fg3); }
.slist .mi.cur { background: var(--bg3); }
.slist .mi.cur .n { font-weight: 600; }
.slist .mi.pinb { border: 1px solid var(--line); margin-bottom: 4px; }
.side .menu { left: 8px; right: 8px; width: auto; }
.mainc { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.mainc .body { padding: 18px 24px 28px; }
.mainc .body > * { max-width: 920px; margin-left: auto; margin-right: auto; }
.mainc .libar { padding: 8px 24px; }
.mainc .libar > * { max-width: 920px; margin-left: auto; margin-right: auto; }
.aip { border-left: 1px solid var(--line); background: var(--bg2); overflow-y: auto; overscroll-behavior: contain; padding: 14px; min-height: 0; }
.aip .ph { color: var(--fg3); font-size: 12.5px; padding: 18px 6px; text-align: center; }
.lk img.fbi { width: 14px; height: 14px; display: block; border-radius: 3px; }
.qm img.fbi { width: 15px; height: 15px; display: block; border-radius: 3px; }
img.fbi { border-radius: 3px; }
.clogo img { width: 100%; height: 100%; display: block; object-fit: contain; }
.set .datarow { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.set .impres { margin-top: 6px; }
.impf { display: none; }
.drawer .pdf { position: relative; } .drawer .pdf .rl { position: absolute; right: 12px; bottom: 10px; font: inherit; font-size: 11.5px; background: var(--bg); color: var(--fg2); border: 1px solid var(--line); border-radius: 6px; padding: 3px 8px; cursor: pointer; box-shadow: var(--shadow); } .drawer .pdf .rl:hover { color: var(--fg); }
`;

const BASE_CSS = `
:host { all: initial; color-scheme: light; }
* { box-sizing: border-box; }
.root {
--bg: #ffffff; --bg2: #f7f7f8; --bg3: #eeeff1; --bg4: #e4e6e9; --fg: #1f2328; --fg2: #57606a; --fg3: #6e7781;
--line: #e5e7eb; --line2: #d5d8dd; --pri: #24292f; --pri-h: #353b42; --pri-fg: #ffffff; --focus: rgba(36, 41, 47, .14);
--good: #1a7f37; --good-soft: #eaf6ed; --warn: #9a6700; --warn-soft: #fff6dc; --bad: #b42318; --bad-soft: #fdeceb;
--c-ch: #2f5f98; --c-ch-soft: #edf2f9; --c-person: #6f42c1; --c-person-soft: #f3effb; --c-place: #0f766e; --c-place-soft: #e7f4f2;
--shadow: 0 14px 36px rgba(17, 24, 39, .14), 0 2px 6px rgba(17, 24, 39, .06);
--eo: cubic-bezier(.2, .8, .2, 1); --d1: 150ms; --d2: 200ms; --d3: 240ms;
font: 13px/1.45 'Prosper Inter', Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: var(--fg);
font-feature-settings: 'cv11', 'ss01'; color-scheme: light; -webkit-font-smoothing: antialiased;
}
.root.mono { --c-ch: var(--fg); --c-person: var(--fg); --c-place: var(--fg); --c-ch-soft: var(--bg3); --c-person-soft: var(--bg3); --c-place-soft: var(--bg3); }
button, input, select { font: inherit; color: inherit; }
a { color: var(--c-ch); text-decoration: none; } a:hover { text-decoration: underline; }
svg { flex: none; }

/* pill + edge */
.pill { position: fixed; z-index: 3; width: 36px; height: 36px; display: grid; place-items: center; padding: 0; border-radius: 8px; border: 0; background: var(--pri); color: var(--pri-fg);
box-shadow: 0 6px 18px rgba(17,24,39,.22), 0 1px 2px rgba(17,24,39,.2), inset 0 0 0 1px rgba(255,255,255,.08); cursor: pointer; opacity: 0; transform: translateY(6px) scale(.6); transform-origin: 30% 20%; pointer-events: none; }
.pill.show { opacity: 1; transform: none; pointer-events: auto; }
.pill .p { font-family: 'Prosper Display', 'DM Sans', system-ui, sans-serif; font-weight: 700; font-size: 19px; line-height: 1; letter-spacing: -.01em; transform: translateY(-.5px); }
.pill .t { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
.pill:hover, .pill:focus-visible { background: var(--pri-h); outline: none; }
.pill.show:active { transform: scale(.94); }
.edge { position: fixed; right: 0; top: 42%; z-index: 1; width: 24px; height: 60px; border-radius: 9px 0 0 9px; background: var(--pri); cursor: pointer; display: grid; place-items: center;
border: 0; padding: 0 0 0 1px; color: var(--pri-fg); font-family: 'Prosper Display', 'DM Sans', system-ui, sans-serif; font-weight: 700; font-size: 14px; line-height: 1; overflow: hidden;
box-shadow: -2px 3px 12px rgba(17,24,39,.24), inset 0 0 0 1px rgba(255,255,255,.08); opacity: .94; }
.edge:hover, .edge:focus-visible { width: 30px; opacity: 1; outline: none; box-shadow: -3px 4px 16px rgba(17,24,39,.3); }
.edge.tucked { transform: translateX(110%); pointer-events: none; }
.edge.hide { display: none; }

/* panel */
.panel { position: fixed; right: 12px; top: 12px; bottom: 12px; width: 380px; max-width: calc(100vw - 24px); z-index: 2; display: flex; flex-direction: column;
background: var(--bg); border: 1px solid rgba(31,35,40,.18); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden;
opacity: 0; transform: translateX(calc(100% + 16px)); visibility: hidden; pointer-events: none; }
.panel.open { opacity: 1; transform: none; visibility: visible; pointer-events: auto; }
.hd { display: flex; align-items: center; gap: 6px; padding: 10px 10px 10px 14px; border-bottom: 1px solid var(--line); flex: none; position: relative; }
.brand { font-family: 'Prosper Display', 'DM Sans', system-ui, sans-serif; font-weight: 700; font-size: 18px; letter-spacing: -.015em; line-height: 1; color: var(--fg); flex: 1; }
.ib { width: 30px; height: 30px; flex: none; border: 0; padding: 0; background: transparent; border-radius: 7px; cursor: pointer; display: grid; place-items: center; color: var(--fg2); }
.ib:hover { background: var(--bg3); color: var(--fg); } .ib.on { color: var(--fg); background: var(--bg4); }
.ib svg { width: 16px; height: 16px; }
.hd .ib { color: #2b3038; }
.hd .ib.x:hover, .hd .ib.x:focus-visible { color: #cf222e; background: #fdecee; }
.sb { padding: 10px 14px; border-bottom: 1px solid var(--line); flex: none; background: var(--bg2); }
.in-settings .sb { display: none; }
.badge { display: inline-flex; align-items: center; height: 18px; padding: 0 6px; border-radius: 4px; font-size: 10.5px; font-weight: 600; letter-spacing: .02em; text-transform: uppercase;
background: var(--bg3); color: var(--fg2); white-space: nowrap; flex: none; }
.badge.r { background: var(--bad-soft); color: var(--bad); } .badge.w { background: var(--warn-soft); color: var(--warn); } .badge.k { background: var(--pri); color: var(--pri-fg); }
.srow { display: flex; gap: 6px; }
.srow input { flex: 1; min-width: 0; height: 32px; padding: 0 10px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); outline: none; }
.srow input:focus, .set input:focus, .set select:focus { border-color: var(--line2); box-shadow: 0 0 0 3px var(--focus); }
.srow select { height: 32px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); padding: 0 6px; font-size: 12px; color: var(--fg2); }
.btn { height: 30px; padding: 0 11px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); cursor: pointer; font-size: 12.5px; font-weight: 500; white-space: nowrap;
display: inline-flex; align-items: center; gap: 5px; text-decoration: none; color: var(--fg); }
.btn:hover { background: var(--bg2); border-color: var(--line2); text-decoration: none; } .btn:disabled { opacity: .55; cursor: default; }
.btn.pri { background: var(--pri); border-color: var(--pri); color: var(--pri-fg); } .btn.pri:hover { background: var(--pri-h); border-color: var(--pri-h); }
.btn.sm { height: 26px; padding: 0 9px; font-size: 12px; }
.btn svg { width: 12px; height: 12px; }
.btn.done { color: var(--good); border-color: var(--line2); } .btn.pri.done { color: var(--pri-fg); }
.btn.done svg { animation: tick var(--d2) var(--eo) both; }
.body { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 10px 10px 14px; background: var(--bg2); }
.body > * + * { margin-top: 8px; }

/* cards & collapsible blocks */
.card, .blk { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; }
.card { padding: 12px 14px; }
.blk + .blk { margin-top: 8px; }
.bh { display: flex; align-items: center; gap: 6px; min-height: 38px; padding: 0 10px 0 14px; cursor: pointer; user-select: none; border-radius: 10px; outline: none; }
.bh:hover { background: var(--bg2); } .bh:focus-visible { box-shadow: inset 0 0 0 2px var(--focus); }
.blk:not(.closed) > .bh { border-radius: 10px 10px 0 0; border-bottom: 1px solid var(--line); }
.bt { font-size: 12.5px; font-weight: 600; color: var(--fg); display: inline-flex; align-items: center; gap: 4px; }
a.bt { color: var(--fg); white-space: nowrap; } a.bt:hover { color: var(--c-ch); text-decoration: none; } a.bt svg { color: var(--c-ch); width: 10px; height: 10px; }
[data-act=ext] > svg { width: 10px; height: 10px; flex: none; }
.bh .xl { font-size: 11.5px; font-weight: 500; }
.sp { flex: 1; }
.cnt { min-width: 20px; height: 18px; padding: 0 6px; border-radius: 9px; background: var(--bg3); color: var(--fg2); font-size: 11px; font-weight: 600; display: inline-grid; place-items: center; white-space: nowrap; }
.cnt.bad { background: var(--bad-soft); color: var(--bad); } .cnt.warn { background: var(--warn-soft); color: var(--warn); }
.chev { width: 22px; height: 22px; display: grid; place-items: center; color: var(--fg3); }
.chev svg { width: 14px; height: 14px; }
.blk.closed > .bh .chev { transform: rotate(-90deg); }
.bb { display: grid; grid-template-rows: 1fr; }
.blk.closed > .bb { grid-template-rows: 0fr; }
.bi { overflow: hidden; min-height: 0; }
.blk.closed > .bb > .bi { visibility: hidden; opacity: 0; }
.bc { padding: 10px 14px 12px; }
.rec { background: transparent; border: 0; }
.rec > .bh { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; }
.rec:not(.closed) > .bh { border-radius: 10px; border-bottom: 1px solid var(--line); }
.rec > .bh .bt { text-transform: uppercase; font-size: 11px; letter-spacing: .05em; color: var(--fg2); }
.rec > .bb > .bi > .bc { padding: 8px 0 0; }
.crumb { display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; color: var(--fg2); font-size: 12px; cursor: pointer; padding: 2px 4px; border-radius: 5px; max-width: 100%; }
.crumb:hover { color: var(--fg); background: var(--bg3); } .crumb svg { width: 12px; height: 12px; }
.crumb span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* content */
.title { font-size: 15px; font-weight: 600; line-height: 1.3; margin: 0 0 3px; }
.hcard > .title { font-size: 17px; letter-spacing: -.01em; line-height: 1.25; }
.hcard > .title .cv { font-weight: 600; }
.title a { color: var(--fg); } .title a:hover { color: var(--c-ch); }
.title a svg { width: 12px; height: 12px; color: var(--c-ch); margin-left: 3px; vertical-align: 0; }
.sub { color: var(--fg2); font-size: 12px; }
.kv { display: grid; grid-template-columns: 100px 1fr; gap: 5px 10px; font-size: 12.5px; margin: 0; }
.kv dt { color: var(--fg2); } .kv dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.verdict { display: flex; gap: 7px; align-items: baseline; padding: 8px 9px; border-radius: 8px; background: var(--good-soft); margin-top: 10px; }
.verdict > div:last-child { min-width: 0; flex: 1; }
.verdict.check { background: var(--warn-soft); } .verdict.caution { background: var(--bad-soft); }
.verdict .vl { font-weight: 700; font-size: 11.25px; color: var(--good); white-space: nowrap; }
.verdict.check .vl { color: var(--warn); } .verdict.caution .vl { color: var(--bad); }
.verdict ul { margin: 0; padding: 0; list-style: none; font-size: 11.25px; line-height: 1.4; }
.verdict ul.one li { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.verdict li + li { margin-top: 2px; }
.also { margin-top: 6px; font-size: 12px; color: var(--fg2); } .also b { color: var(--fg); font-weight: 600; }
.list { margin: 0; padding: 0; list-style: none; }
.list > li { padding: 6px 6px; margin: 0 -6px; display: flex; gap: 8px; justify-content: space-between; align-items: baseline; font-size: 12.5px; border-radius: 6px; }
.list > li + li { border-top: 1px solid var(--line); border-radius: 0; }
.list > li.hov:hover { background: var(--bg2); }
.list .m { color: var(--fg2); font-size: 11.5px; white-space: nowrap; flex: none; }
.list .n { min-width: 0; flex: 1; }
.list .n small { display: block; color: var(--fg2); font-size: 11.5px; }
.ovd { display: inline-block; margin-left: 6px; padding: 0 5px; border-radius: 3px; background: var(--bad); color: #fff; font-size: 10px; font-weight: 700; letter-spacing: .04em; vertical-align: 1px; }
.row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.hint { font-size: 11.5px; color: var(--fg3); margin-top: 7px; }
.picker { margin-top: 8px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.picker summary { cursor: pointer; padding: 6px 10px; font-size: 12px; color: var(--fg2); background: var(--bg2); list-style: none; display: flex; justify-content: space-between; }
.picker summary::-webkit-details-marker { display: none; }
.picker[open] summary { border-bottom: 1px solid var(--line); }
.picker .opts { max-height: 196px; overflow-y: auto; }
.opt { display: flex; width: 100%; text-align: left; gap: 8px; justify-content: space-between; align-items: center; padding: 6px 10px; border: 0; background: var(--bg); cursor: pointer; font-size: 12.5px; }
.opt + .opt { border-top: 1px solid var(--line); }
.opt:hover { background: var(--bg2); } .opt.cur { background: var(--bg3); }
.opt .n { min-width: 0; } .opt small { display: block; color: var(--fg2); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px; }
.state { padding: 22px 16px; text-align: center; color: var(--fg2); font-size: 12.5px; }
.state b { display: block; color: var(--fg); font-size: 13.5px; margin-bottom: 4px; }
.state .btn { margin-top: 10px; }
.err { padding: 10px 12px; border-radius: 8px; background: var(--bad-soft); color: var(--fg); font-size: 12.5px; border: 1px solid #f6d4d0; }
.err b { color: var(--bad); }
.err.tight { margin: 0 0 8px; }

/* links: colour-coded by kind; .x = opens in new tab (arrow icon) */
.lk-ch, .lk-person, .lk-place { border: 0; background: none; padding: 0; font: inherit; cursor: pointer; text-align: left; text-decoration: none; display: inline; }
.lk-ch { color: var(--c-ch); } .lk-person { color: var(--c-person); font-weight: 500; } .lk-place { color: var(--c-place); }
.lk-ch:hover, .lk-person:hover, .lk-place:hover { text-decoration: underline; text-underline-offset: 2px; }
.lk-ch svg, .lk-person svg, .lk-place svg { width: 10px; height: 10px; margin-left: 2px; vertical-align: 0; opacity: .8; }
.xi { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 4px; color: var(--fg3); vertical-align: -4px; margin-left: 2px; border: 0; background: none; cursor: pointer; padding: 0; }
.xi:hover { background: var(--bg3); color: var(--c-ch); } .xi.p:hover { color: var(--c-person); } .xi.pl:hover { color: var(--c-place); }
.xi svg { width: 11px; height: 11px; }
.chip { border: 1px solid var(--line); background: var(--bg); border-radius: 10px; height: 20px; padding: 0 7px; font-size: 11px; color: var(--fg2); cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; gap: 3px; }
.chip:hover { border-color: var(--line2); color: var(--fg); background: var(--bg2); }
.chip.on { background: var(--c-person-soft); border-color: transparent; color: var(--c-person); }
.chip.pl { color: var(--c-place); } .chip.pl:hover, .chip.pl.on { background: var(--c-place-soft); border-color: transparent; }
.chip svg { width: 10px; height: 10px; }
.roles { margin: 5px 0 1px; padding: 6px 8px; border-radius: 6px; background: var(--bg2); font-size: 12px; }
.roles div + div { margin-top: 3px; }
.roles .m { color: var(--fg2); font-size: 11px; }
.cv { cursor: copy; border-radius: 3px; position: relative; }
.cv:hover { background: var(--bg3); box-shadow: 0 0 0 2px var(--bg3); }
.cv.copied::after { content: 'Copied'; position: absolute; left: 50%; bottom: calc(100% + 4px); transform: translateX(-50%); background: var(--pri); color: var(--pri-fg); font-size: 10.5px; font-weight: 600;
padding: 2px 6px; border-radius: 4px; white-space: nowrap; pointer-events: none; z-index: 2; }
.map { margin-top: 8px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--bg2); }
.map iframe { display: block; width: 100%; height: 180px; border: 0; }
.map .mmsg { padding: 8px 10px; font-size: 11.5px; color: var(--fg2); }
.map.fail iframe { display: none; }
.legend { display: grid; gap: 5px; font-size: 12px; margin-top: 6px; padding: 8px 10px; border-radius: 8px; background: var(--bg2); }
.legend .sw { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 7px; vertical-align: -1px; }
.legend svg, .sub > svg, .hint svg { width: 10px; height: 10px; vertical-align: 0; }
.sw.ch { background: var(--c-ch); } .sw.person { background: var(--c-person); } .sw.place { background: var(--c-place); }

/* quick links */
.links { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.lk { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 8px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); cursor: pointer; font-size: 12px; min-width: 0; }
.lk:hover { border-color: var(--line2); background: var(--bg2); }
.lk canvas, .lk .fb { width: 14px; height: 14px; flex: none; border-radius: 3px; }
.lk .fb { background: var(--fbc, var(--bg3)); display: grid; place-items: center; font-size: 7.5px; font-weight: 700; color: #fff; letter-spacing: -.02em; line-height: 1; }
.lk .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; text-align: left; }
.lk kbd { font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--fg3); }

/* skeleton */
.skel { height: 12px; border-radius: 4px; background: var(--bg3); margin: 8px 0; }
.skel.w45 { width: 45%; } .skel.w60 { width: 60%; } .skel.w75 { width: 75%; } .skel.w82 { width: 82%; } .skel.w85 { width: 85%; } .skel.w90 { width: 90%; }
.skel.h1 { width: 70%; height: 16px; margin-top: 2px; } .skel.blk2 { width: 100%; height: 46px; border-radius: 8px; }
.skc { padding: 12px 14px; }
.spin { width: 14px; height: 14px; border: 2px solid var(--line); border-top-color: var(--pri); border-radius: 50%; animation: sp .7s linear infinite; display: inline-block; vertical-align: -2px; }
@keyframes sp { to { transform: rotate(360deg); } }

/* brief */
.brief p { margin: 0 0 3px; font-size: 12.5px; }
.brief h5 { margin: 10px 0 4px; font-size: 11.5px; font-weight: 600; color: var(--fg2); }
.brief ul { margin: 0; padding-left: 16px; font-size: 12.5px; } .brief li { margin: 2px 0; }
.brief .src a { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; }
.cost { font-size: 11px; color: var(--fg3); margin-top: 8px; }

/* person / officers search */
.off { padding: 8px 0; } .off + .off { border-top: 1px solid var(--line); }
.off .on { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.off .on b { font-weight: 600; font-size: 12.5px; }
.appt { margin: 6px 0 0; padding: 0; list-style: none; }
.appt li { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; font-size: 12px; align-items: baseline; }
.appt .m { color: var(--fg2); font-size: 11px; white-space: nowrap; }
.pv h3 { margin: 0; font-size: 15px; font-weight: 600; color: var(--c-person); }
.stat { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }

/* filings viewer */
.fl > li { cursor: pointer; }
.fl .ty { font: 600 10px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--fg2); background: var(--bg3); padding: 1px 4px; border-radius: 3px; margin-right: 5px; }
.fl > li.cur { background: var(--c-ch-soft); }
.pdf { margin-top: 10px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--bg2); min-height: 60px; }
.pdf iframe { display: block; width: 100%; height: 430px; border: 0; background: #fff; }
.pdf .mmsg { padding: 14px 12px; font-size: 12px; color: var(--fg2); text-align: center; }
.vlist { max-height: 260px; overflow-y: auto; margin-top: 4px; }
/* filings drawer */
.drawer { position: fixed; top: 12px; bottom: 12px; right: 404px; width: 720px; z-index: 2; display: flex; flex-direction: column; background: var(--bg); color: var(--fg);
border: 1px solid rgba(31,35,40,.18); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; opacity: 0; transform: translateX(32px); visibility: hidden; pointer-events: none; }
.drawer.open { opacity: 1; transform: none; visibility: visible; pointer-events: auto; }
.drawer.over { z-index: 3; }
.dw-hd { display: flex; align-items: center; gap: 4px; padding: 9px 10px 9px 16px; border-bottom: 1px solid var(--line); flex: none; }
.dw-t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.dw-t b { font-size: 13.5px; font-weight: 600; }
.dw-t span { font-size: 12px; color: var(--fg2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dw-hd .pos { font-size: 12px; color: var(--fg2); font-variant-numeric: tabular-nums; white-space: nowrap; margin-right: 4px; }
.dw-hd .ib[disabled] { opacity: .35; cursor: default; background: transparent; }
.dw-bd { flex: 1; min-height: 0; display: grid; grid-template-columns: 300px minmax(0, 1fr); }
.drawer.narrow .dw-bd { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(150px, 38%) minmax(0, 1fr); }
.dw-side { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--line); background: var(--bg2); }
.drawer.narrow .dw-side { border-right: 0; border-bottom: 1px solid var(--line); }
.dw-sr { display: flex; align-items: center; gap: 6px; margin: 10px 10px 8px; height: 30px; padding: 0 9px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); color: var(--fg3); cursor: text; }
.dw-sr:focus-within { border-color: var(--line2); box-shadow: 0 0 0 3px var(--focus); }
.dw-sr svg { width: 14px; height: 14px; flex: none; }
.dw-q { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; font: inherit; font-size: 12.5px; color: var(--fg); padding: 0; height: 100%; }
.dw-cats { display: flex; flex-wrap: wrap; gap: 4px; padding: 0 10px 9px; border-bottom: 1px solid var(--line); flex: none; }
.dw-cats button { height: 22px; padding: 0 8px; border: 1px solid var(--line); border-radius: 11px; background: var(--bg); font: inherit; font-size: 11.5px; color: var(--fg2); cursor: pointer; white-space: nowrap; }
.dw-cats button:hover { border-color: var(--line2); color: var(--fg); }
.dw-cats button.on { background: var(--pri); border-color: var(--pri); color: var(--pri-fg); }
.dw-cats button i { font-style: normal; opacity: .6; margin-left: 4px; font-variant-numeric: tabular-nums; }
.dw-list { list-style: none; margin: 0; padding: 4px 6px; overflow-y: auto; flex: 1; min-height: 0; overscroll-behavior: contain; }
.dwr { padding: 7px 9px 7px 10px; border-radius: 7px; cursor: pointer; position: relative; outline: none; }
.dwr + .dwr { margin-top: 1px; }
.dwr:hover { background: var(--bg3); }
.dwr.cur { background: var(--bg); box-shadow: 0 0 0 1px var(--line2), 0 1px 2px rgba(17,24,39,.06); }
.dwr.cur::before { content: ''; position: absolute; left: 0; top: 8px; bottom: 8px; width: 2px; border-radius: 2px; background: var(--pri); }
.dwr:focus-visible { box-shadow: 0 0 0 2px var(--focus), 0 0 0 1px var(--line2); }
.dwr .tx { font-size: 12.5px; line-height: 1.35; color: var(--fg); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.dwr.nodoc .tx { color: var(--fg2); }
.dwr .mt { display: flex; gap: 7px; margin-top: 2px; font-size: 11px; color: var(--fg3); font-variant-numeric: tabular-nums; }
.dwr .mt .ty, .dw-doc .ty { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; font-size: 10.5px; color: var(--fg2); }
.dw-none, .dw-more { list-style: none; padding: 12px 8px; text-align: center; font-size: 12px; color: var(--fg3); }
.dw-kb { flex: none; padding: 6px 10px; border-top: 1px solid var(--line); font-size: 11px; color: var(--fg3); }
.dw-kb kbd { font: inherit; font-size: 10.5px; padding: 0 4px; border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 4px; background: var(--bg); color: var(--fg2); margin-right: 2px; }
.drawer.narrow .dw-kb { display: none; }
.dw-doc { display: flex; flex-direction: column; min-width: 0; min-height: 0; padding: 12px 14px 14px; }
.dw-doc h3 { margin: 0; font-size: 14px; font-weight: 600; line-height: 1.35; }
.dw-doc .meta { font-size: 12px; color: var(--fg2); margin-top: 3px; } .dw-doc .meta .ty { margin-right: 7px; }
.dw-doc > .row { margin-top: 9px; flex: none; }
.dw-doc .pdf { flex: 1; min-height: 120px; margin-top: 10px; display: flex; flex-direction: column; }
.dw-doc .pdf iframe { flex: 1; height: auto; min-height: 0; }
.dw-doc .pdf .mmsg { margin: auto 0; }

/* pins & recent menu */
.menu { position: absolute; top: 46px; right: 10px; width: 280px; max-height: 360px; overflow-y: auto; z-index: 5; background: var(--bg); border: 1px solid var(--line); border-radius: 10px;
box-shadow: var(--shadow); padding: 6px; opacity: 0; transform: translateY(-4px); visibility: hidden; pointer-events: none; }
.menu.show { opacity: 1; transform: none; visibility: visible; pointer-events: auto; }
.menu h6 { margin: 6px 8px 4px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--fg3); font-weight: 600; }
.mi { display: flex; align-items: center; gap: 6px; width: 100%; border: 0; background: none; padding: 6px 8px; border-radius: 6px; cursor: pointer; text-align: left; font-size: 12.5px; }
.mi:hover { background: var(--bg2); }
.mi .n { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mi small { color: var(--fg3); font-size: 11px; }
.mi svg { width: 13px; height: 13px; color: var(--fg3); }
.menu .none { padding: 4px 8px 6px; font-size: 12px; color: var(--fg3); }

/* settings */
.set .grp { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 4px 14px 12px; }
.set .grp + .grp { margin-top: 8px; }
.set .gh { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--fg3); margin: 10px 0 4px; }
.set label.f { display: block; font-size: 12px; color: var(--fg2); margin: 10px 0 4px; font-weight: 500; }
.set input[type=password], .set input[type=text], .set select { width: 100%; height: 32px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); padding: 0 10px; outline: none; }
.set .tg { display: flex; gap: 10px; align-items: flex-start; justify-content: space-between; padding: 8px 0; font-size: 12.5px; cursor: pointer; }
.set .tg + .tg { border-top: 1px solid var(--line); }
.set .tg span small { display: block; color: var(--fg3); font-size: 11.5px; margin-top: 1px; }
.set .tg input { appearance: none; -webkit-appearance: none; flex: none; width: 30px; height: 18px; border-radius: 9px; background: var(--bg4); position: relative; margin: 1px 0 0; cursor: pointer; }
.set .tg input::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.2); }
.set .tg input:checked { background: var(--pri); } .set .tg input:checked::after { transform: translateX(12px); }
.set .tg input:focus-visible { box-shadow: 0 0 0 3px var(--focus); }
.set .help { font-size: 11.5px; color: var(--fg3); margin-top: 3px; }
.set .seg { display: flex; border: 1px solid var(--line); border-radius: 7px; overflow: hidden; }
.set .seg label { flex: 1; text-align: center; padding: 6px 2px; font-size: 12px; cursor: pointer; }
.set .seg label + label { border-left: 1px solid var(--line); }
.set .seg input { display: none; }
.set .seg label:has(input:checked) { background: var(--pri); color: var(--pri-fg); font-weight: 600; }
.set .top { display: flex; align-items: center; justify-content: space-between; padding: 2px 2px 8px; }
.set .top h4 { margin: 0; font-size: 14px; font-weight: 600; }
.saved { color: var(--good); font-size: 12px; margin-left: 8px; }
.toast { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%) translateY(8px); background: var(--pri); color: var(--pri-fg); padding: 6px 12px; border-radius: 6px; font-size: 12px;
opacity: 0; pointer-events: none; white-space: nowrap; z-index: 6; }
.toast.show { opacity: 1; transform: translateX(-50%); }
.probe { position: absolute; width: 3px; height: 0; overflow: hidden; visibility: hidden; }
.mt4 { margin-top: 4px; } .mt5 { margin-top: 5px; } .mt6 { margin-top: 6px; } .mt8 { margin-top: 8px; } .mt10 { margin-top: 10px; } .mt14 { margin-top: 14px; } .m0 { margin: 0; } .mb8 { margin-bottom: 8px; }
.pt0 { padding-top: 0; } .jsb { justify-content: space-between; } .ifc { display: inline-flex; align-items: center; }
.sep { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--line); }
.warnk { color: var(--warn); }
.diag { margin-top: 10px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.diag .dr { display: grid; grid-template-columns: 46px 1fr; gap: 8px; padding: 7px 10px; font-size: 12px; align-items: start; }
.diag .dr + .dr { border-top: 1px solid var(--line); }
.diag .dr b { font-weight: 600; } .diag .dr .dd { color: var(--fg2); font-size: 11.5px; overflow-wrap: anywhere; }
.diag .st { display: inline-block; text-align: center; padding: 1px 0; border-radius: 4px; font-size: 10px; font-weight: 700; letter-spacing: .04em; }
.diag .st.pass { background: var(--good-soft); color: var(--good); } .diag .st.fail { background: var(--bad-soft); color: var(--bad); } .diag .st.info { background: var(--bg3); color: var(--fg2); }

/* v11.3: quick-link row with menus (hover, click and keyboard) */
.qrow { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
.qb { position: relative; display: inline-flex; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); }
.qb:hover, .qb.open { border-color: var(--line2); }
.qm, .qc { border: 0; background: none; cursor: pointer; height: 28px; display: inline-grid; place-items: center; color: var(--fg2); padding: 0; }
.qm { width: 34px; border-radius: 6px; } .qb.multi .qm { border-radius: 6px 0 0 6px; }
.qc { width: 17px; border-left: 1px solid var(--line); border-radius: 0 6px 6px 0; }
.qm:hover, .qc:hover, .qm:focus-visible, .qc:focus-visible, .qb.open .qc { background: var(--bg2); outline: none; color: var(--fg); }
.qc svg { width: 10px; height: 10px; }
.qm canvas, .qm .fb { width: 15px; height: 15px; border-radius: 3px; }
.qm .fb { background: var(--fbc, var(--bg3)); display: grid; place-items: center; font-size: 7.5px; font-weight: 700; color: #fff; letter-spacing: -.02em; line-height: 1; }
.qmenu, .shm { position: absolute; top: 100%; left: -1px; padding-top: 4px; z-index: 4; min-width: 160px; opacity: 0; visibility: hidden; transform: translateY(-3px); pointer-events: none; }
.hov-menus .qb:not(.qn):hover > .qmenu, .qb.open > .qmenu, .shm.show { opacity: 1; visibility: visible; transform: none; pointer-events: auto; }
.qin { background: var(--bg); border: 1px solid var(--line); border-radius: 8px; box-shadow: var(--shadow); padding: 4px; }
.qin h6 { margin: 4px 8px 3px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--fg3); font-weight: 600; }
.qi { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 8px; border: 0; background: none; border-radius: 5px; font-size: 12.5px; cursor: pointer; text-align: left; color: var(--fg); text-decoration: none; white-space: nowrap; }
.qi:hover, .qi:focus-visible { background: var(--bg2); outline: none; text-decoration: none; }
.qi svg { width: 10px; height: 10px; color: var(--fg3); }
.shwrap { position: relative; display: inline-block; }
.shm { left: auto; right: 0; }
/* per-person link icons */
.plk { display: inline-flex; gap: 3px; margin-left: 5px; vertical-align: -3px; opacity: .7; white-space: nowrap; }
li:hover .plk, .pv .plk, .plk:focus-within { opacity: 1; }
.plk a { min-width: 18px; height: 16px; padding: 0 3px; box-sizing: border-box; display: inline-grid; place-items: center; border: 1px solid var(--line); border-radius: 4px; background: var(--bg); color: var(--fg2); font: 700 8.5px/1 'Prosper Inter', Inter, system-ui, sans-serif; text-decoration: none; letter-spacing: -.01em; }
.mono .plk a { color: var(--fg2) !important; }
.plk a.li { color: #0a66c2; } .plk a.g { color: #1a73e8; } .plk a.c { color: var(--c-ch); }
.plk a:hover, .plk a:focus-visible { background: var(--bg2); border-color: var(--line2); text-decoration: none; outline: none; }
/* question chips + answers */
.qa { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--line); }
.qa h5 { margin: 0 0 6px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.qchip { border: 1px solid var(--line); background: var(--bg); border-radius: 14px; padding: 4px 10px; font-size: 12px; cursor: pointer; color: var(--fg); text-align: left; }
.qchip:hover, .qchip:focus-visible { background: var(--bg2); border-color: var(--line2); outline: none; }
.qchip.sug { border-style: dashed; } .qchip.on { background: var(--bg3); border-color: var(--line2); }
.ans { margin-top: 8px; padding: 9px 11px; border-radius: 8px; background: var(--bg2); font-size: 12.5px; border: 1px solid var(--line); }
.ans .aq { font-weight: 600; margin-bottom: 4px; } .ans .at { white-space: pre-wrap; }
.ans .row { margin-top: 6px; } .ans .cost { margin: 0; }
/* shortcut cheat sheet + hotkey settings */
.sheet { position: absolute; left: 10px; right: 10px; top: 52px; z-index: 6; background: var(--bg); border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--shadow); padding: 10px 14px 12px;
opacity: 0; visibility: hidden; transform: translateY(-4px); pointer-events: none; }
.sheet.show { opacity: 1; visibility: visible; transform: none; pointer-events: auto; }
.sheet h4 { margin: 0; font-size: 13px; font-weight: 600; }
.sheet dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; margin: 10px 0 0; font-size: 12.5px; align-items: center; }
.sheet dd { margin: 0; color: var(--fg2); }
kbd.k, .kbd { font: 600 11px ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--bg2); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 5px; padding: 2px 6px; color: var(--fg); white-space: nowrap; }
.set .hk { display: flex; align-items: center; gap: 6px; padding: 7px 0; font-size: 12.5px; }
.set .hk + .hk { border-top: 1px solid var(--line); }
.set .hk > span { flex: 1; } .set .hk small { display: block; font-size: 11px; margin-top: 1px; }
.set .hk .kbd { cursor: pointer; min-width: 92px; text-align: center; }
.set .hk .kbd:hover { border-color: var(--line2); background: var(--bg3); }
.set .hk .kbd.rec { background: var(--pri); color: var(--pri-fg); border-color: var(--pri); }
.set .hk .kbd.off { color: var(--fg3); font-weight: 500; }

/* v11.4: AI accent (soft violet -> amber) on AI elements only */
.root { --ai-v: #c7b6f7; --ai-a: #f2d29f; --ai-vs: #f6f2ff; --ai-as: #fff8ec; --ai-ink: #6d55c2; }
.spark { width: 15px; height: 15px; flex: none; }
.genbtn { position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin-top: 10px; height: 42px; border-radius: 10px; border: 1px solid transparent; cursor: pointer;
font: 600 13px/1 'Prosper Inter', Inter, system-ui, sans-serif; color: var(--fg); padding: 0 14px;
background: linear-gradient(90deg, var(--ai-vs), var(--ai-as)) padding-box, linear-gradient(90deg, var(--ai-v), var(--ai-a)) border-box; }
.genbtn:hover { background: linear-gradient(90deg, #efe8ff, #fff1d9) padding-box, linear-gradient(90deg, #b39cf5, #ecc07a) border-box; }
.genbtn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(167, 139, 250, .35); }
.genbtn::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 60%; background: linear-gradient(105deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.8) 50%, rgba(255,255,255,0) 100%); transform: translateX(-120%); pointer-events: none; }
.genbtn .gs { font-weight: 500; font-size: 11.5px; color: var(--fg3); }
.blk.ai { border-color: #e6ddfb; background: linear-gradient(180deg, #fcfaff 0, var(--bg) 140px); }
.blk.ai > .bh { position: relative; } .blk.ai > .bh .bt { display: inline-flex; align-items: center; gap: 6px; }
.blk.ai { position: relative; }
/* the violet/amber top edge is a real 2px top border on a pseudo-element the exact size and radius of the card, so it follows the rounded corners and tapers like a border */
.blk.ai::before { content: ''; position: absolute; inset: -1px; border-radius: inherit; border-top: 2px solid transparent; background: linear-gradient(90deg, var(--ai-v), var(--ai-a)) border-box; opacity: .8; pointer-events: none; z-index: 1;
-webkit-mask: linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0) border-box; -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) padding-box exclude, linear-gradient(#000 0 0) border-box; }
.blk.ai:not(.closed) > .bh { border-bottom-color: #eee8fc; }
.ai .skel { background: linear-gradient(90deg, #efe9fd 0%, #fbf1df 50%, #efe9fd 100%); background-size: 200% 100%; }
.ldg { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 500; color: var(--ai-ink); }
.ldg .lt { background: linear-gradient(90deg, #8a6fdc, #c98f33, #8a6fdc); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; }
.ai .qchip { border-color: #e4dafb; }
.ai .qchip:hover, .ai .qchip:focus-visible { background: linear-gradient(90deg, var(--ai-vs), var(--ai-as)); border-color: #cbbaf7; }
.ai .qchip.sug { border-color: #efd5a6; }
.ai .qchip.on { background: linear-gradient(90deg, #f1ebff, #fff3df); border-color: #cbbaf7; }
.ai .ans { background: linear-gradient(135deg, #faf8ff, #fffbf3); border: 1px solid #ece4fc; }
.qmenu.alr { left: auto; right: -1px; }
.qin hr { border: 0; border-top: 1px solid var(--line); margin: 4px 2px; }
/* sections: Overview fixed open; map edge to edge */
.blk.fixed > .bh { cursor: default; } .blk.fixed > .bh:hover { background: none; }
.acts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; margin-top: 10px; }
.acts .btn { width: 100%; min-width: 0; justify-content: center; padding: 0 4px; }
.acts .btn span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.map.wide { margin: 10px -14px -12px; border-radius: 0 0 9px 9px; border-left: 0; border-right: 0; border-bottom: 0; }
.map.wide iframe { height: 200px; }
.set .tg.cmp { padding: 6px 0; align-items: center; } .set .tg.cmp.dis { cursor: default; } .set .tg.cmp.dis input { opacity: .45; }
.set .tg.cmp span small { display: inline; margin-left: 6px; }

/* motion (only with .anim; prefers-reduced-motion switches it all off) */
.anim .panel { transition: transform 220ms cubic-bezier(.4,0,1,1), opacity 120ms ease-in 100ms, visibility 0s linear 220ms; }
.anim .panel.open { transition: transform 280ms cubic-bezier(.16,1,.3,1), opacity 140ms ease-out, visibility 0s; }
.anim .pill { transition: opacity 170ms ease-in 40ms, transform 230ms cubic-bezier(.55,-0.45,.75,.6), background-color var(--d1) var(--eo); }
.anim .pill.show { transition: opacity 120ms ease-out, transform 290ms cubic-bezier(.34,1.56,.64,1), background-color var(--d1) var(--eo); }
.anim .pill.show:active { transition: transform 90ms var(--eo); }
.anim .edge { transition: width var(--d1) var(--eo), opacity var(--d1) var(--eo), box-shadow var(--d1) var(--eo), transform 200ms var(--eo); }
.anim .edge:not(.tucked) { transition-delay: 0s, 0s, 0s, 120ms; }
.anim .bb { transition: grid-template-rows 200ms cubic-bezier(.2,.7,.2,1); }
.anim .bb > .bi { transition: opacity 180ms ease-out 20ms; }
.anim .blk.closed > .bb > .bi { transition: opacity 120ms ease-in, visibility 0s linear 200ms; }
.anim .chev { transition: transform var(--d2) var(--eo); }
.anim .bh, .anim .btn, .anim .ib, .anim .lk, .anim .opt, .anim .chip, .anim .mi, .anim .list > li, .anim .cv, .anim .xi, .anim .crumb { transition: background-color var(--d1) var(--eo), border-color var(--d1) var(--eo), color var(--d1) var(--eo), box-shadow var(--d1) var(--eo); }
.anim .drawer { transition: transform 200ms cubic-bezier(.4,0,1,1), opacity 160ms ease-in 40ms, visibility 0s linear 200ms; }
.anim .drawer.open { transition: transform 260ms cubic-bezier(.16,1,.3,1), opacity 180ms ease-out, visibility 0s; }
.anim .dwr, .anim .dw-cats button { transition: background-color var(--d1) var(--eo), border-color var(--d1) var(--eo), color var(--d1) var(--eo), box-shadow var(--d1) var(--eo); }
.anim .qmenu, .anim .shm, .anim .sheet { transition: opacity var(--d1) var(--eo), transform var(--d1) var(--eo), visibility 0s linear var(--d1); }
.anim .hov-menus .qb:not(.qn):hover > .qmenu { transition-delay: 80ms, 80ms, 80ms; }
.anim .qb.open > .qmenu, .anim .shm.show, .anim .sheet.show { transition: opacity var(--d1) var(--eo), transform var(--d1) var(--eo), visibility 0s; }
.anim .ans { animation: rise var(--d3) var(--eo) both; }
.anim .qchip, .anim .qm, .anim .qc, .anim .qi, .anim .plk a, .anim .plk { transition: background-color var(--d1) var(--eo), border-color var(--d1) var(--eo), color var(--d1) var(--eo), opacity var(--d1) var(--eo); }
.anim .genbtn:hover::after { animation: sheen 1.1s var(--eo); }
.anim .genbtn.loading::after { animation: sheen 1.5s linear infinite; }
.anim .ai .skel { background: linear-gradient(90deg, #efe9fd 0%, #fbf1df 50%, #efe9fd 100%); background-size: 200% 100%; animation: shimmer 1.6s linear infinite; }
.anim .ldg .lt { animation: shimmer 2.2s linear infinite; }
.anim .ldg .spark { animation: twinkle 1.6s ease-in-out infinite; }
.anim .blk.ai .bc > div > p { animation: fade var(--d3) var(--eo) both; }
@keyframes sheen { to { transform: translateX(260%); } }
.anim .blk.ai.loading::before { background: linear-gradient(90deg, var(--ai-v), var(--ai-a), var(--ai-v)); background-size: 200% 100%; animation: shimmer 1.4s linear infinite; opacity: 1; }
@keyframes twinkle { 50% { transform: scale(.82) rotate(12deg); opacity: .75; } }
.anim .menu { transition: opacity var(--d1) var(--eo), transform var(--d1) var(--eo), visibility 0s linear var(--d1); }
.anim .menu.show { transition: opacity var(--d1) var(--eo), transform var(--d1) var(--eo), visibility 0s; }
.anim .toast { transition: opacity var(--d1), transform var(--d1) var(--eo); }
.anim .set .tg input, .anim .set .tg input::after { transition: background-color var(--d1) var(--eo), transform var(--d1) var(--eo); }
.anim .enter > *, .anim .enter .rc > .blk { animation: rise var(--d3) var(--eo) both; }
.anim .enter > :nth-child(2), .anim .enter .rc > .blk:nth-child(1) { animation-delay: 30ms; }
.anim .enter > :nth-child(3), .anim .enter .rc > .blk:nth-child(2) { animation-delay: 60ms; }
.anim .enter > :nth-child(4), .anim .enter .rc > .blk:nth-child(3) { animation-delay: 90ms; }
.anim .enter > :nth-child(5), .anim .enter .rc > .blk:nth-child(4) { animation-delay: 120ms; }
.anim .enter > :nth-child(n+6), .anim .enter .rc > .blk:nth-child(n+5) { animation-delay: 150ms; }
.anim .verdict { animation: fade var(--d3) var(--eo) both; animation-delay: 80ms; }
.anim .skel { background: linear-gradient(90deg, var(--bg3) 0%, var(--bg3) 35%, #f7f8f9 50%, var(--bg3) 65%, var(--bg3) 100%); background-size: 300% 100%; animation: shimmer 1.3s linear infinite; }
.anim .cv.copied::after, .anim .roles, .anim .map, .anim .pdf iframe { animation: fade var(--d2) var(--eo) both; }
.anim .cnt.new { animation: fade var(--d2) var(--eo) both; }
@keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes shimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }
@keyframes tick { from { transform: scale(.4); opacity: 0; } to { transform: none; opacity: 1; } }
/* b2: automatic summary, web search, per-company chat, did-you-mean */
.lnk { border: 0; background: none; padding: 0; margin: 0; font: inherit; color: var(--fg2); cursor: pointer; text-decoration: underline; text-decoration-color: var(--line2); text-underline-offset: 2px; }
.lnk:hover, .lnk:focus-visible { color: var(--fg); outline: none; text-decoration-color: currentColor; }
.ai .lnk { color: var(--ai-ink); text-decoration-color: #d9cdf8; }
.brief .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 3px 6px; margin-top: 8px; font-size: 11px; color: var(--fg3); }
.brief .meta .stale { color: var(--warn); }
.brief .meta .lnk { font-size: 11px; }
.webbtn { display: flex; align-items: center; gap: 7px; width: 100%; margin-top: 10px; padding: 8px 10px; border-radius: 9px; border: 1px solid #e4dafb; background: var(--bg); cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 500; color: var(--fg); text-align: left; }
.webbtn small { margin-left: auto; font-size: 11px; font-weight: 400; color: var(--fg3); }
.webbtn:hover, .webbtn:focus-visible { background: linear-gradient(90deg, var(--ai-vs), var(--ai-as)); border-color: #cbbaf7; outline: none; }
.webbtn.sm { width: auto; margin-top: 7px; padding: 4px 10px; font-size: 12px; border-radius: 14px; }
.webbtn svg, .brief h5 svg, .ldg svg.globe { width: 14px; height: 14px; flex: none; color: var(--ai-ink); }
.webpart { margin-top: 12px; padding-top: 10px; border-top: 1px dashed #e6ddfb; }
.brief h5.wh { margin-top: 0; display: flex; align-items: center; gap: 6px; }
.chat { margin-top: 12px; padding-top: 10px; border-top: 1px solid #eee8fc; }
.brief .chat h5 { margin: 0 0 6px; }
.turn { margin: 8px 0 10px; }
.uq { margin-left: auto; width: fit-content; max-width: 86%; padding: 6px 10px; border-radius: 12px 12px 3px 12px; background: var(--bg3); font-size: 12.5px; white-space: pre-wrap; word-break: break-word; }
.ua { margin-top: 6px; max-width: 96%; padding: 8px 10px; border-radius: 12px 12px 12px 3px; background: linear-gradient(135deg, #faf8ff, #fffbf3); border: 1px solid #ece4fc; font-size: 12.5px; }
.ua .at { white-space: pre-wrap; word-break: break-word; }
.ua .meta { margin-top: 6px; }
.ua .src { margin-top: 5px; }
.ua.err2 { background: var(--bad-soft); border-color: #f6d4d0; }
.chat .clr { margin: -2px 0 6px; font-size: 11px; }
.chatbox { display: flex; align-items: flex-end; gap: 6px; margin-top: 6px; padding: 4px 4px 4px 10px; border: 1px solid #e4dafb; border-radius: 10px; background: var(--bg); }
.chatbox:focus-within { border-color: #b9a3f3; box-shadow: 0 0 0 3px rgba(167, 139, 250, .18); }
.chatin { flex: 1; min-width: 0; border: 0; outline: 0; resize: none; background: transparent; color: var(--fg); font: inherit; font-size: 12.5px; line-height: 1.4; padding: 5px 0; height: 28px; max-height: 96px; }
.chatin::placeholder { color: var(--fg3); }
.send { flex: none; width: 28px; height: 28px; display: grid; place-items: center; border: 0; border-radius: 8px; cursor: pointer; color: #fff; background: linear-gradient(135deg, #8f74de, #c99540); }
.send svg { width: 15px; height: 15px; }
.send:hover, .send:focus-visible { filter: brightness(1.07); outline: none; box-shadow: 0 0 0 3px rgba(167, 139, 250, .25); }
.chat .chips { margin-top: 7px; }
.chat .chips:empty { display: none; }
.alt { margin-top: 6px; font-size: 12px; color: var(--fg2); }
.dym .dyh { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; font-size: 12.5px; color: var(--fg2); }
.dym .dyh b { color: var(--fg); font-size: 14px; }
.dym .opts { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.dym .opt { padding: 8px 10px; }
.dym .opt small { max-width: 270px; }
.dym .opt.per { margin-top: 8px; border: 1px dashed var(--line2); border-radius: 8px; }
.dym .hint { margin-top: 8px; }
.anim .turn { animation: rise var(--d3) var(--eo) both; }
/* b4 (2): LinkedIn page prompt, director check, connection note */
.libar { padding: 8px 14px; border-bottom: 1px solid var(--line); background: var(--bg2); font-size: 12.5px; }
.libar[hidden] { display: none; }
.libar .lq { display: flex; align-items: center; gap: 8px; }
.libar .lq .lt { flex: 1; min-width: 0; color: var(--fg); line-height: 1.35; }
.libar .lq .sub { font-size: 11.5px; }
.libar .lq .lgo { flex: none; }
.libar .lq .lx { width: 24px; height: 24px; } .libar .lq .lx svg { width: 13px; height: 13px; }
.libar .lres { margin-top: 7px; padding-top: 7px; border-top: 1px dashed var(--line2); display: grid; gap: 5px; }
.libar .lline { line-height: 1.4; }
.libar .lline .badge { margin-left: 6px; text-transform: none; letter-spacing: 0; vertical-align: 1px; }
.badge.g { background: var(--good-soft); color: var(--good); }
.libar .lres .sub { font-size: 11.5px; }
.libar .lres .sub svg, .libar .lres .ok svg { width: 11px; height: 11px; color: var(--good); vertical-align: -1px; }
.libar .lnk { font-size: 12px; justify-self: start; }
.lichip { position: fixed; right: 30px; top: calc(42% + 14px); z-index: 1; display: flex; align-items: center; gap: 2px; max-width: 280px; padding: 3px 3px 3px 10px; border-radius: 9px; background: var(--bg); color: var(--fg); border: 1px solid var(--line); box-shadow: 0 6px 20px rgba(17,24,39,.14); font: 12.5px/1.3 Inter, system-ui, sans-serif; }
.lichip[hidden] { display: none; }
.lichip .lcq { flex: 1; min-width: 0; border: 0; background: none; padding: 4px 2px; color: inherit; font: inherit; text-align: left; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lichip .lcq:hover { text-decoration: underline; text-underline-offset: 2px; }
.lichip .lcx { flex: none; width: 24px; height: 24px; border: 0; border-radius: 6px; background: none; color: var(--fg3); cursor: pointer; display: grid; place-items: center; }
.lichip .lcx:hover { background: var(--bg3); color: var(--fg); } .lichip .lcx svg { width: 12px; height: 12px; }
.anim .lichip:not([hidden]) { animation: rise var(--d3) var(--eo) both; }
.edge.lidot::after { content: ''; position: absolute; top: 7px; left: 7px; width: 7px; height: 7px; border-radius: 50%; background: var(--ai-a); box-shadow: 0 0 0 2px var(--pri); }
.notebox { margin-top: 10px; padding: 10px; border: 1px solid #e4dafb; border-radius: 9px; background: linear-gradient(180deg, var(--ai-vs), var(--bg) 70px); }
.notebox .nh { display: flex; align-items: center; gap: 8px; }
.notebox .nh h5 { margin: 0; flex: 1; }
.notebox .nh label { font-size: 11.5px; color: var(--fg2); display: inline-flex; align-items: center; gap: 4px; }
.notebox .nh select { max-width: 150px; height: 24px; font: inherit; font-size: 11.5px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--fg); }
.notebox .nh .ib { width: 24px; height: 24px; } .notebox .nh .ib svg { width: 13px; height: 13px; }
.notebox .seg { display: inline-flex; margin: 8px 0 6px; padding: 2px; border-radius: 8px; background: var(--bg3); }
.notebox .seg button { border: 0; background: none; padding: 3px 9px; border-radius: 6px; font: inherit; font-size: 11.5px; color: var(--fg2); cursor: pointer; }
.notebox .seg button.on { background: var(--bg); color: var(--fg); box-shadow: 0 1px 2px rgba(17,24,39,.1); }
.notebox .nta { width: 100%; box-sizing: border-box; resize: vertical; border: 1px solid var(--line); border-radius: 7px; padding: 7px 8px; font: inherit; font-size: 12.5px; line-height: 1.45; color: var(--fg); background: var(--bg); }
.notebox .nta:focus { outline: none; border-color: #cbbaf7; box-shadow: 0 0 0 3px var(--ai-vs); }
.notebox .nmeta { display: flex; align-items: center; gap: 8px; margin-top: 5px; }
.notebox .nmeta .sp { flex: 1; }
.notebox .ncnt { font-size: 11.5px; color: var(--fg2); font-variant-numeric: tabular-nums; } .notebox .ncnt.over { color: var(--bad); font-weight: 600; }
.notebox > .sub { margin-top: 4px; font-size: 11px; }
.nbtn { margin-top: 8px; }
/* b4: copy-note icon button, address line with map pin */
.hcard { position: relative; }
.hcard > .title { padding-right: 44px; }
.qn { position: absolute; top: 10px; right: 10px; width: 34px; height: 34px; display: grid; place-items: center; padding: 0; border: 1px solid var(--line); border-radius: 8px; background: #fff; color: var(--fg2); cursor: pointer; z-index: 2; }
.qn svg { width: 16px; height: 16px; }
.qn:hover { background: var(--bg3); color: var(--fg); border-color: var(--line2); }
.qn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--focus); }
.qn.done { color: var(--good); }
.qn.copied::after { content: 'Copied'; position: absolute; right: 0; top: calc(100% + 5px); background: var(--pri); color: var(--pri-fg); font-size: 10.5px; font-weight: 600; padding: 2px 6px; border-radius: 5px; white-space: nowrap; pointer-events: none; }
.anim .qn { transition: background-color var(--d1) var(--eo), color var(--d1) var(--eo), border-color var(--d1) var(--eo); }
.anim .qn.done svg { animation: tick var(--d2) var(--eo) both; }
.anim .qn.copied::after { animation: fade var(--d2) var(--eo) both; }
.hcard .addr { display: flex; align-items: flex-start; gap: 8px; margin-top: 10px; font-size: 12.25px; line-height: 1.4; color: var(--fg); }
.hcard .addr .al { flex: 1; min-width: 0; padding: 3px 0; }
.mpin { flex: none; width: 28px; height: 28px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 7px; background: transparent; color: var(--c-place); cursor: pointer; }
.mpin svg { width: 15px; height: 15px; }
.mpin:hover { background: var(--bg3); } .mpin.on { background: var(--c-place-soft); }
.mpin:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--focus); }
.hcard .mapw { margin: 8px -14px -12px; }
.hcard .mapw.closed { margin-top: 0; margin-bottom: 0; }
.mapw.closed { grid-template-rows: 0fr; }
.mapw.closed > .bi { visibility: hidden; opacity: 0; }
.anim .mapw.closed > .bi { transition: opacity 120ms ease-in, visibility 0s linear 200ms; }
.hcard .mapw .map.wide { margin: 0; }
.anim .hcard .mapw { transition: grid-template-rows 200ms cubic-bezier(.2,.7,.2,1), margin 200ms cubic-bezier(.2,.7,.2,1); }
/* b3 (2): logo, collapsed sources, summary placeholder, Load more */
.vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
.hcard .title { display: flex; align-items: center; gap: 8px; }
.clogo { display: none; }
.clogo.on { display: inline-flex; flex: none; width: 32px; height: 32px; padding: 3px; box-sizing: border-box; border-radius: 8px; background: #fff; border: 1px solid var(--line); overflow: hidden; }
.clogo canvas { width: 100%; height: 100%; display: block; }
.anim .clogo.on { animation: fade var(--d2) var(--eo) both; }
.srcd { margin-top: 6px; font-size: 11.5px; }
.srcd > summary { display: inline-flex; align-items: center; gap: 3px; cursor: pointer; color: var(--fg2); list-style: none; border-radius: 4px; user-select: none; }
.srcd > summary::-webkit-details-marker { display: none; }
.srcd > summary:hover, .srcd > summary:focus-visible { color: var(--fg); outline: none; text-decoration: underline; text-underline-offset: 2px; }
.srcd > summary svg { width: 11px; height: 11px; transform: rotate(-90deg); transition: transform var(--d1) var(--eo); }
.srcd[open] > summary svg { transform: none; }
.srcd .src { margin-top: 4px; }
.srcd .src a { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; }
.aiwait .skel { margin: 9px 0; }
.anim .ai .aiwait .skel { animation: aipulse 1.9s ease-in-out infinite; background-size: 100% 100%; }
.anim .ai .aiwait .skel:nth-child(3) { animation-delay: .15s; } .anim .ai .aiwait .skel:nth-child(4) { animation-delay: .3s; }
@keyframes aipulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
.moreb { margin-top: 8px; }
/* b3: merged Overview, interactive entities, Expand, export menu */
.hcard .kv.ov { margin-top: 10px; grid-template-columns: 92px 1fr; font-size: 12.25px; gap: 4px 10px; }
.hcard .kv.ov dd .sub { font-size: 11.5px; }
.ent { position: relative; cursor: pointer; border-radius: 3px; text-decoration: underline dotted; text-decoration-thickness: 1px; text-underline-offset: 3px; }
.ent.e-person { color: var(--c-person); } .ent.e-place { color: var(--c-place); } .ent.e-ch { color: var(--c-ch); } .ent.e-plain { text-decoration-color: var(--fg3); }
.ent:hover, .ent:focus-visible { background: var(--bg3); box-shadow: 0 0 0 2px var(--bg3); outline: none; text-decoration-style: solid; }
.ent.copied::after { content: 'Copied'; position: absolute; left: 50%; bottom: calc(100% + 4px); transform: translateX(-50%); background: var(--pri); color: var(--pri-fg); font-size: 10.5px; font-weight: 600; padding: 2px 6px; border-radius: 5px; white-space: nowrap; pointer-events: none; z-index: 7; }
.epop { position: absolute; z-index: 6; left: 0; top: 0; min-width: 180px; max-width: 290px; padding: 9px; background: var(--bg); border: 1px solid var(--line); border-radius: 10px;
box-shadow: 0 10px 28px rgba(17,24,39,.16), 0 2px 6px rgba(17,24,39,.08); opacity: 0; visibility: hidden; transform: translateY(-3px); pointer-events: none; }
.epop.show { opacity: 1; visibility: visible; transform: none; pointer-events: auto; }
.epop .eh b { display: block; font-size: 12.5px; font-weight: 600; color: var(--fg); overflow-wrap: anywhere; line-height: 1.3; }
.epop .eh small { display: block; margin-top: 2px; font-size: 11px; color: var(--fg2); line-height: 1.35; }
.epop .ea { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-top: 8px; }
.eb { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--fg); font: inherit; font-size: 11.5px; cursor: pointer; text-decoration: none; white-space: nowrap; }
.eb:hover, .eb:focus-visible { background: var(--bg2); border-color: var(--line2); text-decoration: none; outline: none; }
.eb svg { width: 11px; height: 11px; flex: none; }
.eb.ch { color: var(--c-ch); } .eb.pl { color: var(--c-place); }
.epop .plk { margin-left: 2px; opacity: 1; vertical-align: 0; }
.xbtn { position: relative; overflow: hidden; }
.xbtn svg.spark { width: 15px; height: 15px; }
.xbtn::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 55%; background: linear-gradient(105deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.75) 50%, rgba(255,255,255,0) 100%); transform: translateX(-130%); pointer-events: none; }
.anim .xbtn:hover::after { animation: sheen 1.1s var(--eo); }
.xsteps { display: flex; gap: 4px; margin: 7px 0 4px; font-size: 10.5px; color: var(--fg3); }
.xsteps span { padding: 1px 7px; border-radius: 10px; border: 1px solid var(--line); }
.xsteps span.on { color: var(--ai-ink); border-color: #d9cdf8; background: linear-gradient(90deg, var(--ai-vs), var(--ai-as)); }
.xsteps span.done { color: var(--fg2); background: var(--bg3); border-color: transparent; }
.ua .src .sl { display: block; font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--fg3); font-weight: 600; margin-bottom: 2px; }
.xmenu { width: 250px; max-height: 420px; }
.xmenu .mi[disabled] { opacity: .45; cursor: default; background: none; }
.xmenu .mi small { flex: none; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.anim .epop { transition: opacity var(--d1) var(--eo), transform var(--d1) var(--eo), visibility 0s linear var(--d1); }
.anim .epop.show { transition: opacity var(--d1) var(--eo), transform var(--d1) var(--eo), visibility 0s; }
.anim .ent.copied::after { animation: fade var(--d2) var(--eo) both; }
.anim .ent { transition: background-color var(--d1) var(--eo), box-shadow var(--d1) var(--eo); }
@media (prefers-reduced-motion: reduce) { .pill, .pill.show { transform: none !important; } }
@media (prefers-reduced-motion: reduce) {
.root *, .root *::before, .root *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }
}
`;
const PCSS = BASE_CSS + APP_CSS; // not CSS: that would shadow window.CSS

/* ---------- LinkedIn link checks and connection notes (from the extension) ---------- */
function liAfterCompany(ctx) {
  const li = ctx.det && ctx.det.li, f = ctx.company, rec = ctx.ai; if (!li || !f || !rec) return;
  const live = st.li && st.li.key === li.key ? st.li : null;
  if (li.kind === 'company') {
    if (li.paste || live) { rec.li = { company: li.url, at: Date.now() }; if (rec.card) rec.card.linkedin = li.url; aiSave(rec); }
    if (live || li.paste) st.liRes = { key: li.key, html: `<span class="ok">${ICON.check}</span> LinkedIn page saved with ${esc(f.display)} (for exports).` };
    return liPaint();
  }
  // person: officers now, PSCs, and officers who left in the last 2 years
  const hits = [];
  for (const o of f.officers) if (!o.corporate) { const m = liNameMatch(li.name, o); if (m) hits.push({ m, o, line: `${o.role} of ${f.display}${o.appointed ? ' since ' + yr(o.appointed) : ''}`, title: o.appointed ? 'Appointed ' + fmtDate(o.appointed) : '' }); }
  for (const p of f.pscs) if (p.kind === 'Individual') { const m = liNameMatch(li.name, p); if (m && !hits.some((h) => liKey(h.o) === liKey(p))) hits.push({ m, o: p, line: `person with significant control of ${f.display}${p.notified ? ' since ' + yr(p.notified) : ''}`, title: p.control || '' }); }
  for (const o of f.former || []) { const m = liNameMatch(li.name, o); if (m) hits.push({ m, o, line: `former ${String(o.role).toLowerCase()} of ${f.display} (${yr(o.appointed)}${o.resigned ? '\u2013' + yr(o.resigned) : ''})`, title: o.resigned ? 'Resigned ' + fmtDate(o.resigned) : '' }); }
  hits.sort((x, y) => (x.m.level === 'exact' ? 0 : 1) - (y.m.level === 'exact' ? 0 : 1));
  let html = '';
  if (hits.length) {
    html = hits.slice(0, 3).map((h, i) => `<div class="lline"><b>${esc(li.name)}</b>: ${esc(h.line)}<span class="badge ${h.m.level === 'exact' ? 'g' : 'w'}" title="${esc(h.title)}">${esc(h.m.label)}</span>`
      + (h.o.name !== li.name ? `<div class="sub">Companies House: ${esc(h.o.name)}</div>` : '')
      + (i === 0 && h.m.level !== 'exact' ? `<button class="lnk" data-act="li-save" data-k="${esc(liKey(h.o))}" data-n="${esc(h.o.name)}">It's them: save the profile link to ${esc(h.o.name)}</button>` : '') + '</div>').join('')
      + '<div class="sub">A name match, not proof: different people can share a name.</div>';
    const top = hits[0];
    ctx.liPerson = { name: top.o.name, role: top.line, url: li.url, level: top.m.level };
    if (top.m.level === 'exact') { rec.liPeople = Object.assign({}, rec.liPeople, { [liKey(top.o)]: { url: li.url, name: top.o.name, at: Date.now() } }); aiSave(rec); html += `<div class="sub">${ICON.check} Profile link saved to ${esc(top.o.name)} (for exports).</div>`; }
  } else {
    html = `<div class="lline">No current officer or PSC of <b>${esc(f.display)}</b> matches ${esc(li.name)} (officers who left in the last 2 years were checked too).</div>
      <button class="lnk" data-act="li-osearch">Search all Companies House officers named ${esc(li.name)}</button>`;
  }
  st.liRes = { key: li.key, html }; liPaint();
}
function liAfterPeople(ctx, officers) {
  const li = ctx.det && ctx.det.li; if (!li || li.kind !== 'person') return;
  const same = officers.filter((o) => liNameMatch(li.name, { name: o.name }));
  st.liRes = { key: li.key, html: `${li.companyMissing ? `<div class="sub">Couldn't find ${esc(li.company)} on Companies House, so this is a search by name.</div>` : ''}<div class="lline">${same.length ? `${same.length} Companies House officer${same.length === 1 ? '' : 's'} named like ${esc(li.name)}` : `No Companies House officers named ${esc(li.name)}`}${officers.length > same.length ? ` (${officers.length} results in all)` : ''}.</div><div class="sub">Same-name people exist, so check the companies and dates before treating any of them as this person.</div>` };
  liPaint();
}
function liOfficerSearch() {
  const li = curLi(); if (!li) return;
  const info = { kind: 'person', url: li.url, name: li.name, company: li.company, key: li.key };
  lookup(li.name, 'person'); if (st.ctx && st.ctx.det) st.ctx.det.li = info;
}
function liSave(k, name) {
  const ctx = st.ctx, li = curLi(); if (!ctx || !ctx.ai || !li) return;
  ctx.ai.liPeople = Object.assign({}, ctx.ai.liPeople, { [k]: { url: li.url, name, at: Date.now() } }); aiSave(ctx.ai);
  if (ctx.liPerson) ctx.liPerson.level = 'confirmed';
  st.liRes = { key: li.key, html: (st.liRes && st.liRes.html ? st.liRes.html.replace(/<button class="lnk" data-act="li-save"[\s\S]*?<\/button>/, '') : '') + `<div class="sub">${ICON.check} Profile link saved to ${esc(name)} (for exports).</div>` };
  liPaint();
}
// Saved LinkedIn profile for a person on the current company (by surname + first name).

/* ---------- AI connection note (copy only; Prosper never pastes or sends) ---------- */
function noteTargets(ctx) {
  const f = ctx.company, out = [];
  if (ctx.liPerson) out.push({ k: liKey({ name: ctx.liPerson.name }), name: ctx.liPerson.name, role: ctx.liPerson.role });
  for (const o of f.officers) if (!o.corporate && /director/i.test(o.role) && !out.some((x) => x.k === liKey(o))) out.push({ k: liKey(o), name: o.name, role: `${o.role} of ${f.display}` });
  return out.slice(0, 9);
}
function noteHtml(ctx) {
  if (!claudeKey()) return '';
  const n = ctx.company.number, ns = st.note[n] || {};
  if (!ns.open) return `<button class="webbtn xbtn nbtn" data-act="note-open" title="Drafts a short LinkedIn connection request (under 300 characters) or a longer message from the Companies House data, the summary and any Expand results. You copy it yourself.">${ICON.spark}<span>Write connection note</span><small>short request or longer message, for you to copy</small></button>`;
  const T = noteTargets(ctx), to = ns.to != null ? ns.to : (T[0] && ctx.liPerson ? T[0].k : '_');
  const c = (ctx.ai.notes || {})[to], kind = ns.kind || 'note';
  const opts = `<option value="_"${to === '_' ? ' selected' : ''}>No name (general)</option>` + T.map((x) => `<option value="${esc(x.k)}"${x.k === to ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
  let body;
  if (busy(n, 'note')) body = '<div class="aiwait"><div class="skel w90"></div><div class="skel w75"></div></div>';
  else if (st.aiErr[n] && st.aiErr[n].note) body = errBox('Note failed', st.aiErr[n].note, 'note-regen');
  else if (!c) body = `<button class="btn sm" data-act="note-regen">Write it</button>`;
  else {
    const txt = (ns.edit && ns.edit[to + kind] != null) ? ns.edit[to + kind] : (kind === 'note' ? c.note : c.msg);
    body = `<textarea class="nta" data-kind="${kind}" rows="${kind === 'note' ? 4 : 8}" aria-label="${kind === 'note' ? 'Connection request' : 'Message'}">${esc(txt)}</textarea>
      <div class="nmeta"><span class="ncnt${kind === 'note' && txt.length > 300 ? ' over' : ''}">${txt.length}${kind === 'note' ? ' / 300' : ' characters'}</span><span class="sp"></span><button class="lnk" data-act="note-regen">Write again</button><button class="btn sm" data-act="note-copy">${ICON.copy}<span>Copy</span></button></div>
      <div class="sub">${kind === 'note' ? 'Connection requests allow up to 300 characters.' : 'For a message or InMail.'} Prosper doesn't paste or send anything.</div>`;
  }
  return `<div class="notebox"><div class="nh"><h5>Connection note</h5><label>To <select class="nto" aria-label="Who it is for">${opts}</select></label><button class="ib" data-act="note-close" title="Close" aria-label="Close">${ICON.x}</button></div>
    <div class="seg" role="tablist"><button role="tab" data-act="note-kind" data-kind="note" aria-selected="${kind === 'note'}" class="${kind === 'note' ? 'on' : ''}">Connection request</button><button role="tab" data-act="note-kind" data-kind="msg" aria-selected="${kind === 'msg'}" class="${kind === 'msg' ? 'on' : ''}">Longer message</button></div>${body}</div>`;
}
function rerenderNote(n) { const ctx = liveCtx(n); if (!ctx) return; const box = $aib.querySelector('[data-ai=note]'); if (box) box.innerHTML = noteHtml(ctx); }
async function doNote(ctx) {
  const f = ctx.company, n = f.number, rec = ctx.ai, ns = st.note[n] = st.note[n] || {};
  if (busy(n, 'note')) return;
  const T = noteTargets(ctx), to = ns.to != null ? ns.to : (T[0] && ctx.liPerson ? T[0].k : '_');
  ns.to = to; if (ns.edit) { delete ns.edit[to + 'note']; delete ns.edit[to + 'msg']; }
  setBusy(n, 'note', true); setAiErr(n, 'note', null); rerenderNote(n);
  try { const r = await runNote(f, ctx, rec, T.find((x) => x.k === to)); rec.notes = Object.assign({}, rec.notes, { [to]: r }); aiSave(rec); } catch (e) { setAiErr(n, 'note', e); }
  setBusy(n, 'note', false); rerenderNote(n);
}


const ICON = {
  globe: '<svg class="globe" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c1.8 1.7 2.7 3.7 2.7 6S9.8 12.3 8 14M8 2C6.2 3.7 5.3 5.7 5.3 8s.9 4.3 2.7 6"/></svg>',
  send: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13V3.5M3.8 7.5L8 3.3l4.2 4.2"/></svg>',
  spark: '<svg class="spark" viewBox="0 0 16 16" aria-hidden="true"><path fill="#9b80e3" d="M7 1.5l1.3 3.7 3.7 1.3-3.7 1.3L7 11.5 5.7 7.8 2 6.5l3.7-1.3z"/><path fill="#e3a84f" d="M12.5 9.4l.65 1.95 1.95.65-1.95.65-.65 1.95-.65-1.95L9.9 12l1.95-.65z"/></svg>',
  x: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3.6 3.6l8.8 8.8M12.4 3.6l-8.8 8.8"/></svg>',
  up: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10l4-4 4 4"/></svg>',
  down: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>',
  search: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  back: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3L5 8l5 5"/></svg>',
  next: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3l5 5-5 5"/></svg>',
  chev: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>',
  ext: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-label="opens in new tab"><path d="M4.5 2.5h5v5M9.5 2.5L3 9"/></svg>',
  check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>',
  pin: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2.5h8v11L8 10.5 4 13.5z"/></svg>',
  pinf: '<svg viewBox="0 0 16 16" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M4 2.5h8v11L8 10.5 4 13.5z"/></svg>',
  clock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.2l2 1.3"/></svg>',
  map: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 14s4.5-4 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 10 8 14 8 14z"/><circle cx="8" cy="6.5" r="1.6"/></svg>',
  copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/></svg>',
  dl: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10"/></svg>',
  share: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10V2.5M5 5.5l3-3 3 3M3.5 8.5v4.5h9V8.5"/></svg>',
  doc: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M4 1.5h5.5L12.5 4.5v10h-8.5z"/><path d="M9.5 1.5v3h3"/></svg>',
};

let host, sroot, root, $pill = null, $panel, $drawer, $edge = null, $body, $input, $det = null, $mode, $toast, $menu = null, $sheet = null, $aib = null, $aip = null, $side = null;
const st = { open: false, view: 'main', det: null, ctx: null, stack: [], req: 0, pillText: '', aiBusy: {}, aiErr: {}, aiMem: {}, aiStep: {}, logoBusy: {}, xmenu: false, li: null, liRes: null, liDismissed: new Set(), liChipSeen: new Set(), note: {}, styleMode: 'none', fontStatus: '', diag: null, anchor: null, menu: false };
let secState = {};
function loadSecState() { secState = readJSON(gv(K.sections, null)) || {}; }
function saveSecState() { sv(K.sections, JSON.stringify(secState)); }
const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
function applyRootClasses() {
  if (!root) return;
  root.classList.toggle('hov-menus', !!settings.qlHover);
  root.classList.toggle('anim', !!settings.animations && !reducedMotion());
  root.classList.toggle('mono', !settings.colorLinks);
}

/* Styles: constructable stylesheet (not subject to page CSP) -> <style>.
   Each step is verified with a probe element so a CSP-blocked style never fails silently. */
function stylesApplied(sr) { try { const p = sr.querySelector('.probe'); return !!p && getComputedStyle(p).width === '3px'; } catch (e) { return false; } }
function applyStyles(sr) {
  const tries = [
    ['adoptedStyleSheets', () => { const sh = new CSSStyleSheet(); sh.replaceSync(PCSS); sr.adoptedStyleSheets = [sh]; }],
    ['adoptedStyleSheets (push)', () => { const sh = new CSSStyleSheet(); sh.replaceSync(PCSS); sr.adoptedStyleSheets.push(sh); }],
    ['<style> element', () => { const el = document.createElement('style'); el.textContent = PCSS; sr.appendChild(el); }],
  ];
  const errs = [];
  for (const [name, fn] of tries) {
    try { fn(); } catch (e) { errs.push(name + ': ' + ((e && e.message) || e)); continue; }
    if (stylesApplied(sr)) { st.styleMode = name; return; }
    errs.push(name + ': not applied (page CSP?)');
  }
  st.styleMode = 'none';
  st.styleErr = errs.join('; ');
  warn('could not apply panel styles on this page. ' + st.styleErr);
}

/* Inter, embedded (latin subset) and registered with the FontFace API from ArrayBuffers, so font-src CSP cannot block it. */
function b64ToBytes(b) { const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function bytesToB64(u) { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
/* DM Sans Bold, subset to the wordmark + launcher letters (about 5 KB). Loaded at start so the edge tab's P is right from the first paint. */
function ensureDisplayFont() {
  if (st.displayFont) return;
  st.displayFont = 'loading';
  try {
    if (typeof FontFace !== 'function' || !document.fonts) { st.displayFont = 'FontFace API unavailable'; return; }
    const u = b64ToBytes(dmDisplayFont());
    let face = null, lastErr = null;
    for (const src of [() => u.buffer, () => u, () => (typeof cloneInto === 'function' ? cloneInto(u, window) : u)]) { try { face = new FontFace('Prosper Display', src(), { weight: '700', style: 'normal', display: 'swap' }); break; } catch (e) { lastErr = e; } }
    if (!face) throw lastErr || new Error('FontFace failed');
    document.fonts.add(face);
    face.load().then(() => { st.displayFont = 'DM Sans Bold loaded'; }, (e) => { st.displayFont = 'DM Sans failed (' + ((e && e.message) || e) + ')'; warn(st.displayFont); });
  } catch (e) { st.displayFont = 'DM Sans failed (' + ((e && e.message) || e) + ')'; warn(st.displayFont); }
}
function ensureFonts() {
  if (st.fontStatus) return;
  st.fontStatus = 'loading';
  try {
    if (typeof FontFace !== 'function' || !document.fonts) { st.fontStatus = 'FontFace API unavailable, using system-ui'; return; }
    const data = interFonts();
    const loads = Object.keys(data).map((w) => {
      const u = b64ToBytes(data[w]);
      const desc = { weight: w, style: 'normal', display: 'swap' };
      let face = null, lastErr = null;
      const srcs = [() => u.buffer, () => u, () => (typeof cloneInto === 'function' ? cloneInto(u, window) : u)];
      for (const src of srcs) { try { face = new FontFace('Prosper Inter', src(), desc); break; } catch (e) { lastErr = e; } }
      if (!face) throw lastErr || new Error('FontFace failed');
      document.fonts.add(face);
      return face.load();
    });
    Promise.all(loads).then(() => { st.fontStatus = 'Inter loaded (400/500/600/700 via FontFace)'; },
      (e) => { st.fontStatus = 'Inter failed to load (' + ((e && e.message) || e) + '), using system-ui'; warn(st.fontStatus); });
  } catch (e) { st.fontStatus = 'Inter failed (' + ((e && e.message) || e) + '), using system-ui'; warn(st.fontStatus); }
}




function setView(v) {
  st.view = v;
  $panel.classList.toggle('in-settings', v === 'settings');
  root.querySelector('[data-act=settings]').classList.toggle('on', v === 'settings');
}

function showToast(t) {
  $toast.textContent = t; $toast.classList.add('show');
  clearTimeout(showToast.t); showToast.t = setTimeout(() => $toast.classList.remove('show'), 1600);
}
/* Copy confirmation: buttons briefly show a tick + "Copied"; click-to-copy values show a small "Copied" bubble. */
function confirmCopy(el, msg) {
  if (!el) return showToast(msg || 'Copied');
  if (el.classList.contains('cv') || el.classList.contains('ent')) {
    el.classList.remove('copied'); void el.offsetWidth; el.classList.add('copied');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('copied'), 1200);
    return;
  }
  if (el.classList.contains('qn')) {
    if (!el._orig) el._orig = el.innerHTML;
    el.classList.add('done', 'copied'); el.innerHTML = ICON.check; el.setAttribute('aria-label', 'Copied');
    clearTimeout(el._t); el._t = setTimeout(() => { el.classList.remove('done', 'copied'); el.innerHTML = el._orig; el._orig = null; el.setAttribute('aria-label', 'Copy quick note'); }, 1300);
    return;
  }
  if (el.classList.contains('btn') || el.classList.contains('xi')) {
    if (!el._orig) el._orig = el.innerHTML;
    el.classList.add('done'); el.innerHTML = ICON.check + (el.classList.contains('xi') ? '' : 'Copied');
    clearTimeout(el._t); el._t = setTimeout(() => { el.classList.remove('done'); el.innerHTML = el._orig; el._orig = null; }, 1300);
    return;
  }
  showToast(msg || 'Copied');
}
function copyFrom(el, text, msg) { if (!text) return; copyText(text).then(() => confirmCopy(el, msg)); }

/* ---------- selection & pill ---------- */

function isEditable(el) {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || el.isContentEditable;
}

/* ---------- navigation ---------- */

function ctxTitle(c) { return !c ? '' : c.kind === 'dym' ? 'results' : c.kind === 'person' ? (c.name || 'person') : c.kind === 'filings' ? 'Filings' : c.company ? c.company.display : (c.query || c.raw || ''); }
function pushNav() { if (st.ctx) { st.stack.push(st.ctx); if (st.stack.length > 20) st.stack.shift(); } }
function backBar() {
  const prev = st.stack[st.stack.length - 1];
  return prev ? `<div><button class="crumb" data-act="nav-back" title="Back">${ICON.back}<span>Back to ${esc(ctxTitle(prev))}</span></button></div>` : '';
}
function navBack() {
  const prev = st.stack.pop(); if (!prev) return;
  leaveCtx(st.ctx);
  st.ctx = prev; st.req++;
  if (prev.det) { renderDet(prev.det); $input.value = prev.company && !prev.kind ? prev.company.number : (prev.query || ''); }
  renderCtx(prev);
}
function leaveCtx(c) { if (c && c.kind === 'filings' && c.blobs) { for (const u of Object.values(c.blobs)) { try { URL.revokeObjectURL(u.url); } catch (e) { /* ignore */ } } c.blobs = {}; } }
function renderCtx(c) {
  if (!c) return renderEmpty();
  if (c.kind === 'person') return renderPersonView(c);
  if (c.kind === 'dym') return renderDym(c);
  if (c.company) { renderDet(c.det); return renderCompany(c, false); }
  if (c.officers) return renderPerson(c);
  lookup(c.det.raw, $mode.value);
}

/* ---------- lookup flow ---------- */

function renderDet(det) {
  if (!$det) return;
  if (!det) { $det.innerHTML = '<span>Search Companies House, or highlight text on the page.</span>'; return; }
  const cls = det.type === 'freemail' ? 'w' : '';
  $det.innerHTML = `<span class="badge ${cls}">${esc(det.label)}</span><q>${esc(det.raw)}</q>`;
}

async function lookup(text, forceMode, push) {
  const det = detect(text) || { raw: text, type: 'company', label: 'Company', query: text, mode: 'company' };
  let mode = det.mode, hint = det.personHint || '';
  if (forceMode === 'company' && mode !== 'number') { mode = 'company'; hint = ''; if (det.type === 'person' || det.type === 'name') det.label = 'Company'; }
  if (forceMode === 'person') { mode = 'person'; hint = ''; if (det.type !== 'freemail') det.query = det.personName || (det.domain ? text : det.query); }
  if (push) pushNav(); else { leaveCtx(st.ctx); st.stack = []; }
  $mode.value = forceMode || 'auto';
  st.det = det;
  $input.value = det.type === 'chnum' ? det.number : det.type === 'email' || det.type === 'freemail' ? (mode === 'person' && det.type === 'email' ? det.query : det.email) : det.type === 'domain' ? det.domain : det.query;
  renderDet(det);
  const ctx = st.ctx = { det, raw: det.raw, query: det.query, domain: det.domain || '', company: null, candidates: null, mode, personHint: hint };
  const req = ++st.req;
  if (!chKey()) return renderNoKey();
  renderLoading(mode === 'person' ? 'Searching officers' : 'Looking up Companies House');
  try {
    if (mode === 'number') {
      await showCompany(ctx, det.number, req);
    } else if (mode === 'person') {
      const officers = await findOfficers(ctx.query);
      if (req !== st.req) return;
      showPeople(ctx, officers, req);
    } else if (mode === 'none') {
      renderNone(ctx);
    } else {
      // Names that could be a person ("Thomas Cook", "Roisin Currie") search companies and officers together.
      const [found, offs] = await Promise.all([findCompanies(ctx.query, { domain: !!det.domain }), hint ? findOfficers(ctx.query).catch(() => []) : null]);
      if (req !== st.req) return;
      ctx.candidates = found;
      if (found.strong) return await showCompany(ctx, found.strong.number, req);
      // Headlines and sentences ("Oxford Flow raises £14m to ..."): also try the leading capitalised words, and offer
      // that company first in the list rather than opening it.
      const lead = leadName(ctx.query);
      if (lead && !det.domain) {
        const f2 = await findCompanies(lead).catch(() => null);
        if (req !== st.req) return;
        if (f2 && f2.items.length) {
          const first = f2.strong ? [f2.strong] : f2.items.slice(0, 3);
          found.items = first.concat(found.items.filter((x) => !first.some((y) => y.number === x.number))).slice(0, 8);
          if (f2.strong) found.reason = 'lead';
        }
      }
      const personNamed = (offs || []).some((o) => sameName(o.name, ctx.query));
      if (hint && !found.exactCount && (hint === 'likely' || personNamed || !found.items.length)) { ctx.fromName = true; return showPeople(ctx, offs || [], req); }
      if (!found.items.length) return renderNoMatch(ctx);
      ctx.kind = 'dym';
      renderDym(ctx);
    }
  } catch (e) { if (req === st.req) renderError(e); }
}
function showPeople(ctx, officers, req) {
  ctx.officers = officers; ctx.mode = 'person';
  renderPerson(ctx);
  if (ctx.det && ctx.det.li) liAfterPeople(ctx, officers);
  officers.slice(0, 3).forEach((o, i) => expandOfficer(ctx, i, req));
}
function openCompanyHere(num) { if (num) { setView('main'); lookup(num, 'auto', true); } }

// Only reached for a strong match, a company number or a company the user picked: the automatic summary may run.
async function showCompany(ctx, number, req) {
  renderLoading('Loading company');
  const f = await loadCompany(number);
  if (req !== st.req) return;
  ctx.company = f; ctx.roles = {}; ctx.rolesOpen = {}; ctx.similar = null; ctx.mapOpen = null;
  ctx.ai = aiRec(f);
  ctx.ai.card = Object.assign(cardOf(f, ctx), { website: ctx.domain || (ctx.ai.card && ctx.ai.card.website) || (ctx.ai.web && ctx.ai.web.site) || '' });
  aiSave(ctx.ai);
  addRecent(f);
  renderCompany(ctx, true);
  maybeAuto(ctx);
  if (ctx.det && ctx.det.li) liAfterCompany(ctx);
  // after the main lookup, off the critical path: similar companies (1-2 CH calls), then the verified logo
  setTimeout(() => { if (st.ctx === ctx && ctx.company === f) loadSimilar(ctx); }, 700);
  setTimeout(() => { if (st.ctx === ctx && ctx.company === f) loadLogo(ctx); }, 1200);
}

/* ---------- renderers ---------- */

function renderLoading(msg) {
  hideEnt(true);
  setBody(`${backBar()}<div class="card skc" aria-busy="true"><div class="sub"><span class="spin"></span>&nbsp; ${esc(msg)}...</div>
    <div class="skel h1 mt10"></div><div class="skel w45"></div><div class="skel blk2"></div></div>
    <div class="card skc"><div class="skel w60"></div><div class="skel w85"></div><div class="skel w75"></div></div>
    <div class="card skc"><div class="skel w45"></div><div class="skel w90"></div><div class="skel w82"></div></div>`);
}
function renderNoKey() {
  setBody(`<div class="card state"><b>Companies House API key needed</b>Prosper reads company data straight from Companies House. Get a free key at developer.company-information.service.gov.uk (create an application, then a REST key) and paste it in Settings.
    <br><button class="btn pri" data-act="settings">Open settings</button></div>${linksSection(st.ctx)}`);
}
function renderError(e) {
  const code = e && e.code;
  let t, m, act = '';
  if (code === 'ch-nokey') return renderNoKey();
  warn('lookup failed:', code || '', (e && e.message) || e, e && e.detail ? '(' + e.detail + ')' : '');
  const ki = keyInfo('ch');
  const diagBtn = '<button class="btn" data-act="diag-open">Run diagnostics</button>';
  if (code === 'ch-401') { t = 'Companies House key rejected (401)'; m = `Companies House said the key is invalid. Key in use: ${ki.source}, ${ki.len} characters. A REST key is 36 characters like 1a2b3c4d-.... Paste it again in Settings (Prosper strips stray spaces, quotes and "=").`; act = '<button class="btn" data-act="settings">Open settings</button> ' + diagBtn; }
  else if (code === 'ch-403') { t = 'Companies House refused the request (403)'; m = 'Companies House refused requests from this site. In the Companies House developer hub, open your application and add ' + location.hostname + ' to the key\'s JavaScript domains (or remove its domain and IP restrictions). Then press Retry.'; act = '<button class="btn" data-act="retry">Retry</button> ' + diagBtn; }
  else if (code === 'ch-429') { t = 'Companies House rate limit'; m = 'Too many requests (429). The limit is 600 per 5 minutes; wait a moment and try again.'; act = '<button class="btn" data-act="retry">Retry</button>'; }
  else if (code === 'ch-404') { t = 'Company not found'; m = e.message; }
  else if (code === 'ch-net' || code === 'ch-timeout') { t = code === 'ch-timeout' ? 'Companies House timed out' : 'Could not reach Companies House'; m = ((e && e.detail) || e.message || 'Network error') + '. From a web page this usually means Companies House refused the request because ' + esc(location.origin) + ' is not listed under JavaScript domains for your key (developer.company-information.service.gov.uk, Manage applications, your key). Otherwise check your connection, or whether a browser extension or network filter blocks api.company-information.service.gov.uk.'; act = '<button class="btn" data-act="retry">Retry</button> ' + diagBtn; }
  else { t = 'Something went wrong'; m = ((e && e.message) || String(e)) + (e && e.status ? ' (HTTP ' + e.status + ')' : ''); act = '<button class="btn" data-act="retry">Retry</button> ' + diagBtn; }
  setBody(`${backBar()}<div class="err"><b>${esc(t)}</b><div>${esc(m)}</div><div class="row mt6">${act}</div></div>${linksSection(st.ctx)}`);
  wireFavicons();
}
function renderNoMatch(ctx) {
  const li = ctx.det && ctx.det.li;
  if (li && li.kind === 'person' && li.company && !li.companyMissing && ctx.mode !== 'person') { // company from the title not on CH: search officers by name
    lookup(li.name, 'person'); if (st.ctx && st.ctx.det) st.ctx.det.li = Object.assign({}, li, { companyMissing: true }); return;
  }
  setBody(`${backBar()}<div class="card state"><b>No Companies House match</b>Nothing found for "${esc(ctx.query)}". Try the full registered name, or search as a person.
    <br><button class="btn" data-act="as-person">Search as person</button></div>${linksSection(ctx)}`, true);
  wireFavicons();
}
function statusBadge(s) { return s === 'active' ? '<span class="badge">Active</span>' : `<span class="badge r">${esc(label('company_status', s) || s || 'Unknown')}</span>`; }
/* Weak or ambiguous name: a short list to choose from instead of silently opening one. No AI runs here. */
function renderDym(ctx) {
  const c = ctx.candidates, q = ctx.det.domain || ctx.query;
  const head = c.reason === 'several' ? `Several companies match “${esc(q)}”. Which one?`
    : c.reason === 'lead' ? `“${esc(q)}” looks like a headline or sentence. Best match first:`
    : ctx.det.domain ? `No company is called exactly “${esc(q)}”. Closest matches on Companies House:` : `No exact match for “${esc(q)}”. Closest matches on Companies House:`;
  const row = (it) => {
    const yr = it.created ? String(it.created).slice(0, 4) : '';
    const former = it.formerExact ? it.formerly.find((x) => alphaKey(x) === c.qk) : '';
    const meta = [it.number, it.town, yr && 'inc. ' + yr, former && 'formerly ' + titleCase(former)].filter(Boolean).join(' · ');
    return `<button class="opt" data-act="pick-dym" data-num="${esc(it.number)}"><span class="n">${esc(titleCase(it.name))}<small>${esc(meta)}</small></span>${statusBadge(it.status)}</button>`;
  };
  setBody(`${backBar()}<div class="card dym"><div class="dyh"><b>Did you mean…</b><span>${head}</span></div>
    <div class="opts">${c.items.slice(0, 6).map(row).join('')}</div>
    ${ctx.personHint ? `<button class="opt per" data-act="as-person"><span class="n">Search people named “${esc(ctx.query)}”<small>Companies House officers</small></span></button>` : ''}
    <div class="hint">Pick one to open it. The summary is written once you choose.</div></div>${linksSection(ctx)}`, true);
  wireFavicons();
}
function renderNone(ctx) {
  setBody(`<div class="card state"><b>Personal email address</b>${esc(ctx.raw)} is a free email provider, so there is no company domain to look up. Use the links below or type a company name above.</div>${linksSection(ctx)}`, true);
  wireFavicons();
}

/* ---------- building blocks ---------- */

function secOpen(id, def, force) {
  if (force) return true;
  if (id === 'overview') return true;
  if (settings.rememberSections && typeof secState[id] === 'boolean') return secState[id];
  return def;
}
const secDef = (id) => !!(settings.secOpen && settings.secOpen[id]);
function blk(id, title, o) {
  const open = o.fixed || secOpen(id, o.def !== false, o.force);
  const t = o.href && settings.chLinks
    ? `<a class="bt" href="${esc(o.href)}" data-act="ext" data-url="${esc(o.href)}" title="${esc(title)} on Companies House (new tab)">${esc(title)}${ICON.ext}</a>`
    : `<span class="bt">${esc(title)}</span>`;
  const cnt = o.count != null && o.count !== '' ? `<span class="cnt ${o.countCls || ''}" data-cnt="${id}">${esc(o.count)}</span>` : '';
  const tt = o.icon ? t.replace(/^(<(?:a|span) class="bt"[^>]*>)/, '$1' + o.icon) : t;
  const head = o.fixed
    ? `<div class="bh">${tt}${o.extra || ''}<span class="sp"></span>${cnt}</div>`
    : `<div class="bh" data-act="tog" role="button" tabindex="0" aria-expanded="${open}">${tt}${o.extra || ''}<span class="sp"></span>${cnt}<span class="chev">${ICON.chev}</span></div>`;
  return `<section class="blk${open ? '' : ' closed'}${o.fixed ? ' fixed' : ''}${o.cls ? ' ' + o.cls : ''}" data-sec="${id}">
    ${head}
    <div class="bb"><div class="bi"><div class="bc${o.bcCls ? ' ' + o.bcCls : ''}">${o.body}</div></div></div></section>`;
}
function toggleBlock(sec, force) {
  if (!sec || sec.classList.contains('fixed')) return;
  const open = force != null ? force : sec.classList.contains('closed');
  sec.classList.toggle('closed', !open);
  const bh = sec.querySelector(':scope > .bh'); if (bh) bh.setAttribute('aria-expanded', String(open));
  const id = sec.dataset.sec;
  if (settings.rememberSections && id) { secState[id] = open; saveSecState(); }
  if (open) onSectionOpen(id);
}
/* Lazy loaders, run when a section is (or becomes) open. New per-section loaders plug in here. */
const SECTION_HOOKS = {
  officers: (ctx) => loadRoles(ctx),
  similar: (ctx) => loadSimilar(ctx),
};
function onSectionOpen(id) { const ctx = st.ctx; if (ctx && ctx.company && SECTION_HOOKS[id]) SECTION_HOOKS[id](ctx); }
function isSecOpenInDom(id) { const s = $body.querySelector(`.blk[data-sec="${id}"]`); return !!s && !s.classList.contains('closed') && !(s.closest('.rec') && s.closest('.rec').classList.contains('closed')); }

const extA = (url, text, cls, title) => `<a class="${cls}" href="${esc(url)}" data-act="ext" data-url="${esc(url)}"${title ? ` title="${esc(title)}"` : ''}>${text}${ICON.ext}</a>`;
const xi = (url, title, cls) => `<a class="xi ${cls || ''}" href="${esc(url)}" data-act="ext" data-url="${esc(url)}" title="${esc(title)}">${ICON.ext}</a>`;
const cv = (val, shown) => settings.clickCopy && val ? `<span class="cv" data-act="cp" data-copy="${esc(val)}" title="Click to copy">${shown != null ? shown : esc(val)}</span>` : (shown != null ? shown : esc(val));
const coUrl = (n) => `${CH_WEB}/company/${encodeURIComponent(n)}`;
const mapsUrl = (q) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
const docUrl = (n, id, dl) => `${CH_WEB}/company/${encodeURIComponent(n)}/filing-history/${encodeURIComponent(id)}/document?format=pdf&download=${dl ? 1 : 0}`;
/* A company reference: opens in the panel (blue, no arrow) plus ↗ to its CH page. */
function companyRef(num, name) {
  if (!num) return esc(name);
  if (!settings.chLinks) return esc(name);
  return `<button class="lk-ch" data-act="open-co" data-num="${esc(num)}" title="Open ${esc(name)} in Prosper">${esc(name)}</button>${xi(coUrl(num), 'Companies House page (new tab)')}`;
}
/* A person reference: opens the person view in the panel (purple), ↗ to their CH officer page. */
function personRef(p) {
  if (p.regNumber && settings.parentLinks) return companyRef(p.regNumber, p.name);
  const chUrl = p.link ? CH_WEB + p.link : `${CH_WEB}/search/officers?q=${encodeURIComponent(p.name)}`;
  const co = p.co != null ? p.co : curCoName();
  if (!settings.peopleInPanel) return extA(chUrl, esc(p.name), 'lk-person', 'Companies House officer page (new tab)') + (settings.personLinks ? personLinks(p.name, co, '') : '');
  const inPanel = p.link
    ? `<button class="lk-person" data-act="person" data-link="${esc(p.link)}" data-name="${esc(p.name)}" title="Show ${esc(p.name)}'s appointments">${esc(p.name)}</button>`
    : `<button class="lk-person" data-act="person-search" data-name="${esc(p.name)}" title="Find ${esc(p.name)} on Companies House">${esc(p.name)}</button>`;
  return inPanel + personLinks(p.name, co, chUrl);
}

/* Quick links: compact icon row (main button = sensible default; chevron/hover = menu). */
function quickRow(ctx) {
  if (!ctx) return '';
  return `<div class="qrow" role="toolbar" aria-label="Quick links">${PROVIDERS.map((p, i) => {
    const items = qlItems(p.id, ctx); if (!items.length) return '';
    const multi = items.length > 1;
    return `<div class="qb${multi ? ' multi' : ''}" data-q="${p.id}"><button class="qm" data-act="ql" data-id="${p.id}" title="${esc(p.name)}: ${esc(items[0][1])} (new tab)${settings.numKeys ? ' · key ' + (i + 1) : ''}" aria-label="${esc(p.name)} ${esc(items[0][1])}"><span class="fb" data-dom="${esc(p.fav)}" data-c="${p.c}">${esc(p.l)}</span></button>${multi
      ? `<button class="qc" data-act="qmenu" aria-haspopup="menu" aria-expanded="false" title="More ${esc(p.name)} links">${ICON.chev}</button><div class="qmenu" role="menu"><div class="qin"><h6>${esc(p.name)}</h6>${items.map((it) => `<a class="qi" role="menuitem" tabindex="-1" href="${esc(it[2])}" data-act="ext" data-url="${esc(it[2])}" data-k="${it[0]}">${esc(it[1])}${ICON.ext}</a>`).join('')}</div></div>` : ''}</div>`;
  }).join('')}</div>`;
}
function closeQMenus(except) { $body.querySelectorAll('.qb.open').forEach((b) => { if (b !== except) { b.classList.remove('open'); const c = b.querySelector('.qc, .qc2'); if (c) c.setAttribute('aria-expanded', 'false'); } }); }
function openQMenu(qb, focus) {
  if (!qb) return;
  closeQMenus(qb);
  const open = focus ? true : !qb.classList.contains('open');
  qb.classList.toggle('open', open);
  const c = qb.querySelector('.qc, .qc2'); if (c) c.setAttribute('aria-expanded', String(open));
  const m = qb.querySelector('.qmenu');
  if (open && m) { m.classList.remove('alr'); const pr = $panel.getBoundingClientRect(), r = m.getBoundingClientRect(); if (r.right > pr.right - 8 || r.left < pr.left + 8) m.classList.toggle('alr', r.right > pr.right - 8); }
  if (open && focus) { const it = qb.querySelector('.qi'); if (it) it.focus(); }
}
/* Used where there is no company header (errors, no match, person search). */
function linksSection(ctx) {
  if (!ctx) return '';
  return `<div class="card"><div class="sub">Search elsewhere</div>${quickRow(ctx)}</div>`;
}
/* Per-person link icons: LinkedIn people search, Google, Companies House officer page. */
const shortCo = (n) => String(n || '').replace(/\s+(Limited|Ltd\.?|PLC|LLP)$/i, '');
function curCoName() { const c = st.ctx; return c && c.company && c.kind !== 'person' ? shortCo(c.company.display) : ''; }
function personLinks(name, co, chUrl, corporate) {
  if (!settings.personLinks) return chUrl ? xi(chUrl, corporate ? 'Companies House page (new tab)' : 'Companies House officer page (new tab)', corporate ? '' : 'p') : '';
  const enc = encodeURIComponent;
  if (!corporate) { // "Mr John Michael Smith" -> "John Smith" (better LinkedIn/Google matches)
    const w = String(name || '').replace(/^(Mr|Mrs|Ms|Miss|Mx|Dr|Sir|Dame|Lord|Lady|Prof)\.?\s+/i, '').split(/\s+/).filter(Boolean);
    name = w.length > 2 ? w[0] + ' ' + w[w.length - 1] : w.join(' ');
  }
  const saved = corporate ? '' : liSavedFor(name);
  const liUrl = corporate ? 'https://www.linkedin.com/search/results/companies/?keywords=' + enc(shortCo(name)) : saved || liPeopleUrl(co ? `${name} ${shortCo(co)}` : name);
  const gUrl = 'https://www.google.com/search?q=' + enc(corporate ? `"${shortCo(name)}"` : `"${name}"${co ? ' ' + co : ''}`);
  const a = (cls, url, txt, title) => `<a class="${cls}" href="${esc(url)}" data-act="ext" data-url="${esc(url)}" title="${esc(title)}">${txt}</a>`;
  return `<span class="plk">${a('li' + (saved ? ' saved' : ''), liUrl, 'in', corporate ? `LinkedIn: ${shortCo(name)}` : saved ? `LinkedIn profile (saved): ${saved}` : `LinkedIn people: ${co ? name + ' ' + shortCo(co) : name}`)}${a('g', gUrl, 'G', `Google: ${corporate ? shortCo(name) : name + (co ? ' ' + co : '')}`)}${chUrl ? a('c', chUrl, 'CH', corporate ? 'Companies House page' : 'Companies House officer page') : ''}</span>`;
}

function pickerHtml(ctx) {
  const c = ctx.candidates;
  if (!c || ctx.fromDym || c.items.length < 2 || c.exactCount < 2) return '';
  const cur = ctx.company && ctx.company.number;
  return `<details class="picker"><summary><span>Other matches (${c.items.length - 1})</span><span></span></summary>
    <div class="opts">${c.items.map((it) => `<button class="opt ${it.number === cur ? 'cur' : ''}" data-act="pick" data-num="${esc(it.number)}"><span class="n">${esc(titleCase(it.name))}
      <small>${esc(it.number)}${it.formerExact ? ' · formerly ' + esc(titleCase(it.formerly.find((f) => alphaKey(f) === c.qk) || '')) : ''}${it.address ? ' · ' + esc(it.address) : ''}</small></span>${statusBadge(it.status)}</button>`).join('')}</div>
  </details>`;
}

/* ---------- company card ---------- */

/* Overview: merged into the top card with no heading of its own (still called "Overview" in Settings and here).
   Number and address are in the header line and its buttons, so they are not repeated. */
/* Registered office line: the text copies on click; the pin at its end shows/hides the map (height animates like the
   sections; the iframe is only created the first time it opens). The open/closed state is the "Map open by default" setting. */
function addrLineHtml(f, open) {
  return `<div class="addr"><span class="cv al" data-act="cp" data-copy="${esc(f.address)}" title="Registered office · click to copy">${esc(f.address)}</span>`
    + `<button class="mpin${open ? ' on' : ''}" data-act="map-toggle" aria-expanded="${open}" aria-controls="p-map" title="${open ? 'Hide the map' : 'Show on a map'}" aria-label="${open ? 'Hide the map' : 'Show the registered office on a map'}">${ICON.map}</button></div>`
    + `<div class="bb mapw${open ? '' : ' closed'}" id="p-map"><div class="bi"><div class="map wide" data-map="${esc(f.address)}"${open ? '' : ' data-defer="1"'}></div></div></div>`;
}
function toggleMap(btn) {
  const card = btn.closest('.hcard'), w = card && card.querySelector('.mapw'); if (!w) return;
  const open = w.classList.contains('closed');
  w.classList.toggle('closed', !open); btn.classList.toggle('on', open); btn.setAttribute('aria-expanded', String(open));
  btn.title = open ? 'Hide the map' : 'Show on a map'; btn.setAttribute('aria-label', open ? 'Hide the map' : 'Show the registered office on a map');
  if (open) { const m = w.querySelector('.map[data-defer]'); if (m) { m.removeAttribute('data-defer'); mountMaps(); } }
  if (st.ctx) st.ctx.mapOpen = open;
  settings.inlineMap = open; saveSettings();
}
function overviewHtml(f) {
  return `<dl class="kv ov" data-part="overview">
    <dt>Type</dt><dd>${cv(f.type)}</dd>
    <dt>Incorporated</dt><dd>${cv(fmtDate(f.created))} <span class="sub">(${esc(ageText(f.created))})</span></dd>
    ${f.ceased ? `<dt>Ceased</dt><dd>${cv(fmtDate(f.ceased))}</dd>` : ''}
    <dt>SIC</dt><dd>${f.sic.length ? f.sic.map((s) => `<div>${cv(s.code)}${s.desc ? ' <span class="sub">' + esc(s.desc) + '</span>' : ''}</div>`).join('') : 'None listed'}</dd>
    ${f.previousNames.length ? `<dt>Previous names</dt><dd>${f.previousNames.slice(0, 4).map((x) => `<div>${cv(x.name)} <span class="sub">until ${esc(fmtDate(x.to))}</span></div>`).join('')}${f.previousNames.length > 4 ? `<div class="sub">+${f.previousNames.length - 4} more</div>` : ''}</dd>` : ''}
  </dl>`;
}

function renderCompany(ctx, fresh) {
  hideEnt(true);
  const f = ctx.company;
  if (st.fv && st.fv.company !== f) closeDrawer(true);
  const n = f.number;
  const vcls = f.verdict === 'ok' ? '' : f.verdict;
  const reasons = f.caution.concat(f.check);
  const also = f.also.slice();
  if (ctx.candidates) {
    const sibling = ctx.candidates.items.find((it) => it.number !== f.number && (it.exact || it.formerExact) && it.status !== 'active' && it.status !== 'dissolved');
    if (sibling) also.push(`${titleCase(sibling.name)} (${sibling.number}) also matches "${ctx.query}" and is ${label('company_status', sibling.status).toLowerCase()}: check you have the right company`);
  }
  const ov = '<span class="ovd">OVERDUE</span>';
  const mapOn = ctx.mapOpen != null ? ctx.mapOpen : !!settings.inlineMap;
  const nameHtml = cv(f.display); // click copies; Companies House is one click away in the quick links and section titles
  const numHtml = cv(n);
  let html = backBar() + `<div class="card hcard">
    <button class="qn" data-act="copy-note" title="Copy quick note" aria-label="Copy quick note">${ICON.copy}</button>
    <div class="title"><span class="clogo" aria-hidden="true"></span>${nameHtml}</div>
    <div class="sub">${numHtml} · <span class="badge ${f.status === 'active' ? '' : 'r'}">${esc(f.statusLabel)}</span>${f.statusDetail ? ' <span class="badge r">' + esc(f.statusDetail) + '</span>' : ''}</div>
    ${ctx.personHint ? `<div class="alt">Looking for a person called ${esc(ctx.query)}? <button class="lnk" data-act="as-person">Search people</button></div>` : ''}
    ${settings.quickRow ? quickRow(ctx) : ''}
    <div class="verdict ${vcls}"><div class="vl">${verdictLabel(f.verdict)}</div><div>${reasons.length ? `<ul>${reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : '<ul class="one"><li title="Active, filings up to date, officers in place.">Active, filings up to date, officers in place.</li></ul>'}
    ${also.length ? `<div class="also"><b>Also:</b> ${also.map(esc).join(' · ')}</div>` : ''}</div></div>
    ${overviewHtml(f)}
    ${pickerHtml(ctx)}
    ${f.address ? addrLineHtml(f, mapOn) : ''}
  </div>`;
  // AI: the automatic summary (Companies House data only) sits right under the header card, with web search and chat.

  const secs = [];
  // Filing deadlines
  const overdue = (f.accounts.overdue ? 1 : 0) + (f.cs.overdue ? 1 : 0);
  secs.push(blk('deadlines', 'Filing deadlines', { def: secDef('deadlines'), force: settings.autoOpenProblems && overdue > 0, count: overdue ? `${overdue} overdue` : 'On time', countCls: overdue ? 'bad' : '', body: `<dl class="kv">
    <dt>Accounts</dt><dd>Last made up to ${cv(fmtDate(f.accounts.lastMadeUp) || 'none filed')}${f.accounts.lastType ? ' <span class="sub">(' + esc(f.accounts.lastType) + ')</span>' : ''}<br>Next due ${cv(fmtDate(f.accounts.nextDue) || 'n/a')}${f.accounts.overdue ? ov : ''}</dd>
    <dt>Confirmation</dt><dd>Last ${cv(fmtDate(f.cs.last) || 'n/a')}<br>Next due ${cv(fmtDate(f.cs.nextDue) || 'n/a')}${f.cs.overdue ? ov : ''}</dd>
  </dl>` }));
  // Officers
  secs.push(blk('officers', 'Officers', { def: secDef('officers'), href: `${f.url}/officers`, count: f.officersKnown ? f.officers.length : '?', body: officersHtml(ctx) }));
  // Recent officer changes
  secs.push(blk('changes', 'Recent officer changes', { def: secDef('changes'), count: f.recent.length, body: f.recent.length ? `<ul class="list">${f.recent.slice(0, 10).map((r) => `<li><span class="n">${esc(r.text)}</span><span class="m">${esc(fmtDate(r.date))}</span></li>`).join('')}</ul><div class="hint">Last 12 months: appointments, resignations, name changes.</div>` : '<div class="sub">No officer or name changes in the last 12 months.</div>' }));
  // PSC
  secs.push(blk('psc', 'People with significant control', { def: secDef('psc'), href: `${f.url}/persons-with-significant-control`, count: f.pscKnown ? f.pscs.length : '?', body: pscHtml(f) }));
  // Charges & insolvency
  const insolv = f.insolvency.length || f.hasInsolvency;
  const ccount = [f.charges.total ? `${f.charges.outstanding} outstanding` : '', insolv ? 'insolvency' : ''].filter(Boolean).join(' · ') || 'None';
  secs.push(blk('charges', 'Charges & insolvency', { def: secDef('charges'), force: settings.autoOpenProblems && (f.charges.outstanding > 0 || !!insolv), href: `${f.url}/charges`, count: ccount, countCls: insolv ? 'bad' : f.charges.outstanding ? 'warn' : '', body: chargesHtml(f) }));
  // Filings
  secs.push(blk('filings', 'Recent filings', { def: secDef('filings'), href: `${f.url}/filing-history`, count: f.filingsKnown ? f.filingsTotal : '?', body: filingsListHtml(f, ctx) }));
  // Similar companies nearby (lazy)
  if (settings.similar && f.sicCodes.length && f.postcode) secs.push(blk('similar', 'Similar companies nearby', { def: secDef('similar'), count: ctx.similar && ctx.similar.items ? ctx.similar.items.length : '', body: similarHtml(ctx) }));

  html += secs.join('');
  if (!settings.quickRow) html += blk('links', 'Quick links', { def: true, count: PROVIDERS.length, body: quickRow(ctx) });
  setBody(html, fresh, true); paintAi(ctx);
  if (fresh) $body.scrollTop = 0;
  wireFavicons();
  wireLogo(ctx);
  mountMaps();
  for (const id of Object.keys(SECTION_HOOKS)) if (isSecOpenInDom(id)) onSectionOpen(id);
}

function officersHtml(ctx) {
  const f = ctx.company;
  if (!f.officers.length) return `<div class="sub">${f.officersKnown ? 'No current officers listed.' : 'Officer list unavailable.'}</div>`;
  return `<ul class="list">${f.officers.slice(0, 12).map((o) => `<li class="hov"><span class="n">${personRef(o)}<small>${esc(o.role)}</small>${rolesSlot(ctx, o)}</span><span class="m">since ${cv(fmtDate(o.appointed))}</span></li>`).join('')}</ul>
    ${f.officers.length > 12 ? `<div class="hint">+${f.officers.length - 12} more on Companies House</div>` : ''}`;
}
/* Other directorships at a glance: count chip per officer (loaded lazily when Officers is open), click for the list. */
function rolesSlot(ctx, o) {
  if (!settings.otherRoles || !o.link || o.regNumber) return '';
  const r = ctx.roles && ctx.roles[o.link];
  let chip;
  if (!r) chip = '<span class="chip" aria-busy="true"><span class="spin"></span></span>';
  else if (r.error) chip = '<span class="chip" title="Could not load appointments">roles ?</span>';
  else if (!r.others.length) chip = '<span class="chip">No other active roles</span>';
  else chip = `<button class="chip${ctx.rolesOpen[o.link] ? ' on' : ''}" data-act="roles" data-link="${esc(o.link)}">+${r.others.length} other active role${r.others.length === 1 ? '' : 's'}</button>`;
  const list = r && !r.error && r.others.length && ctx.rolesOpen[o.link]
    ? `<div class="roles">${r.others.slice(0, 10).map((a) => `<div>${companyRef(a.number, a.company)} <span class="m">${esc(a.role)}</span></div>`).join('')}${r.others.length > 10 ? `<div class="m">+${r.others.length - 10} more</div>` : ''}</div>` : '';
  return `<div class="mt4" data-roles="${esc(o.link)}">${chip}${list}</div>`;
}
async function loadRoles(ctx) {
  if (!settings.otherRoles || !ctx.company || ctx.rolesBusy) return;
  const f = ctx.company;
  const todo = f.officers.slice(0, 12).filter((o) => o.link && !o.regNumber && !ctx.roles[o.link]);
  if (!todo.length) return;
  ctx.rolesBusy = true;
  const one = async (o) => {
    try {
      const items = await loadAppointments(o.link);
      ctx.roles[o.link] = { others: items.filter((a) => a.number !== f.number && !a.resigned && (!a.status || a.status === 'active')) };
    } catch (e) { ctx.roles[o.link] = { error: e.code || e.message }; }
    if (st.ctx === ctx) refreshRoles(ctx, o);
  };
  const queue = todo.slice();
  await Promise.all([0, 1, 2].map(async () => { while (queue.length) await one(queue.shift()); }));
  ctx.rolesBusy = false;
}
function refreshRoles(ctx, o) {
  $body.querySelectorAll('[data-roles]').forEach((el) => { if (el.dataset.roles === o.link) el.outerHTML = rolesSlot(ctx, o); });
}

function pscHtml(f) {
  if (!f.pscs.length) return `<div class="sub">${f.pscKnown ? 'None listed (may be exempt or a statement filed).' : 'Not available.'}</div>`;
  return `<ul class="list">${f.pscs.map((p) => {
    let nm;
    if (p.kind === 'Company') nm = (p.regNumber && settings.parentLinks ? companyRef(p.regNumber, p.name) : esc(p.name)) + (settings.personLinks ? personLinks(p.name, '', '', true) : '');
    else if (p.kind === 'Individual') nm = personRef({ name: p.name, link: p.officerLink });
    else nm = esc(p.name);
    const sub = [p.kind === 'Company' && p.regNumber ? 'Parent company' : p.kind, p.control].filter(Boolean).join(' · ');
    return `<li class="hov"><span class="n">${nm}<small>${esc(sub)}${p.regText ? '<br>' + esc(p.regText) : ''}</small></span><span class="m">${p.notified ? 'since ' + esc(fmtDate(p.notified)) : ''}</span></li>`;
  }).join('')}</ul>`;
}
function chargesHtml(f) {
  let h = '';
  const insLink = settings.chLinks ? ' · ' + extA(`${f.url}/insolvency`, 'Insolvency on Companies House', 'lk-ch" data-ins="1', 'Insolvency on Companies House (new tab)') : '';
  if (f.insolvency.length) h += `<div class="sub mb8"><b>Insolvency</b> · ${f.insolvency.length} case${f.insolvency.length === 1 ? '' : 's'}${insLink}</div><ul class="list">${f.insolvency.map((c) => `<li><span class="n">${esc(c.type)}<small>${esc(c.dates)}${c.practitioners.length ? '<br>Practitioners: ' + esc(c.practitioners.join(', ')) : ''}</small></span></li>`).join('')}</ul>`;
  else if (f.hasInsolvency) h += `<div class="sub mb8">Has insolvency history (details unavailable)${insLink}.</div>`;
  const cl = f.charges.list || [];
  if (f.charges.total) {
    const sorted = cl.slice().sort((a, b) => (b.outstanding - a.outstanding) || (a.created < b.created ? 1 : -1));
    h += `<div class="sub ${h ? 'mt10 ' : ''}mb8"><b>Charges</b> · ${f.charges.outstanding} outstanding of ${f.charges.total}${f.charges.partSatisfied ? ', ' + f.charges.partSatisfied + ' part satisfied' : ''}</div>
      <ul class="list">${sorted.slice(0, 10).map((c) => `<li><span class="n">${esc(c.entitled || c.what)}<small>${esc(c.what)} · created ${esc(fmtDate(c.created))}</small></span><span class="m"><span class="badge ${c.outstanding ? 'w' : ''}">${esc(c.status.replace(/-/g, ' ') || 'unknown')}</span></span></li>`).join('')}</ul>
      ${cl.length > 10 || f.charges.total > cl.length ? `<div class="hint">Showing ${Math.min(10, cl.length)} of ${f.charges.total}.</div>` : ''}`;
  } else if (!h) h = `<div class="sub">${f.charges.known ? 'No charges registered.' : 'Charges unknown.'}</div>`;
  return h;
}
function filingsListHtml(f, ctx, cur) {
  if (!f.filings.length) return `<div class="sub">${f.filingsKnown ? 'No filings.' : 'Filing history unavailable.'}</div>`;
  const list = f.filings.slice(0, 10);
  const rows = list.map((x, i) => `<li class="hov${cur === i ? ' cur' : ''}" data-act="filing" data-i="${i}" title="${x.meta ? 'Open document' : 'No document image; opens filing history'}"><span class="n"><span class="ty">${esc(x.type)}</span>${esc(x.text)}<small>${esc(fmtDate(x.date))}${x.pages ? ' · ' + x.pages + ' page' + (x.pages === 1 ? '' : 's') : ''}${x.meta ? '' : ' · no document'}</small></span>${x.meta ? xi(docUrl(f.number, x.id), 'Open PDF (new tab)') : ''}</li>`).join('');
  const more = f.filings.length > 10 || (f.filingsTotal || 0) > 10 ? `<div class="row mt6"><button class="btn sm" data-act="filings-all">${ICON.doc}Browse all ${f.filingsTotal} filings</button></div>` : '';
  return `<ul class="list fl">${rows}</ul>${more}`;
}

/* ---------- similar companies nearby (CH advanced search; loaded after the main lookup) ----------
   GET /advanced-search/companies?sic_codes=&location=&company_status=active&size=&start_index= returns { hits, items }.
   size and start_index page through the results (asking past the last hit returns an error), so "Load more" fetches 10 more. */
function similarHtml(ctx) {
  const s = ctx.similar;
  if (!s || s.loading) return '<div class="skel w75"></div><div class="skel w60"></div><div class="skel w82"></div>';
  if (s.error) return `<div class="sub">Could not load (${esc(s.error)}).</div>`;
  if (!s.items.length) return '<div class="sub">No other active companies with the same SIC code nearby.</div>';
  const more = s.more ? `<button class="btn sm moreb" data-act="similar-more"${s.busy ? ' disabled' : ''}>${s.busy ? 'Loading...' : 'Load more'}</button>` : '';
  return `<ul class="list">${s.items.map((c) => `<li class="hov"><span class="n">${companyRef(c.number, c.name)}<small>${esc(c.postcode)}${c.created ? ' · since ' + esc(fmtDate(c.created).replace(/^\d+ /, '')) : ''}</small></span></li>`).join('')}</ul>
    ${more}${s.moreErr ? `<div class="sub">${esc(s.moreErr)}</div>` : ''}<div class="hint">Active companies with SIC ${esc(s.sic)} registered in ${esc(s.area)}${s.total > s.items.length ? ` · showing ${s.items.length} of ${s.total}` : ''}.</div>`;
}
const simItem = (c) => ({ number: c.company_number, name: titleCase(c.company_name), postcode: (c.registered_office_address || {}).postal_code || '', created: c.date_of_creation });
function similarPaint(ctx) {
  if (st.ctx !== ctx) return;
  const sec = $body.querySelector('.blk[data-sec="similar"]'); if (!sec) return;
  sec.querySelector('.bc').innerHTML = similarHtml(ctx);
  const c = sec.querySelector('[data-cnt]'); const n = ctx.similar.items ? String(ctx.similar.total || ctx.similar.items.length) : '';
  if (c) c.textContent = n; else if (n) sec.querySelector('.sp').insertAdjacentHTML('afterend', `<span class="cnt new" data-cnt="similar">${n}</span>`);
}
async function loadMoreSimilar(ctx) {
  const s = ctx.similar; if (!s || !s.more || s.busy) return;
  s.busy = true; s.moreErr = ''; similarPaint(ctx);
  try {
    if (s.buf && s.buf.length >= 10 || (s.buf && s.buf.length && s.next >= s.hits)) { s.items = s.items.concat(s.buf.splice(0, 10)); s.more = s.buf.length > 0 || s.next < s.hits; s.busy = false; return similarPaint(ctx); }
    const r = await ch(`/advanced-search/companies?sic_codes=${encodeURIComponent(s.sic)}&location=${encodeURIComponent(s.loc)}&company_status=active&size=10&start_index=${s.next}`);
    const got = ((r && r.items) || []).filter((c) => c.company_number !== ctx.company.number && !s.items.some((x) => x.number === c.company_number));
    s.next += ((r && r.items) || []).length || 10; s.hits = (r && r.hits) || s.hits;
    const add = (s.buf || []).concat(got.map(simItem)).filter((x) => !s.items.some((y) => y.number === x.number));
    s.items = s.items.concat(add.slice(0, 10)); s.buf = add.slice(10); s.more = s.buf.length > 0 || (s.next < s.hits && ((r && r.items) || []).length > 0);
  } catch (e) { s.moreErr = 'Could not load more (' + (e.code || e.message) + ').'; }
  s.busy = false; similarPaint(ctx);
}
async function loadSimilar(ctx) {
  if (!settings.similar || ctx.similar) return;
  const f = ctx.company;
  if (!f || !f.sicCodes.length || !f.postcode) return;
  ctx.similar = { loading: true };
  const sic = f.sicCodes.filter((c) => c !== '99999').slice(0, 2).join(',');
  const outward = String(f.postcode || '').toUpperCase().split(' ')[0];
  try {
    if (!sic) throw new PErr('nosic', 'no SIC code');
    const q = (loc) => ch(`/advanced-search/companies?sic_codes=${encodeURIComponent(sic)}&location=${encodeURIComponent(loc)}&company_status=active&size=11`);
    const own = (r) => ((r && r.items) || []).some((c) => c.company_number === f.number) ? 1 : 0;
    let area = outward, loc = outward, r = outward ? await q(outward) : null, hits = (r && r.hits) || 0, got = ((r && r.items) || []).length, self = own(r);
    let items = ((r && r.items) || []).filter((c) => c.company_number !== f.number), extra = 0;
    if (items.length < 3 && f.locality) {
      const r2 = await q(f.locality); const more = ((r2 && r2.items) || []).filter((c) => c.company_number !== f.number && !items.some((x) => x.company_number === c.company_number));
      extra = items.length; items = items.concat(more); area = outward ? outward + ' / ' + f.locality : f.locality; loc = f.locality;
      hits = (r2 && r2.hits) || 0; got = ((r2 && r2.items) || []).length; self = own(r2);
    }
    const shown = items.slice(0, 10);
    // paging continues on the query used last; total = everything that query matched, minus this company, plus any kept from the first query
    const total = Math.max(shown.length, hits - self + (loc !== outward ? extra : 0));
    const buf = items.slice(10).map(simItem);
    ctx.similar = { sic, area, loc, items: shown.map(simItem), buf, next: got, hits, total, more: got < hits || buf.length > 0 };
  } catch (e) { ctx.similar = { error: e.code || e.message }; }
  similarPaint(ctx);
}


/* ---------- inline map (Google Maps embed; falls back to a link when the page CSP blocks frames) ---------- */
const frameWatch = new Set();
function onCspViolation(e) {
  try {
    const u = String(e.blockedURI || '');
    if (!/frame|child|default/.test(e.violatedDirective || e.effectiveDirective || '')) return;
    for (const w of Array.from(frameWatch)) if (w.match(u)) w.fail('blocked by this page\'s security policy');
  } catch (err) { /* ignore */ }
}
function watchFrame(iframe, matchFn, onFail, onOk, ms) {
  const w = { done: false, match: matchFn, fail: (why) => { if (w.done === 'fail') return; w.done = 'fail'; clearTimeout(w.t); frameWatch.delete(w); onFail(why); } };
  frameWatch.add(w);
  w.t = setTimeout(() => { if (!w.done) w.fail('did not load'); }, ms || 10000);
  iframe.addEventListener('load', () => { setTimeout(() => { if (!w.done) { w.done = 'ok'; clearTimeout(w.t); onOk && onOk(); setTimeout(() => frameWatch.delete(w), 3000); } }, 500); });
  iframe.addEventListener('error', () => w.fail('failed to load'));
  return w;
}
function mountMaps() {
  $body.querySelectorAll('.map[data-map]:not([data-mounted]):not([data-defer])').forEach((box) => {
    box.setAttribute('data-mounted', '1');
    const q = box.dataset.map;
    const f = document.createElement('iframe');
    f.title = 'Map of ' + q; f.referrerPolicy = 'no-referrer-when-downgrade';
    f.src = 'https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&output=embed';
    box.appendChild(f);
    watchFrame(f, (u) => /google\./.test(u) || u === 'frame-src' || !u, (why) => {
      box.classList.add('fail'); box.setAttribute('data-state', 'fail');
      box.insertAdjacentHTML('beforeend', `<div class="mmsg">Map can't be shown here (${esc(why)}). ${extA(mapsUrl(q), 'Open in Google Maps', 'lk-place')}</div>`);
    }, () => box.setAttribute('data-state', 'ok'), 15000);
  });
}

/* ---------- filings viewer: a drawer that slides out to the left of the panel ----------
   Left: search + category chips + compact list. Right: the selected document. Up/Down (and Left/Right outside the
   search box) move through the filtered list, / jumps to search, Esc closes. Narrow windows get a full-width overlay. */
const FCATS = [['all', 'All'], ['accounts', 'Accounts'], ['confirmation', 'Confirmation'], ['officers', 'Officers'], ['charges', 'Charges'], ['capital', 'Capital'], ['other', 'Other']];
function fcat(x) {
  const c = x.category || '';
  if (c === 'accounts') return 'accounts';
  if (c === 'confirmation-statement' || c === 'annual-return') return 'confirmation';
  if (c === 'officers') return 'officers';
  if (c === 'mortgage') return 'charges';
  if (c === 'capital') return 'capital';
  return 'other';
}
const pagesTxt = (x) => (x.pages ? x.pages + (x.pages === 1 ? ' page' : ' pages') : '');
function fvMatches(fv) {
  const q = fv.q.trim().toLowerCase(); const out = [];
  fv.company.filings.forEach((x, i) => {
    if (fv.cat !== 'all' && fcat(x) !== fv.cat) return;
    if (q && !`${x.text} ${x.type} ${fmtDate(x.date)} ${x.date}`.toLowerCase().includes(q)) return;
    out.push(i);
  });
  return out;
}
function openFilings(idx) {
  const ctx = st.ctx; if (!ctx || !ctx.company || !$drawer) return;
  const f = ctx.company;
  if (st.fv && st.fv.company !== f) closeDrawer(true);
  const fresh = !st.fv;
  if (fresh) st.fv = { company: f, idx: 0, cat: 'all', q: '', blobs: {}, loading: false, view: [] };
  st.fv.idx = Math.max(0, Math.min(idx || 0, f.filings.length - 1));
  if (fresh) renderDrawer(); else fvSelect(st.fv.idx);
  placeDrawer();
  $drawer.classList.add('open'); if (st.styleMode === 'none') $drawer.style.display = 'flex';
  const li = $drawer.querySelector('.dwr.cur'); if (li) { li.scrollIntoView({ block: 'nearest' }); li.focus({ preventScroll: true }); }
  // Pull a bigger page of history in the background so search and filters cover more than the first 25.
  if (fresh && f.filings.length < (f.filingsTotal || 0) && f.filings.length < 100) loadMoreFilings();
}
function closeDrawer(now) {
  const fv = st.fv; if (!fv) return;
  st.fv = null; clearTimeout(fv.t);
  if ($drawer) { $drawer.classList.remove('open'); if (st.styleMode === 'none') $drawer.style.display = 'none'; }
  const free = () => {
    for (const u of Object.values(fv.blobs)) { try { URL.revokeObjectURL(u.url); } catch (e) { /* ignore */ } }
    fv.blobs = {}; if (!st.fv && $drawer) $drawer.innerHTML = '';
  };
  if (now || !root.classList.contains('anim')) free(); else setTimeout(free, 320);
}
function renderDrawer() {
  const fv = st.fv; if (!fv || !$drawer) return;
  const f = fv.company;
  $drawer.innerHTML = `<div class="dw-hd"><div class="dw-t"><b>Filing history</b><span>${esc(f.display)} · ${esc(f.number)}</span></div>
    <span class="pos" aria-live="polite"></span>
    <button class="ib" data-act="fv-prev" title="Previous filing (Up)">${ICON.up}</button><button class="ib" data-act="fv-next" title="Next filing (Down)">${ICON.down}</button>
    <button class="ib x" data-act="fv-close" title="Close (Esc)">${ICON.x}</button></div>
    <div class="dw-bd"><div class="dw-side">
      <label class="dw-sr">${ICON.search}<input class="dw-q" type="search" placeholder="Search filings" spellcheck="false" autocomplete="off" value="${esc(fv.q)}" aria-label="Search filings"></label>
      <div class="dw-cats" role="tablist" aria-label="Filter by category"></div>
      <ul class="dw-list" role="listbox" aria-label="Filings"></ul>
      <div class="dw-kb"><kbd>↑</kbd><kbd>↓</kbd> move · <kbd>/</kbd> search · <kbd>Esc</kbd> close</div>
    </div><div class="dw-doc"></div></div>`;
  renderFvList(); renderFvDoc();
}
function renderFvList(keepScroll) {
  const fv = st.fv; if (!fv || !$drawer) return;
  const f = fv.company, all = f.filings, total = f.filingsTotal || all.length, more = all.length < total;
  const counts = {}; for (const x of all) { const c = fcat(x); counts[c] = (counts[c] || 0) + 1; }
  const cats = $drawer.querySelector('.dw-cats'), ul = $drawer.querySelector('.dw-list'); if (!cats || !ul) return;
  cats.innerHTML = FCATS.filter(([k]) => k === 'all' || counts[k] || fv.cat === k).map(([k, l]) => `<button class="${fv.cat === k ? 'on' : ''}" role="tab" aria-selected="${fv.cat === k}" data-act="fv-cat" data-cat="${k}">${l}<i>${k === 'all' ? all.length : counts[k] || 0}</i></button>`).join('');
  fv.view = fvMatches(fv);
  const sc = ul.scrollTop, ae = sroot.activeElement, hadFocus = !!(ae && ae.classList && ae.classList.contains('dwr'));
  ul.innerHTML = (fv.view.length ? fv.view.map((i) => { const x = all[i]; return `<li class="dwr${i === fv.idx ? ' cur' : ''}${x.meta ? '' : ' nodoc'}" role="option" aria-selected="${i === fv.idx}" tabindex="-1" data-act="fv-pick" data-i="${i}"><div class="tx">${esc(x.text)}</div><div class="mt"><span>${esc(fmtDate(x.date))}</span><span class="ty">${esc(x.type)}</span>${x.pages ? `<span>${pagesTxt(x)}</span>` : ''}${x.meta ? '' : '<span>no document</span>'}</div></li>`; }).join('')
    : `<li class="dw-none">${fv.q.trim() || fv.cat !== 'all' ? 'No matching filings' + (more ? ' in the ' + all.length + ' loaded.' : '.') : f.filingsKnown ? 'No filings.' : 'Filing history unavailable.'}</li>`)
    + (more ? `<li class="dw-more">${fv.loading ? '<span class="spin"></span>&nbsp; Loading more...' : `<button class="btn sm" data-act="fv-more">Load more (${all.length} of ${total})</button>`}</li>` : '');
  if (keepScroll) ul.scrollTop = sc;
  if (hadFocus) { const c = ul.querySelector('.dwr.cur') || ul.querySelector('.dwr'); if (c) c.focus({ preventScroll: true }); }
  fvPos();
}
function fvPos() {
  const fv = st.fv; if (!fv || !$drawer) return;
  const el = $drawer.querySelector('.dw-hd .pos'); if (!el) return;
  const f = fv.company, total = f.filingsTotal || f.filings.length, k = fv.view.indexOf(fv.idx);
  const filtered = fv.cat !== 'all' || !!fv.q.trim();
  el.textContent = k < 0 ? (filtered ? fv.view.length + ' shown' : '') : filtered ? `${k + 1} of ${fv.view.length}${f.filings.length < total ? ' loaded' : ''}` : `${k + 1} of ${total}`;
  const p = $drawer.querySelector('[data-act=fv-prev]'), n = $drawer.querySelector('[data-act=fv-next]');
  if (p) p.disabled = k < 0 ? !fv.view.length : k <= 0;
  if (n) n.disabled = k < 0 ? !fv.view.length : k >= fv.view.length - 1 && f.filings.length >= total;
}
function renderFvDoc() {
  const fv = st.fv; if (!fv || !$drawer) return;
  const f = fv.company, x = f.filings[fv.idx], box = $drawer.querySelector('.dw-doc'); if (!box) return;
  if (!x) { box.innerHTML = '<div class="mmsg">No filing selected.</div>'; return; }
  const u = docUrl(f.number, x.id);
  box.innerHTML = `<div class="dh"><h3>${esc(x.text)}</h3><div class="meta"><span class="ty">${esc(x.type)}</span>${esc(fmtDate(x.date))}${x.pages ? ' · ' + pagesTxt(x) : ''} · ${esc(FCATS.find((c) => c[0] === fcat(x))[1])}</div></div>
    <div class="row">${x.meta ? `<a class="btn sm" href="${esc(u)}" data-act="ext" data-url="${esc(u)}">Open in new tab${ICON.ext}</a><button class="btn sm" data-act="f-dl">${ICON.dl}Download</button><span class="shwrap"><button class="btn sm" data-act="f-share" aria-haspopup="menu">${ICON.share}Share</button></span>` : extA(`${f.url}/filing-history`, 'Filing history', 'btn sm')}</div>
    <div class="pdf" data-pdf="${esc(x.id)}">${x.meta ? '<div class="mmsg"><span class="spin"></span>&nbsp; Loading document...</div>' : '<div class="mmsg">No document image is available for this filing.</div>'}</div>`;
  clearTimeout(fv.t);
  // Short settle delay so holding an arrow key skims the list without firing a download per row.
  if (x.meta) fv.t = setTimeout(() => { if (st.fv === fv && fv.company.filings[fv.idx] === x) showDoc(fv, x); }, fv.blobs[x.id] ? 0 : 160);
}
function fvSelect(i) {
  const fv = st.fv; if (!fv || !fv.company.filings[i]) return;
  fv.idx = i;
  $drawer.querySelectorAll('.dwr.cur').forEach((li) => { li.classList.remove('cur'); li.setAttribute('aria-selected', 'false'); });
  const li = $drawer.querySelector(`.dwr[data-i="${i}"]`);
  if (li) {
    li.classList.add('cur'); li.setAttribute('aria-selected', 'true'); li.scrollIntoView({ block: 'nearest' });
    const ae = sroot.activeElement; if (!(ae && ae.classList && ae.classList.contains('dw-q'))) li.focus({ preventScroll: true });
  }
  fvPos(); renderFvDoc();
}
async function fvStep(d) {
  const fv = st.fv; if (!fv) return;
  const v = fv.view, k = v.indexOf(fv.idx);
  if (k < 0) { if (v.length) fvSelect(v[d > 0 ? 0 : v.length - 1]); return; }
  if (k + d >= 0 && k + d < v.length) { fvSelect(v[k + d]); return; }
  if (d > 0 && fv.company.filings.length < (fv.company.filingsTotal || 0)) {
    await loadMoreFilings();
    if (st.fv === fv && fv.view.length > k + 1) fvSelect(fv.view[k + 1]);
  }
}
function onDrawerScroll(e) {
  const u = e.target, fv = st.fv;
  if (!fv || fv.loading || !u.classList || !u.classList.contains('dw-list')) return;
  if (u.scrollTop + u.clientHeight > u.scrollHeight - 120 && fv.company.filings.length < (fv.company.filingsTotal || 0)) loadMoreFilings();
}
/* Share the permanent Companies House document URL (never the expiring signed S3 link). Native share sheet when the
   browser has one; otherwise a small menu: Email, WhatsApp, Slack, Teams, Copy link. */
async function docShare(btn) {
  const ctx = st.fv; if (!ctx) return; const x = ctx.company.filings[ctx.idx]; if (!x) return;
  const url = docUrl(ctx.company.number, x.id);
  const title = `${ctx.company.display}: ${x.text} (${fmtDate(x.date)})`;
  const data = { title, text: title, url };
  let can = typeof navigator.share === 'function';
  try { if (can && typeof navigator.canShare === 'function') can = navigator.canShare(data); } catch (e) { can = false; }
  if (can) {
    try { await navigator.share(data); st.lastShare = { via: 'native', url }; return; }
    catch (e) { if (e && e.name === 'AbortError') return; warn('navigator.share failed, showing share menu', e); }
  }
  toggleShareMenu(btn, title, url);
}
function toggleShareMenu(btn, title, url, force) {
  const wrap = btn && btn.closest('.shwrap'); if (!wrap) return;
  let m = wrap.querySelector('.shm');
  if (!m) {
    const enc = encodeURIComponent;
    const items = [
      ['email', 'Email', `mailto:?subject=${enc(title)}&body=${enc(title + '\n' + url)}`, 'share-mail'],
      ['whatsapp', 'WhatsApp', 'https://wa.me/?text=' + enc(title + ' ' + url), 'ext'],
      ['slack', 'Slack (copies a message)', '', 'share-slack'],
      ['teams', 'Microsoft Teams', `https://teams.microsoft.com/share?href=${enc(url)}&msgText=${enc(title)}&preview=true`, 'ext'],
      ['copy', 'Copy link', '', 'cp'],
    ];
    wrap.insertAdjacentHTML('beforeend', `<div class="shm" role="menu"><div class="qin"><h6>Share</h6>${items.map(([k, l, u, act]) => `<a class="qi" role="menuitem" tabindex="-1" data-share="${k}" data-act="${act}"${u ? ` href="${esc(u)}" data-url="${esc(u)}"` : ' href="#"'}${act === 'cp' ? ` data-copy="${esc(url)}"` : ''}${act === 'share-slack' ? ` data-copy="${esc(title + ' ' + url)}"` : ''}>${esc(l)}${act === 'ext' ? ICON.ext : ''}</a>`).join('')}</div></div>`);
    m = wrap.querySelector('.shm');
  }
  const show = force != null ? force : !m.classList.contains('show');
  m.classList.toggle('show', show);
  if (show) { const first = m.querySelector('.qi'); if (first) first.focus(); }
}
function closeShare() { sroot.querySelectorAll('.shm.show').forEach((m) => m.classList.remove('show')); }
async function loadMoreFilings() {
  const fv = st.fv; if (!fv || fv.loading) return; const f = fv.company;
  fv.loading = true; renderFvList(true);
  try {
    const r = await ch(`/company/${f.number}/filing-history?items_per_page=100&start_index=${f.filings.length}`);
    const add = ((r && r.items) || []).map((x) => ({ id: x.transaction_id, date: x.date, type: x.type, category: x.category || '', pages: x.pages || 0, text: filingText(x), meta: (x.links && x.links.document_metadata) || '' }));
    if (!add.length) f.filingsTotal = f.filings.length;
    f.filings.push(...add);
  } catch (e) { showToast('Could not load more filings'); }
  fv.loading = false;
  if (st.fv === fv) renderFvList(true);
}
function onFilingRow(i) {
  const ctx = st.ctx; if (!ctx || !ctx.company) return;
  const f = ctx.company, x = f.filings[i]; if (!x) return;
  const mode = settings.filingOpen;
  if (mode === 'viewer') return openFilings(i);
  if (mode === 'tab' && x.meta) return openTab(docUrl(f.number, x.id));
  openTab(`${f.url}/filing-history`);
}

/* ---------- person view (officer appointments) ---------- */
async function openPerson(link, name) {
  const fromCo = curCoName();
  pushNav();
  const ctx = st.ctx = { kind: 'person', link, name, fromCo, data: null, det: { mode: 'person', type: 'person', raw: name, label: 'Person' }, query: name, raw: name };
  const req = ++st.req;
  renderPersonView(ctx, true);
  try { ctx.data = await loadAppointmentsFull(link); } catch (e) { ctx.error = e; }
  if (req === st.req) renderPersonView(ctx, true);
}
function renderPersonView(ctx, fresh) {
  const d = ctx.data;
  const chUrl = CH_WEB + ctx.link;
  let h = backBar() + `<div class="card pv"><h3>${esc((d && d.name) || ctx.name)}</h3>
    <div class="sub">${d && d.dob ? 'Born ' + esc(d.dob) + ' · ' : ''}Companies House officer ${personLinks((d && d.name) || ctx.name, ctx.fromCo || (d && d.items.find((a) => !a.resigned) ? shortCo(d.items.find((a) => !a.resigned).company) : ''), chUrl)}</div>`;
  if (!d && !ctx.error) return setBody(h + '<div class="skel w60 mt10"></div><div class="skel w85"></div></div><div class="card skc"><div class="skel w75"></div><div class="skel w90"></div><div class="skel w60"></div></div>', fresh);
  if (ctx.error) return setBody(h + `</div><div class="err">Could not load appointments (${esc(ctx.error.code || ctx.error.message)}).</div>`, fresh);
  const active = d.items.filter((a) => !a.resigned), past = d.items.filter((a) => a.resigned);
  h += `<div class="stat"><span class="cnt">${d.total} appointment${d.total === 1 ? '' : 's'}</span><span class="cnt">${active.length} current</span>${past.length ? `<span class="cnt">${past.length} resigned</span>` : ''}</div>
    <div class="row mt10">${extA(chUrl, 'Officer page', 'btn sm', 'Companies House officer page (new tab)')}<button class="btn sm" data-act="cp" data-copy="${esc((d && d.name) || ctx.name)}">${ICON.copy}Copy name</button></div></div>`;
  const row = (a) => `<li class="hov"><span class="n">${companyRef(a.number, a.company)}<small>${esc(a.role)} · appointed ${esc(fmtDate(a.appointed))}${a.resigned ? ' · resigned ' + esc(fmtDate(a.resigned)) : ''}</small></span><span class="m">${a.status && a.status !== 'active' ? `<span class="badge r">${esc(label('company_status', a.status))}</span>` : ''}</span></li>`;
  h += blk('p-current', 'Current appointments', { def: true, count: active.length, body: active.length ? `<ul class="list">${active.map(row).join('')}</ul>` : '<div class="sub">None.</div>' });
  if (past.length) h += blk('p-past', 'Resigned', { def: false, count: past.length, body: `<ul class="list">${past.map(row).join('')}</ul>` });
  if (d.total > d.items.length) h += `<div class="hint">Showing ${d.items.length} of ${d.total}; see the officer page for all.</div>`;
  setBody(h, fresh);
}

/* ---------- Interactive entities in AI text ----------
   AI text is stored plain. When it is shown it is matched against this company's real Companies House data
   (officers, PSCs, addresses, SIC codes, numbers, dates, other companies) and the URLs the web search or website
   fetch actually returned. Only those matches become interactive, so a name the model made up stays plain text. */
const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const DATE_RE = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})\b|\b(\d{4})-(\d{2})-(\d{2})\b/gi;
const ddmmyyyy = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso; };
function entIndex(ctx) {
  const f = ctx.company, rec = ctx.ai || {};
  const key = [f.number, coSig(f), Object.keys(ctx.roles || {}).length, rec.web ? rec.web.at : 0, (rec.chat || []).length].join('|');
  if (ctx._ents && ctx._ents.key === key) return ctx._ents;
  const list = [], seen = new Set(), dates = {};
  const add = (text, d, o) => {
    text = String(text || '').replace(/\s+/g, ' ').trim(); o = o || {};
    if (text.length < 3) return;
    const k = text.toLowerCase(); if (seen.has(k)) return; seen.add(k);
    const src = o.re || reEsc(text).replace(/\s*,\s*/g, ',?\\s+').replace(/ +/g, '\\s+');
    list.push({ rx: new RegExp('(?<![\\w@/.-])(?:' + src + ')(?![\\w-])', o.ci ? 'gi' : 'g'), d });
  };
  const person = (name, d) => {
    add(name, d);
    const w = String(name).replace(/\s*\((?:Dr|Sir|Prof|Mr|Mrs|Ms|Lord|Lady)\)/g, '').split(/\s+/).filter(Boolean);
    if (w.length > 2) add(w[0] + ' ' + w[w.length - 1], d);
  };
  const date = (iso, label) => { const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso || ''); if (!m) return; (dates[m[1]] = dates[m[1]] || []).includes(label) || dates[m[1]].push(label); };
  // the company itself (and its previous names)
  const self = { k: 'co', name: f.display, num: f.number, self: 1 };
  add(f.display, self, { ci: 1 }); add(f.name, self, { ci: 1 });
  const sc = shortCo(f.display); if (sc.length >= 4) add(sc, self);
  for (const x of f.previousNames) add(x.name, { k: 'co', name: x.name, num: f.number, prev: x.to || '' }, { ci: 1 });
  // people and corporate officers / owners
  for (const o of f.officers) {
    if (o.corporate) add(o.name, { k: 'co', name: o.name, num: o.regNumber || '', role: o.role }, { ci: 1 });
    else person(o.name, { k: 'person', name: o.name, role: o.role, since: o.appointed || '', link: o.link || '' });
    date(o.appointed, `${o.name} appointed`);
  }
  for (const o of f.former || []) { person(o.name, { k: 'person', name: o.name, role: o.role, until: o.resigned || '', link: o.link || '' }); date(o.resigned, `${o.name} resigned`); }
  for (const p of f.pscs) {
    if (p.kind === 'Individual') person(p.name, { k: 'person', name: p.name, role: 'Person with significant control', ctl: p.control || '', link: p.officerLink || '' });
    else add(p.name, { k: 'co', name: p.name, num: p.regNumber || '', role: 'Owner (PSC)' + (p.control ? ': ' + p.control : '') }, { ci: 1 });
    date(p.notified, `${p.name} became a PSC`);
  }
  for (const r of Object.values(ctx.roles || {})) for (const a of (r && r.others) || []) add(a.company, { k: 'co', name: a.company, num: a.number || '', role: 'Linked through a director' }, { ci: 1 });
  for (const c of f.charges.list) {
    if (c.entitled) for (const nm of [c.entitled].concat(c.entitled.split(/,\s*(?=[A-Z])/))) add(nm, { k: 'co', name: nm, num: '', role: 'Charge holder' }, { ci: 1 });
    date(c.created, 'Charge created' + (c.entitled ? ' (' + c.entitled + ')' : ''));
  }
  // numbers
  add(f.number, { k: 'num', num: f.number, name: f.display, self: 1 });
  for (const x of f.officers.concat(f.pscs)) if (x.regNumber) add(x.regNumber, { k: 'num', num: x.regNumber, name: x.name });
  // places
  if (f.address) {
    const parts = f.address.split(/\s*,\s*/).filter(Boolean);
    for (let i = 0; i < parts.length; i++) for (let j = parts.length; j > i + 1; j--) add(parts.slice(i, j).join(', '), { k: 'addr', addr: f.address }, { ci: 1 });
    if (f.locality) add(f.locality, { k: 'addr', addr: f.address, town: 1 }, { ci: 1 });
    if (f.postcode) add(f.postcode, { k: 'addr', addr: f.address, pc: 1 }, { ci: 1 });
  }
  // SIC codes ("SIC 10710", "SIC code 10710" or the bare code)
  for (const s of f.sic) add('SIC ' + s.code, { k: 'sic', code: s.code, desc: s.desc || '' }, { re: '(?:SIC(?:\\s+codes?)?:?\\s*)?' + s.code, ci: 1 });
  // URLs and domains the web search or website fetch really returned
  const srcs = [].concat((rec.web && rec.web.sources) || [], (rec.web && rec.web.pages) || []);
  for (const t of rec.chat || []) for (const x of t.sources || []) srcs.push(x);
  if (rec.web && rec.web.site) srcs.push({ url: 'https://' + rec.web.site + '/', title: rec.web.site });
  for (const x of srcs) {
    if (!x || !x.url) continue;
    add(x.url, { k: 'url', url: x.url, title: x.title || '' }, { ci: 1 });
    const h = hostOf(x.url); add('www.' + h, { k: 'url', url: 'https://' + h + '/', title: h }, { ci: 1 }); add(h, { k: 'url', url: 'https://' + h + '/', title: h }, { ci: 1 });
  }
  // dates that appear in the data, with what happened on them
  date(f.created, 'Incorporated'); date(f.ceased, 'Ceased');
  date(f.accounts.lastMadeUp, 'Accounts made up to'); date(f.accounts.nextDue, 'Accounts due');
  date(f.cs.last, 'Confirmation statement made up to'); date(f.cs.nextDue, 'Confirmation statement due');
  for (const x of f.previousNames) date(x.to, 'Renamed from ' + x.name);
  for (const r of f.recent) date(r.date, r.text);
  for (const x of f.filings.slice(0, 30)) date(x.date, 'Filed: ' + x.text);
  list.sort((a, b) => b.rx.source.length - a.rx.source.length);
  ctx._ents = { key, list, dates };
  return ctx._ents;
}
const ENT_CLS = { person: 'e-person', addr: 'e-place', co: 'e-ch', num: 'e-ch', sic: 'e-ch', url: 'e-ch', date: 'e-plain' };
function entCopy(t, d) {
  if (d.k === 'addr') return d.town || d.pc ? t : d.addr;
  if (d.k === 'sic') return d.code; if (d.k === 'num') return d.num; if (d.k === 'url') return d.url;
  if (d.k === 'person' || d.k === 'co') return d.name || t;
  return t;
}
function entSpan(t, d) {
  const dd = Object.assign({ t }, d);
  return `<span class="ent ${ENT_CLS[d.k] || ''}" tabindex="0" role="button" data-act="cp" data-copy="${esc(entCopy(t, d))}" data-e="${esc(JSON.stringify(dd))}">${esc(t)}</span>`;
}
function linkify(text, ctx) {
  text = String(text == null ? '' : text);
  if (!ctx || !ctx.company) return esc(text);
  let ix; try { ix = entIndex(ctx); } catch (e) { warn('entity index failed', e); return esc(text); }
  const hits = [];
  for (const e of ix.list) { e.rx.lastIndex = 0; let m; while ((m = e.rx.exec(text))) { if (!m[0]) { e.rx.lastIndex++; continue; } hits.push({ s: m.index, e: m.index + m[0].length, d: e.d }); } }
  DATE_RE.lastIndex = 0; let m;
  while ((m = DATE_RE.exec(text))) {
    const iso = m[4] ? `${m[4]}-${m[5]}-${m[6]}` : `${m[3]}-${String(MON[m[2].toLowerCase()] || 0).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const lab = ix.dates[iso];
    if (lab) hits.push({ s: m.index, e: m.index + m[0].length, d: { k: 'date', iso, labels: lab.slice(0, 3) } });
  }
  hits.sort((a, b) => a.s - b.s || b.e - a.e);
  let out = '', pos = 0;
  for (const h of hits) { if (h.s < pos) continue; out += esc(text.slice(pos, h.s)) + entSpan(text.slice(h.s, h.e), h.d); pos = h.e; }
  return out + esc(text.slice(pos));
}
function entPopHtml(d) {
  const B = (act, label, extra, icon) => `<button class="eb" data-act="${act}" ${extra || ''}>${icon || ''}<span>${esc(label)}</span></button>`;
  const X = (url, label, cls) => `<a class="eb ${cls || ''}" href="${esc(url)}" data-act="ext" data-url="${esc(url)}" title="${esc(url)}">${esc(label)}${ICON.ext}</a>`;
  const cp = (v, label) => B('cp', label || 'Copy', `data-copy="${esc(v)}"`, ICON.copy);
  let h = '', s = '', a = '';
  if (d.k === 'person') {
    h = d.name; s = [d.role, d.since ? 'since ' + fmtDate(d.since) : '', d.until ? 'resigned ' + fmtDate(d.until) : '', d.ctl].filter(Boolean).join(' · ');
    a = cp(d.name) + (d.link ? B('person', 'Appointments', `data-link="${esc(d.link)}" data-name="${esc(d.name)}"`) : B('person-search', 'Find officer', `data-name="${esc(d.name)}"`))
      + personLinks(d.name, curCoName(), d.link ? CH_WEB + d.link : '') + X(liPeopleUrl(String(d.name).replace(/^(Mr|Mrs|Ms|Miss|Mx|Dr|Sir|Dame|Lord|Lady|Prof)\.?\s+/i, '')), 'LinkedIn: name only');
  } else if (d.k === 'co') {
    h = d.name; s = d.self ? 'This company · ' + d.num : d.prev ? 'Previous name of this company' + (d.prev ? ', until ' + fmtDate(d.prev) : '') : [d.role, d.num].filter(Boolean).join(' · ');
    a = cp(d.name, 'Copy name') + (d.num && !d.self && !d.prev ? B('open-co', 'Open in Prosper', `data-num="${esc(d.num)}"`) : '') + (d.num ? X(coUrl(d.num), 'Companies House', 'ch') : '');
  } else if (d.k === 'num') {
    h = d.num; s = d.self ? 'Company number of ' + d.name : (d.name || 'Company number');
    a = cp(d.num) + (!d.self ? B('open-co', 'Open in Prosper', `data-num="${esc(d.num)}"`) : '') + X(coUrl(d.num), 'Companies House', 'ch');
  } else if (d.k === 'addr') {
    const part = d.town || d.pc;
    h = d.t; s = d.town ? 'Town of the registered office' : d.pc ? 'Postcode of the registered office' : 'Registered office';
    a = cp(part ? d.t : d.addr, part ? 'Copy' : 'Copy address') + (part ? cp(d.addr, 'Copy full address') : '') + X(mapsUrl(d.town ? d.t + ', UK' : d.addr), 'Map', 'pl');
  } else if (d.k === 'sic') {
    h = 'SIC ' + d.code; s = d.desc || 'No description available';
    a = cp(d.code, 'Copy code') + (d.desc ? cp(d.desc, 'Copy description') : '');
  } else if (d.k === 'date') {
    h = d.t; s = (d.labels || []).join(' · ');
    a = cp(d.t) + cp(ddmmyyyy(d.iso), 'Copy ' + ddmmyyyy(d.iso));
  } else if (d.k === 'url') {
    h = hostOf(d.url); s = d.title && d.title !== h ? d.title : 'From the sources';
    a = cp(d.url, 'Copy link') + X(d.url, 'Open', 'ch');
  }
  return `<div class="eh"><b>${esc(h)}</b>${s ? `<small>${esc(s)}</small>` : ''}</div><div class="ea">${a}</div>`;
}
let entT = 0, entEl = null;
function showEnt(el) {
  clearTimeout(entT);
  const pop = sroot && sroot.querySelector('.epop'); if (!pop || !el.isConnected) return;
  if (entEl === el && pop.classList.contains('show')) return;
  let d; try { d = JSON.parse(el.dataset.e); } catch (e) { return; }
  entEl = el; pop.innerHTML = entPopHtml(d);
  pop.classList.add('show');
  const pr = $panel.getBoundingClientRect(), r = el.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  const left = Math.max(8, Math.min(r.left - pr.left, pr.width - w - 8));
  let top = r.bottom - pr.top + 6; if (top + h > pr.height - 8) top = Math.max(8, r.top - pr.top - h - 6);
  pop.style.left = Math.round(left) + 'px'; pop.style.top = Math.round(top) + 'px';
}
function hideEnt(now) {
  clearTimeout(entT);
  const go = () => { const pop = sroot && sroot.querySelector('.epop'); if (pop) pop.classList.remove('show'); entEl = null; };
  if (now) go(); else entT = setTimeout(go, 200);
}

/* ---------- Export ----------
   A compact snapshot ("card") of each company you open is kept with its saved AI record (same 200-company LRU),
   so "Export saved companies" works offline. Dates are exported as YYYY-MM-DD so spreadsheets and CRMs read them. */
function cardOf(f, ctx) {
  return { v: 1, at: Date.now(), name: f.display, number: f.number, status: f.statusLabel, statusDetail: f.statusDetail || '', type: f.type, created: f.created || '', ceased: f.ceased || '',
    address: f.address || '', addr: f.addrParts || {}, sic: f.sic.map((s) => ({ code: s.code, desc: s.desc || '' })), previousNames: f.previousNames.map((x) => ({ name: x.name, until: x.to || '' })),
    accountsNextDue: f.accounts.nextDue || '', accountsOverdue: !!f.accounts.overdue, csNextDue: f.cs.nextDue || '', quickCheck: verdictLabel(f.verdict), reasons: f.caution.concat(f.check),
    url: f.url, website: (ctx && ctx.domain) || '',
    officers: f.officers.map((o) => ({ name: o.name, first: o.first || '', middle: o.middle || '', last: o.last || '', role: o.role, appointed: o.appointed || '', corporate: !!o.corporate, regNumber: o.regNumber || '' })),
    pscs: f.pscs.map((p) => ({ name: p.name, first: p.first || '', middle: p.middle || '', last: p.last || '', kind: p.kind, control: p.control || '', notified: p.notified || '', regNumber: p.regNumber || '' })) };
}
const isoAt = (t) => (t ? new Date(t).toISOString() : '');
function expRec(card, rec) {
  const a = rec && rec.auto, w = rec && rec.web;
  return {
    company: (() => { const c = Object.assign({}, card, { website: card.website || (w && w.site) || '', linkedin: (rec && rec.li && rec.li.company) || card.linkedin || '', liPeople: (rec && rec.liPeople) || {} });
      const lu = (x) => { const v = c.liPeople[liKey(x)]; return v ? v.url : ''; };
      c.officers = (card.officers || []).map((o) => (o.corporate ? o : Object.assign({}, o, { linkedin: lu(o) }))); c.pscs = (card.pscs || []).map((p) => (p.kind === 'Individual' ? Object.assign({}, p, { linkedin: lu(p) }) : p)); return c; })(),
    summary: a ? { lines: a.summary, worthChecking: a.watch, openers: a.openers, generated: isoAt(a.at) } : null,
    expanded: w ? { website: w.site || '', what: w.what, signals: w.signals, talkingPoints: w.talking, sources: w.sources, generated: isoAt(w.at) } : null,
    chat: ((rec && rec.chat) || []).filter((t) => t.a && !t.pending && !t.err).map((t) => ({ question: t.q, answer: t.a, webSearch: !!t.web, sources: t.sources || [], at: isoAt(t.at) })),
  };
}
function savedRecs() {
  const out = [];
  for (const [n] of aiIdx()) { const r = (st.aiMem[n] && st.aiMem[n].card) ? st.aiMem[n] : readJSON(gv(aiKey(n), null)); if (r && r.card) out.push(r); }
  return out;
}
function curRec() {
  const ctx = st.ctx; if (!ctx || !ctx.company || ctx.kind) return null;
  const rec = ctx.ai || aiRec(ctx.company);
  if (!rec.card) rec.card = cardOf(ctx.company, ctx);
  return rec;
}
// People: individual officers, then individual PSCs who are not also officers.
function peopleOf(card, withCorporate) {
  const out = [], lip = card.liPeople || {}, lu = (x) => { const v = lip[liKey(x)]; return v ? v.url : ''; };
  for (const o of card.officers) if (withCorporate || !o.corporate) out.push({ name: o.name, first: o.first, middle: o.middle, last: o.last, role: o.role, date: o.appointed, type: o.corporate ? 'Corporate officer' : 'Officer', control: '', regNumber: o.regNumber, linkedin: o.corporate ? '' : lu(o) });
  for (const p of card.pscs) {
    const ind = p.kind === 'Individual'; if (!ind && !withCorporate) continue;
    const ex = out.find((x) => x.name.toLowerCase() === p.name.toLowerCase());
    if (ex) { ex.type += ' and PSC'; ex.control = p.control; continue; }
    out.push({ name: p.name, first: p.first, middle: p.middle, last: p.last, role: 'Person with significant control', date: p.notified, type: ind ? 'PSC' : 'Corporate PSC', control: p.control, regNumber: p.regNumber, linkedin: ind ? lu(p) : '' });
  }
  return out;
}
const street = (c) => [c.addr && c.addr.line1, c.addr && c.addr.line2].filter(Boolean).join(', ');
const domainOf = (w) => cleanDomain(String(w || ''));
const aiText = (r) => (r.summary ? r.summary.lines.join(' ') : '');
const csvCell = (v) => {
  v = v == null ? '' : String(v);
  if (/^[=+@]|^-[^\d]/.test(v)) v = "'" + v; // spreadsheet formula injection guard
  return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
};
const toCsv = (rows) => '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
const GENERIC = ['Company name', 'Company number', 'Company status', 'Company type', 'Incorporated', 'Registered office', 'Address line 1', 'Address line 2', 'Town', 'Region', 'Postcode', 'Country', 'SIC codes', 'Website', 'LinkedIn company page', 'Companies House link', 'Accounts next due', 'Quick check', 'Name', 'First name', 'Last name', 'LinkedIn profile', 'Type', 'Role', 'Appointed or notified', 'Control', 'AI summary'];
function genericRows(r) {
  const c = r.company, a = c.addr || {};
  const co = [c.name, c.number, c.status + (c.statusDetail ? ' - ' + c.statusDetail : ''), c.type, c.created, c.address, a.line1 || '', a.line2 || '', a.town || '', a.region || '', a.postcode || '', a.country || '',
    c.sic.map((s) => s.code + (s.desc ? ' ' + s.desc : '')).join('; '), c.website, c.linkedin || '', c.url, c.accountsNextDue, c.quickCheck + (c.reasons.length ? ' (' + c.reasons.join('; ') + ')' : '')];
  const ppl = peopleOf(c, true);
  if (!ppl.length) return [co.concat(['', '', '', '', '', '', '', '', aiText(r)])];
  return ppl.map((p) => co.concat([p.name, p.first, p.last, p.linkedin || '', p.type, p.role, p.date, p.control, aiText(r)]));
}
// CRM presets. Column headers are the documented import field labels:
// HubSpot (contacts + companies, one file): knowledge.hubspot.com/import-and-export/set-up-your-import-file and default properties.
// Salesforce (Data Import Wizard, "Accounts and Contacts"): standard Contact and Account field labels.
// Pipedrive (people + organizations): the column names in Pipedrive's sample import spreadsheet.
const CRM = {
  hubspot: { label: 'HubSpot', head: ['First Name', 'Last Name', 'Email', 'Job Title', 'Company Name', 'Company Domain Name', 'Website URL', 'Street Address', 'City', 'State/Region', 'Postal Code', 'Country/Region', 'LinkedIn company page', 'Description'],
    row: (r, p) => { const c = r.company, a = c.addr || {}; return [p.first, p.last, '', p.role, c.name, domainOf(c.website), c.website ? 'https://' + domainOf(c.website) : '', street(c), a.town || '', a.region || '', a.postcode || '', a.country || '', c.linkedin || '', crmDesc(r, p)]; } },
  salesforce: { label: 'Salesforce', head: ['First Name', 'Last Name', 'Title', 'Account Name', 'Website', 'Billing Street', 'Billing City', 'Billing State/Province', 'Billing Zip/Postal Code', 'Billing Country', 'SIC Code', 'Description'],
    row: (r, p) => { const c = r.company, a = c.addr || {}; return [p.first, p.last, p.role, c.name, c.website ? 'https://' + domainOf(c.website) : '', street(c), a.town || '', a.region || '', a.postcode || '', a.country || '', (c.sic[0] && c.sic[0].code) || '', crmDesc(r, p, true)]; } },
  pipedrive: { label: 'Pipedrive', head: ['Person - Name', 'Person - First name', 'Person - Last name', 'Organization - Name', 'Organization - Address'],
    row: (r, p) => { const c = r.company; return [p.name, p.first, p.last, c.name, c.address]; } },
};
// LinkedIn URLs go in Description where the CRM has no standard field for them (Salesforce company page; profiles everywhere).
function crmDesc(r, p, withCo) { const c = r.company; return [`Companies House ${c.number} (${c.status}): ${c.url}`, withCo && c.linkedin ? 'LinkedIn company page: ' + c.linkedin : '', p && p.linkedin ? 'LinkedIn profile: ' + p.linkedin : '', aiText(r)].filter(Boolean).join(' | '); }
function crmCsv(kind, recs) {
  const P = CRM[kind], rows = [P.head];
  for (const r of recs) { const ppl = peopleOf(r.company, false); if (ppl.length) for (const p of ppl) rows.push(P.row(r, p)); else rows.push(P.row(r, { name: '', first: '', last: '', role: '' })); }
  return toCsv(rows);
}
// vCard 3.0 (RFC 2426): CRLF lines, escaped text, folded at 75 octets.
const vEsc = (s) => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
function vFold(line) {
  const enc = new TextEncoder(); if (enc.encode(line).length <= 75) return line;
  const segs = []; let cur = '', n = 0, lim = 75;
  for (const ch of line) { const b = enc.encode(ch).length; if (n + b > lim) { segs.push(cur); cur = ''; n = 0; lim = 74; } cur += ch; n += b; }
  if (cur) segs.push(cur);
  return segs.join('\r\n ');
}
function vcards(recs) {
  const L = [];
  for (const r of recs) {
    const c = r.company, a = c.addr || {};
    for (const p of peopleOf(c, false)) {
      const first = p.first || p.name.split(' ')[0], last = p.last || p.name.split(' ').slice(-1)[0];
      const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${vEsc(last)};${vEsc(first)};${vEsc(p.middle || '')};;`, `FN:${vEsc([first, last].filter(Boolean).join(' ') || p.name)}`,
        `ORG:${vEsc(c.name)}`, `TITLE:${vEsc(p.role)}`,
        c.address ? `ADR;TYPE=WORK:;;${vEsc(street(c))};${vEsc(a.town || '')};${vEsc(a.region || '')};${vEsc(a.postcode || '')};${vEsc(a.country || '')}` : '',
        `NOTE:${vEsc(`${p.role} at ${c.name}${p.date ? ' since ' + p.date : ''}${p.control ? ' (' + p.control + ')' : ''}. Companies House ${c.number}: ${c.url}${c.linkedin ? '. LinkedIn company page: ' + c.linkedin : ''}`)}`,
        c.website ? `URL:${vEsc('https://' + domainOf(c.website))}` : `URL:${vEsc(c.url)}`,
        p.linkedin ? `X-SOCIALPROFILE;TYPE=linkedin:${p.linkedin}` : '', 'END:VCARD'].filter(Boolean);
      L.push(...lines.map(vFold));
    }
  }
  return L.length ? L.join('\r\n') + '\r\n' : '';
}
function mdProfile(r) {
  const c = r.company, L = [];
  L.push(`# ${c.name}`, '', `Companies House ${c.number} · ${c.status}${c.statusDetail ? ' (' + c.statusDetail + ')' : ''} · ${c.type}`, '');
  L.push(`- **Incorporated:** ${fmtDate(c.created)}${c.ceased ? ` · ceased ${fmtDate(c.ceased)}` : ''}`);
  if (c.address) L.push(`- **Registered office:** ${c.address}`);
  if (c.sic.length) L.push(`- **SIC:** ${c.sic.map((s) => s.code + (s.desc ? ' ' + s.desc : '')).join('; ')}`);
  if (c.previousNames.length) L.push(`- **Previous names:** ${c.previousNames.map((x) => x.name).join('; ')}`);
  if (c.website) L.push(`- **Website:** https://${domainOf(c.website)}`);
  if (c.linkedin) L.push(`- **LinkedIn:** ${c.linkedin}`);
  L.push(`- **Quick check:** ${c.quickCheck}${c.reasons.length ? ' (' + c.reasons.join('; ') + ')' : ''}`, `- **Companies House:** ${c.url}`);
  const off = c.officers; if (off.length) { L.push('', '## Officers'); for (const o of off) L.push(`- ${o.name}, ${o.role}${o.appointed ? ' (since ' + fmtDate(o.appointed) + ')' : ''}`); }
  if (c.pscs.length) { L.push('', '## People with significant control'); for (const p of c.pscs) L.push(`- ${p.name}${p.control ? ' (' + p.control + ')' : ''}`); }
  if (r.summary) { L.push('', '## Summary (AI, from Companies House data)'); for (const x of r.summary.lines) L.push(`- ${x}`); if (r.summary.worthChecking.length) { L.push('', '**Worth checking**'); for (const x of r.summary.worthChecking) L.push(`- ${x}`); } }
  if (r.expanded) { L.push('', `## ${r.expanded.website ? 'From ' + r.expanded.website + ' and the web' : 'From the web'} (AI, check before relying on it)`); for (const x of r.expanded.what) L.push(`- ${x}`); for (const x of r.expanded.signals) L.push(`- ${x.text}${x.date ? ' (' + x.date + ')' : ''}${x.url ? ' ' + x.url : ''}`); }
  return L.join('\n') + '\n';
}
const tsvCell = (v) => String(v == null ? '' : v).replace(/[\t\r\n]+/g, ' ');
const slugOf = (s) => shortCo(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'company';
function todayIso() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
// Returns { name, mime, text } for a download, or { copy } for the clipboard.
function exportPayload(fmt) {
  const all = fmt.startsWith('all-');
  const recs = all ? savedRecs().map((r) => expRec(r.card, r)) : (() => { const r = curRec(); return r ? [expRec(r.card, r)] : []; })();
  if (!recs.length) return null;
  const base = all ? `prosper-saved-companies-${todayIso()}` : `prosper-${slugOf(recs[0].company.name)}-${recs[0].company.number}`;
  const k = all ? fmt.slice(4) : fmt;
  if (k === 'csv') return { name: base + '.csv', mime: 'text/csv', text: toCsv([GENERIC].concat(...recs.map(genericRows))) };
  if (CRM[k]) return { name: `${base}-${k}.csv`, mime: 'text/csv', text: crmCsv(k, recs) };
  if (k === 'vcf') { const t = vcards(recs); return t ? { name: base + '.vcf', mime: 'text/vcard', text: t } : { empty: 'No people to export as vCards.' }; }
  if (k === 'json') return { name: base + '.json', mime: 'application/json', text: JSON.stringify(all ? { exported: new Date().toISOString(), source: 'Prosper', companies: recs } : Object.assign({ exported: new Date().toISOString(), source: 'Prosper' }, recs[0]), null, 2) + '\n' };
  if (k === 'tsv') return { copy: [GENERIC].concat(...recs.map(genericRows)).map((r) => r.map(tsvCell).join('\t')).join('\n') + '\n', msg: 'Table copied: paste into Sheets, Excel or Numbers' };
  if (k === 'md') return { copy: recs.map(mdProfile).join('\n---\n\n'), msg: 'Profile copied' };
  return null;
}
function doExport(fmt, el) {
  const p = exportPayload(fmt);
  toggleXMenu(false);
  if (!p) return showToast(fmt.startsWith('all-') ? 'No saved companies yet' : 'Open a company first');
  if (p.empty) return showToast(p.empty);
  if (p.copy != null) return copyText(p.copy).then(() => showToast(p.msg || 'Copied'));
  showToast(downloadText(p.name, p.mime, p.text) ? 'Downloaded ' + p.name : 'Download blocked on this page');
}
function xmenuHtml() {
  const ctx = st.ctx, has = !!(ctx && ctx.company && !ctx.kind), n = savedRecs().length;
  const it = (fmt, label, sub, dis) => `<button class="mi" role="menuitem" data-act="export" data-fmt="${fmt}"${dis ? ' disabled' : ''}><span class="n">${esc(label)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
  return `<h6>${has ? esc(shortCo(ctx.company.display)) : 'This company'}</h6>${has ? '' : '<div class="none">Open a company to export it.</div>'}
    ${it('csv', 'CSV', 'people and company', !has)}${it('hubspot', 'HubSpot CSV', 'import template', !has)}${it('salesforce', 'Salesforce CSV', 'import template', !has)}${it('pipedrive', 'Pipedrive CSV', 'import template', !has)}
    ${it('vcf', 'vCards', 'one per person, .vcf', !has)}${it('json', 'JSON', 'full record', !has)}${it('tsv', 'Copy as table', 'Sheets, Excel, Numbers', !has)}${it('md', 'Copy profile', 'Markdown for Notion or email', !has)}
    <h6>Saved companies (${n})</h6>${it('all-csv', 'CSV', '', !n)}${it('all-json', 'JSON', '', !n)}${it('all-vcf', 'vCards', '.vcf', !n)}`;
}
function toggleXMenu(force) {
  const m = sroot && sroot.querySelector('.xmenu'); if (!m) return;
  st.xmenu = force != null ? force : !st.xmenu;
  if (st.xmenu) { if (st.menu) toggleMenu(false); m.innerHTML = xmenuHtml(); }
  m.classList.toggle('show', !!st.xmenu);
  const b = root && root.querySelector('[data-act=xmenu]'); if (b) { b.classList.toggle('on', !!st.xmenu); b.setAttribute('aria-expanded', String(!!st.xmenu)); }
}

/* ---------- AI: automatic summary, Expand, per-company chat ---------- */
const busy = (n, k) => !!(st.aiBusy[n] && st.aiBusy[n][k]);
function setBusy(n, k, v) { st.aiBusy[n] = Object.assign({}, st.aiBusy[n], { [k]: v }); }
function setAiErr(n, k, e) { st.aiErr[n] = Object.assign({}, st.aiErr[n], { [k]: e }); }
function liveCtx(n) { const c = st.ctx; return c && c.company && !c.kind && c.company.number === n ? c : null; }
function aiBlock(ctx) {
  const n = ctx.company.number;
  const loading = busy(n, 'auto') || busy(n, 'web') || ctx.ai.chat.some((t) => t.pending);
  return blk('summary', 'Summary', { force: true, cls: 'brief ai' + (loading ? ' loading' : ''), icon: ICON.spark, body: `<div data-sec-body="summary">${aiHtml(ctx)}</div>` });
}
function aiHtml(ctx) {
  if (!claudeKey()) return `<div class="sub">Add an AI key in Settings to get an automatic summary and ask questions about this company.</div><div class="row mt6"><button class="btn sm" data-act="settings">Open settings</button></div>`;
  const nm = shortCo(ctx.company.display);
  return `<div data-ai="top">${aiTopHtml(ctx)}</div><div data-ai="note">${noteHtml(ctx)}</div>
    <div class="chat" data-ai="chat"><h5>Ask about ${esc(nm)}</h5><div data-ai="log">${chatLogHtml(ctx)}</div>
      <form class="chatbox" data-form="chat"><textarea class="chatin" rows="1" maxlength="500" placeholder="Ask a question about ${esc(nm)}" aria-label="Ask a question about ${esc(nm)}"></textarea><button class="send" type="submit" title="Ask (Enter)" aria-label="Ask">${ICON.send}</button></form>
      <div class="chips" data-ai="chips">${chipsHtml(ctx)}</div></div>`;
}
function errBox(title, e, act) {
  const needKey = e.code === 'cl-nokey' || e.code === 'cl-401';
  return `<div class="err tight mt6"><b>${esc(e.code === 'cl-nokey' ? 'AI key needed' : title)}</b><div>${esc(e.code === 'cl-nokey' ? 'Add an AI key in Settings.' : e.message || String(e))}</div></div>
    <div class="row">${needKey ? '<button class="btn sm pri" data-act="settings">Open settings</button>' : ''}<button class="btn sm" data-act="${act}">Try again</button></div>`;
}
// Sources: a small collapsed dropdown ("Sources (4)"), opened on demand
const srcDrop = (list) => list && list.length ? `<details class="srcd"><summary>Sources (${list.length})${ICON.chev}</summary><div class="src">${list.map((x) => `<a href="${esc(x.url)}" data-act="ext" data-url="${esc(x.url)}" title="${esc(x.url)}">${esc(x.title || x.url)}</a>`).join('')}</div></details>` : '';
function aiTopHtml(ctx) {
  const li = (x) => `<li>${linkify(x, ctx)}</li>`;
  const f = ctx.company, n = f.number, rec = ctx.ai, a = rec.auto, sig = coSig(f), er = st.aiErr[n] || {};
  let h = '';
  if (busy(n, 'auto') && !a) h += `<div class="aiwait" role="status"><span class="vh">Writing the summary</span><div class="skel w90"></div><div class="skel w75"></div><div class="skel w82"></div></div>`;
  else if (er.auto && !a) h += errBox('Summary failed', er.auto, 'ai-auto');
  else if (!a) h += `<button class="genbtn" data-act="ai-auto">${ICON.spark}<span>Write summary</span></button><div class="hint">From Companies House data only. Automatic summaries are off in Settings.</div>`;
  else {
    h += a.summary.map((x) => `<p>${linkify(x, ctx)}</p>`).join('');
    if (a.watch && a.watch.length) h += `<h5>Worth checking</h5><ul>${a.watch.map(li).join('')}</ul>`;
    if (a.openers && a.openers.length) h += `<h5>Openers</h5><ul>${a.openers.map(li).join('')}</ul>`;
    const upd = busy(n, 'auto');
    h += `<div class="meta"><span>Summary from Companies House data · ${upd ? 'updating...' : esc(fmtAgo(a.at))}</span>${!upd && a.sig !== sig ? '<span class="stale">· Companies House data has changed since</span>' : ''}${upd ? '' : '<button class="lnk" data-act="ai-refresh" title="Write it again from the latest Companies House data">Refresh</button>'}</div>`;
    if (er.auto && !upd) h += `<div class="sub mt4">${esc(er.auto.message || String(er.auto))}</div>`;
  }
  const w = rec.web;
  if (busy(n, 'web')) {
    const sp = st.aiStep[n] || {};
    const msg = sp.s === 'read' ? `Reading ${esc(sp.x || 'their website')}...` : sp.s === 'search' ? 'Searching the web...' : sp.s === 'find' ? 'Looking up their website...' : 'Finding their website...';
    h += `<div class="webpart"><div class="ldg" aria-live="polite">${ICON.globe}<span class="lt">${msg}</span></div><div class="xsteps"><span class="${sp.s === 'site' || sp.s === 'find' ? 'on' : 'done'}">Website</span><span class="${sp.s === 'read' ? 'on' : sp.s === 'search' ? 'done' : ''}">Pages</span><span class="${sp.s === 'search' ? 'on' : ''}">Web search</span></div><div class="skel w90"></div><div class="skel w75"></div><div class="skel w60"></div></div>`;
  } else if (w) {
    h += `<div class="webpart"><h5 class="wh">${ICON.globe}${w.site ? 'From ' + linkify(w.site, ctx) + ' and the web' : 'From the web'}</h5>${w.what.map((x) => `<p>${linkify(x, ctx)}</p>`).join('')}`;
    if (w.signals.length) h += `<h5>Recent signals</h5><ul>${w.signals.map((x) => `<li>${linkify(x.text, ctx)}${x.date ? ' <span class="sub">' + esc(x.date) + '</span>' : ''}${x.url ? ' ' + extA(x.url, 'source', 'lk-ch') : ''}</li>`).join('')}</ul>`;
    if (w.talking.length) h += `<h5>Talking points</h5><ul>${w.talking.map(li).join('')}</ul>`;
    h += srcDrop(w.sources);
    h += `<div class="meta"><span>${w.site ? 'Website and web search' : 'Web search'} · ${esc(fmtAgo(w.at))}${w.confidence === 'low' ? ' · low confidence' : ''}</span>${w.sig !== sig ? '<span class="stale">· Companies House data has changed since</span>' : ''}<button class="lnk" data-act="ai-web" title="Check their website and search the web again">Expand again</button></div></div>`;
  }
  if (er.web && !busy(n, 'web')) h += errBox('Expand failed', er.web, 'ai-web');
  if (!w && !busy(n, 'web')) h += `<button class="webbtn xbtn" data-act="ai-web" title="Checks the company's website (homepage plus About or Services pages) and searches the web for news and signals. Runs only when you press it.">${ICON.spark}<span>Expand</span><small>checks their website and searches the web</small></button>`;
  return h;
}
function chatLogHtml(ctx) {
  const rec = ctx.ai, sig = coSig(ctx.company);
  if (!rec.chat.length) return '';
  return rec.chat.map((t, i) => {
    let a;
    if (t.pending) a = `<div class="ua">${t.webPending || t.searching ? `<div class="ldg srch" aria-live="polite">${ICON.globe}<span class="lt">Searching the web${t.query ? ' for “' + esc(t.query.slice(0, 60)) + '”' : ''}...</span></div>` : t.slow ? `<div class="ldg" aria-live="polite">${ICON.spark}<span class="lt">Still working... this can include a quick web search</span></div>` : ''}<div class="skel w90"></div><div class="skel w60"></div></div>`;
    else if (t.err) a = `<div class="ua err2">${esc(t.err.code === 'cl-nokey' ? 'Add an AI key in Settings to ask questions.' : t.err.message || String(t.err))} <button class="lnk" data-act="chat-retry" data-i="${i}">Try again</button></div>`;
    else {
      a = `<div class="ua"><div class="at">${linkify(t.a, ctx)}</div>`
        + srcDrop(t.sources)
        + `<div class="meta"><span>${t.web ? 'Searched the web' : 'From Companies House data'} · ${esc(fmtAgo(t.at))}</span>${t.sig && t.sig !== sig ? '<span class="stale">· before the latest Companies House change</span>' : ''}<button class="lnk" data-act="cp" data-copy="${esc(t.q + '\n' + t.a)}">Copy</button></div>`
        + (t.needsWeb && !t.web ? `<button class="webbtn sm" data-act="chat-web" data-i="${i}">${ICON.globe}<span>Search the web for this</span></button>` : '')
        + '</div>';
    }
    return `<div class="turn" data-turn="${i}"><div class="uq">${esc(t.q)}</div>${a}</div>`;
  }).join('') + '<div class="row jsb clr"><span></span><button class="lnk" data-act="chat-clear">Clear chat</button></div>';
}
function chipsHtml(ctx) {
  const a = ctx.ai.auto;
  if (!settings.questions || !a || !Array.isArray(a.questions) || !a.questions.length) return '';
  const asked = new Set(ctx.ai.chat.map((t) => t.q));
  return a.questions.filter((q) => !asked.has(q)).slice(0, 3).map((q) => `<button class="qchip sug" data-act="ask" data-q="${esc(q)}">${esc(q)}</button>`).join('');
}
// Partial re-render: the chat box (and anything typed in it) is left alone.
function rerenderAi(n, scrollTurn) {
  const ctx = liveCtx(n); if (!ctx) return;
  const box = $aib.querySelector('[data-sec-body=summary]'); if (!box) return;
  const top = box.querySelector('[data-ai=top]'), log = box.querySelector('[data-ai=log]'), chips = box.querySelector('[data-ai=chips]');
  if (top && log && chips) { top.innerHTML = aiTopHtml(ctx); log.innerHTML = chatLogHtml(ctx); chips.innerHTML = chipsHtml(ctx); } else box.innerHTML = aiHtml(ctx);
  const sec = box.closest('.blk');
  if (sec) sec.classList.toggle('loading', busy(n, 'auto') || busy(n, 'web') || ctx.ai.chat.some((t) => t.pending));
  if (scrollTurn != null) { const el = box.querySelector(`.turn[data-turn="${scrollTurn}"]`); if (el) el.scrollIntoView({ block: 'nearest', behavior: reducedMotion() || !settings.animations ? 'auto' : 'smooth' }); }
}
function maybeAuto(ctx) {
  const f = ctx.company, a = ctx.ai.auto;
  // Saved and current: shown instantly, no API call. Summaries saved before build 3 that lean on "Probably" are re-written once.
  const hedged = a && /\bprobably\b/i.test([].concat(a.summary || [], a.watch || [], a.openers || []).join(' '));
  if (a && a.sig === coSig(f) && !hedged) return;
  if (!settings.autoSummary || !claudeKey()) return;
  doAuto(ctx);
}
async function doAuto(ctx) {
  const f = ctx.company, n = f.number, rec = ctx.ai;
  if (busy(n, 'auto')) return;
  setBusy(n, 'auto', true); setAiErr(n, 'auto', null); rerenderAi(n);
  try { rec.auto = await runAuto(f, ctx); aiSave(rec); } catch (e) { setAiErr(n, 'auto', e); }
  setBusy(n, 'auto', false); rerenderAi(n);
}
async function doWeb(ctx) {
  const f = ctx.company, n = f.number, rec = ctx.ai;
  if (busy(n, 'web')) return;
  const step = (s, x) => { st.aiStep[n] = { s, x }; rerenderAi(n); };
  st.aiStep[n] = { s: 'site' }; setBusy(n, 'web', true); setAiErr(n, 'web', null); rerenderAi(n);
  try { rec.web = await runExpand(f, ctx, rec, step); if (rec.card && rec.web.site && !rec.card.website) rec.card.website = rec.web.site; aiSave(rec); } catch (e) { setAiErr(n, 'web', e); }
  delete st.aiStep[n]; setBusy(n, 'web', false); rerenderAi(n);
}
function submitChat(ta) {
  const ctx = st.ctx; if (!ta || !ctx || !ctx.company || ctx.kind) return;
  const q = ta.value.trim(); if (!q) return;
  ta.value = ''; ta.style.height = '';
  sendChat(ctx, q);
}
// New question (i == null), or re-ask turn i with web search.
async function sendChat(ctx, q, i) {
  const f = ctx.company, n = f.number, rec = ctx.ai;
  let turn, idx;
  if (i != null) { turn = rec.chat[i]; if (!turn || turn.pending) return; idx = i; Object.assign(turn, { pending: true, webPending: true, err: null }); }
  else { q = String(q || '').trim().slice(0, 500); if (!q) return; turn = { q, pending: true, at: Date.now() }; rec.chat.push(turn); idx = rec.chat.length - 1; }
  rerenderAi(n, idx);
  // "Searching the web..." appears as soon as the stream shows a search starting; if the manager gives no progress
  // events, a neutral "still working" line appears after a few seconds instead.
  const slowT = setTimeout(() => { if (turn.pending && !turn.searching) { turn.slow = true; rerenderAi(n); } }, 2500);
  const onProgress = (m) => {
    const s = (m.content || []).filter((b) => b && b.type === 'server_tool_use'); if (!s.length) return;
    const last = s[s.length - 1];
    const qy = (last.input && last.input.query) || ((/"query"\s*:\s*"([^"]*)/.exec(last._pj || '') || [])[1]) || '';
    if (!turn.searching || qy !== turn.query) { turn.searching = true; turn.query = qy; rerenderAi(n); }
  };
  try { Object.assign(turn, await askChat(f, ctx, rec, turn.q, i != null, idx, onProgress), { pending: false, webPending: false, err: null }); aiSave(rec); } catch (e) { Object.assign(turn, { pending: false, webPending: false, err: e }); }
  clearTimeout(slowT); turn.searching = false; turn.slow = false; turn.query = '';
  rerenderAi(n, idx);
}

/* ---------- officer name search (person mode) ---------- */
function renderPerson(ctx) {
  const list = ctx.officers || [];
  if (!list.length) {
    setBody(`${backBar()}<div class="card state"><b>No officers found</b>No Companies House officers match "${esc(ctx.query)}".<br><button class="btn" data-act="as-company">Search as company</button></div>${linksSection(ctx)}`, true);
    wireFavicons();
    return;
  }
  setBody(`${backBar()}<div class="card">${ctx.fromName ? `<div class="alt mb8">Showing people. Did you mean a company? <button class="lnk" data-act="as-company">Search companies</button></div>` : ''}<div class="sub mb8"><b>Officers matching "${esc(ctx.query)}"</b> · ${list.length}</div>
    ${list.map((o, i) => { const nm = officerName(o.name.replace(/^(.*) ([A-Z'\-]+)$/, '$2, $1')) || o.name; return `<div class="off" data-off="${i}"><div class="on"><b>${o.link ? personRef({ name: nm, link: o.link }) : esc(nm)}</b><span class="sub">${o.count != null ? o.count + ' appt' + (o.count === 1 ? '' : 's') : ''}</span></div>
      <div class="sub">${o.dob ? 'Born ' + esc(o.dob) + ' · ' : ''}${esc(o.address || '')}</div><div class="ap"><button class="btn sm mt5" data-act="appts" data-i="${i}">Show appointments</button></div></div>`; }).join('')}
    <div class="hint">Officer matches are by name only; check date of birth and address.</div></div>${linksSection(ctx)}`, true);
  wireFavicons();
}
async function expandOfficer(ctx, i, req) {
  const o = ctx.officers && ctx.officers[i]; if (!o || !o.link) return;
  const slot = () => $body.querySelector(`[data-off="${i}"] .ap`);
  if (slot()) slot().innerHTML = '<div class="sub mt4"><span class="spin"></span> Loading appointments...</div>';
  try {
    const appts = await loadAppointments(o.link);
    if (req != null && req !== st.req) return; if (!slot()) return;
    slot().innerHTML = `<ul class="appt">${appts.slice(0, 15).map((a) => `<li><span>${companyRef(a.number, a.company)}</span><span class="m">${esc(a.role)} · ${a.resigned ? 'resigned ' + esc(fmtDate(a.resigned)) : esc(label('company_status', a.status) || '')}</span></li>`).join('')}</ul>${appts.length > 15 ? `<div class="hint">+${appts.length - 15} more</div>` : ''}`;
  } catch (e) { if (slot()) slot().innerHTML = `<div class="sub">Could not load appointments (${esc(e.code || e.message)}).</div>`; }
}


/* ---------- keyboard shortcuts ---------- */
/* Esc peels one layer at a time: recording > cheat sheet > link/share menu > pins menu > filings drawer > panel. */

/* ---------- pinned & recent (one small header menu; nothing persistent in the panel) ---------- */
const listGet = (k) => { const v = readJSON(gv(k, null)); return Array.isArray(v) ? v : []; };

/* ---------- settings ---------- */

function keyHelp(kind) {
  const ki = keyInfo(kind);
  if (ki.source === 'none') return kind === 'ch' ? 'Free from developer.company-information.service.gov.uk (REST key). Add ' + esc(location.origin) + ' under the key\'s JavaScript domains so this page can use it.' : 'Optional. From console.anthropic.com.';
  const looks = kind === 'ch' ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ki.key) : /^sk-ant-/.test(ki.key);
  return `${ki.source === 'built-in' ? 'Using the built-in key' : 'Key saved'} (${ki.len} chars${ki.head ? ', starts "' + esc(ki.head) + '"' : ''})${looks ? '' : ' <span class="warnk">does not look like a ' + (kind === 'ch' ? 'Companies House REST key' : 'Claude key') + '</span>'}.`;
}
/* Toggle rows. Each entry: [settings key, label, help]. Persisted immediately on change. */
const TOGGLES = {
  ai: [['autoSummary', 'Automatic summary', 'Written from the Companies House data as soon as a company is confirmed. Takes a few seconds and does not search the web.'],
    ['chatWeb', 'Chat can search the web', 'When a question needs more than Companies House data (a finance director, what they sell, recent news), the chat runs up to 2 web searches and shows its sources. Off: it offers a button instead.'],
    ['questions', 'Suggested questions', 'Two or three suggested questions under the chat box. They come from the same AI call as the summary, so they cost nothing extra.']],
  behaviour: [
    ['background', 'Open links in background tabs', 'Keeps you on the current page.'],
    ['inInputs', 'Show the pill in text fields', 'Also show the Prosper pill when you highlight text inside input boxes and text areas (for example a CRM field or an email you are writing). Off by default so selecting text while you type stays quiet.'],
  ],
  interactive: [
    ['quickRow', 'Quick-link row under the company header', 'LinkedIn, Google, Companies House, Maps, Endole. Off: a Quick links card at the bottom instead.'],
    ['qlHover', 'Open link menus on hover', 'Menus always open on click (chevron) and from the keyboard too.'],
    ['personLinks', 'Link icons on each person', 'LinkedIn, Google and Companies House icons on officer and PSC rows and in the person view.'],
    ['chLinks', 'Companies House links', 'Section titles open the matching Companies House page.'],
    ['peopleInPanel', 'People open in the panel', 'Off: names go straight to the Companies House officer page.'],
    ['addrMaps', 'Addresses open Google Maps', 'Registered office links to a Maps search.'],
    ['inlineMap', 'Map open by default', 'Shows the embedded Google map under the registered office address straight away. The pin next to the address shows or hides it, and Prosper remembers your last choice here. Some sites block it; a link is shown instead.'],
    ['colorLinks', 'Colour-coded links', 'Blue Companies House, purple people, teal places.'],
  ],
  extras: [
    ['otherRoles', 'Other directorships at a glance', 'Counts each officer\'s other active roles (loaded when Officers is open).'],
    ['parentLinks', 'Parent company links', 'Corporate PSCs and officers open that company in the panel.'],
    ['similar', 'Similar companies nearby', 'Same SIC code in the same postcode area. Loaded in the background after a lookup (one or two Companies House calls); Load more adds 10 at a time.'],
    ['logos', 'Company logos', 'Shows a small logo only when the company\'s own website is verified (it shows their Companies House number, or their exact registered name and office postcode). Otherwise no logo.'],
    ['pinsMenu', 'Pinned and recent menu', 'Clock button in the header.'],
    ['clickCopy', 'Click a value to copy it', 'Numbers, dates, SIC codes, names.'],
  ],
  appearance: [
    ['animations', 'Animations', 'Subtle motion. Always off when your system asks for reduced motion.'],
  ],
};
const tgl = (rows) => rows.map(([k, l, help]) => `<label class="tg"><span>${esc(l)}<small>${esc(help)}</small></span><input type="checkbox" data-set="${k}" ${settings[k] ? 'checked' : ''}></label>`).join('');
const seg = (name, opts, cur) => `<div class="seg">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" data-seg="${name}" value="${v}" ${cur === v ? 'checked' : ''}>${esc(l)}</label>`).join('')}</div>`;
function renderSettings() {
  const ci = keyInfo('ch'), li = keyInfo('claude');
  const hasChSaved = ci.source === 'saved in settings', hasClSaved = li.source === 'saved in settings';
  setBody(`<div class="set">
    <div class="top"><h4>Settings</h4><button class="btn sm" data-act="back">${ICON.back}Back</button></div>
    <div class="grp" data-grp="keys"><div class="gh">Keys</div>
      <label class="f" for="p-ch">Companies House API key</label>
      <input id="p-ch" type="password" autocomplete="off" spellcheck="false" placeholder="${ci.key ? 'Key in use. Paste a new key to replace' : 'Paste your REST API key'}">
      <div class="help">${keyHelp('ch')} Stored only in this browser (localStorage).</div>
      <label class="f" for="p-cl">Anthropic (Claude) API key</label>
      <input id="p-cl" type="password" autocomplete="off" spellcheck="false" placeholder="${li.key ? 'Key in use. Paste a new key to replace' : 'sk-ant-... (only needed for AI summaries)'}">
      <div class="help">${keyHelp('claude')} Stored only in this browser (localStorage).</div>
      <div class="row mt10"><button class="btn pri sm" data-act="save">Save keys</button>${hasChSaved ? '<button class="btn sm" data-act="forget-ch">Remove CH key</button>' : ''}${hasClSaved ? '<button class="btn sm" data-act="forget-cl">Remove Claude key</button>' : ''}<span class="saved" hidden>Saved</span></div>
    </div>
    <div class="grp" data-grp="ai"><div class="gh">AI</div>
      <div class="help">The summary uses Companies House data only. Chat answers from that data and searches the web only when a question needs it. Expand checks the company's website and searches the web when you press it. Everything is saved per company, so going back to a company is instant.</div>
      <label class="f" for="p-model">Model for Expand and chat</label>
      <select id="p-model" data-set="model">${Object.keys(MODELS).map((m) => `<option value="${m}" ${settings.model === m ? 'selected' : ''}>${esc(MODELS[m].label)}</option>`).join('')}</select>
      <div class="help">The automatic summary always uses Claude Haiku.</div>
      ${tgl(TOGGLES.ai)}
    </div>
    <div class="grp" data-grp="interactive"><div class="gh">Interactive features</div>
      ${tgl(TOGGLES.interactive)}
      <label class="f">Filings open</label>
      ${seg('filingOpen', [['viewer', 'In viewer'], ['tab', 'PDF in new tab'], ['history', 'Filing history']], settings.filingOpen)}
      <div class="legend"><div><span class="sw ch"></span>Companies House: companies, filings, CH pages</div><div><span class="sw person"></span>People: officers and PSCs</div><div><span class="sw place"></span>Places: addresses and maps</div>
        <div class="sub">${ICON.ext} opens a new tab · no arrow opens here in Prosper</div></div>
    </div>
    <div class="grp" data-grp="extras"><div class="gh">Extras</div>${tgl(TOGGLES.extras.filter((r) => r[0] !== 'pinsMenu'))}</div>
    <div class="grp" data-grp="sections"><div class="gh">Sections open by default</div>
      <label class="tg cmp dis"><span>Overview<small>always shown, part of the top card</small></span><input type="checkbox" checked disabled></label>
      ${SECTIONS.map(([id, l]) => `<label class="tg cmp"><span>${esc(l)}</span><input type="checkbox" data-secdef="${id}" ${settings.secOpen[id] ? 'checked' : ''}></label>`).join('')}
      <div class="gh">When a lookup opens</div>
      ${tgl([['autoOpenProblems', 'Open sections that need attention', 'Filing deadlines when something is overdue; Charges & insolvency when there are outstanding charges or insolvency.'],
        ['rememberSections', 'Remember what I open and close', 'Off: every lookup starts from the defaults above. On: your last choice for each section wins.']])}
      <div class="row mt6"><button class="btn sm" data-act="reset-sections">Forget remembered sections</button></div></div>
    <div class="grp" data-grp="appearance"><div class="gh">Appearance</div>${tgl(TOGGLES.appearance)}</div>
    ${dataGroupHtml()}
    <div class="grp" data-grp="data"><div class="gh">Diagnostics and data</div>
      <div class="row mt6"><button class="btn sm" data-act="diag">Run diagnostics</button><button class="btn sm" data-act="clear-cache">Clear cache</button><button class="btn sm" data-act="clear-ai">Clear saved summaries</button></div>
      <div class="diagbox">${diagHtml()}</div>
      <div class="help mt10">Companies House data is cached for 10 minutes. Saved companies (for summaries, chats and Export): <span class="aicount">${aiIdx().length}</span> (the most recent ${AI_KEEP} are kept). The export menu is the download button at the top of the sidebar.</div>
    </div>
  </div>`, false, true);
  $body.scrollTop = 0;
}
function onChange(e) {
  if (st.view !== 'settings') return;
  const t = e.target; if (!t || !t.dataset) return;
  if (t.dataset.secdef) settings.secOpen = Object.assign({}, settings.secOpen, { [t.dataset.secdef]: t.checked });
  else if (t.dataset.set) settings[t.dataset.set] = t.type === 'checkbox' ? t.checked : t.value;
  else if (t.dataset.seg) settings[t.dataset.seg] = t.value;
  else return;
  saveSettings(); applySettingsLive();
  showToast('Saved');
}
function applySettingsLive() { applyRootClasses(); paintSide(); }

/* ---------- diagnostics ---------- */

function browserInfo() { const ua = navigator.userAgent; const m = /(Firefox|Edg|OPR|Chrome|Safari)\/([\d.]+)/.exec(ua); return m ? `${m[1] === 'Edg' ? 'Edge' : m[1]} ${m[2].split('.')[0]}` : ua.slice(0, 40); }
function diagHtml() {
  const d = st.diag; if (!d) return '';
  if (d.running) return '<div class="diag"><div class="dr"><span class="st info">...</span><div><span class="spin"></span> Running checks...</div></div></div>';
  return `<div class="diag">${d.rows.map((r) => `<div class="dr"><span class="st ${r.state}">${r.state === 'pass' ? 'PASS' : r.state === 'fail' ? 'FAIL' : 'INFO'}</span><div><b>${esc(r.name)}</b><div class="dd">${esc(r.detail)}</div></div></div>`).join('')}</div>
    <div class="row mt6"><button class="btn sm" data-act="diag-copy">${ICON.copy}Copy report</button><span class="hint m0">No keys are included in the report.</span></div>`;
}
function rerenderDiag() { const el = $body.querySelector('.diagbox'); if (el) el.innerHTML = diagHtml(); }
function diagReport() {
  const d = st.diag; if (!d || !d.rows) return '';
  return ['Prosper diagnostics ' + new Date(d.at).toISOString()].concat(d.rows.map((r) => `[${r.state.toUpperCase()}] ${r.name}: ${r.detail}`)).join('\n');
}
function restoreMain() { renderCtx(st.ctx); }
function saveKeys() {
  const q = (s) => $body.querySelector(s);
  const chRaw = q('#p-ch').value, clRaw = q('#p-cl').value;
  const chv = cleanKey(chRaw, 'ch'), clv = cleanKey(clRaw, 'claude');
  const fixed = (chRaw.trim() && chv !== chRaw.trim()) || (clRaw.trim() && clv !== clRaw.trim());
  if (chv) { sv(K.chKey, chv); chAuthOk = null; }
  if (clv) sv(K.claudeKey, clv);
  saveSettings();
  renderSettings();
  const s = $body.querySelector('.saved'); if (s) s.hidden = false;
  showToast(fixed ? 'Saved (removed stray characters from the key)' : 'Settings saved');
}

/* ---------- actions ---------- */

function onClick(e) {
  if (st.xmenu && !e.target.closest('.xmenu') && !e.target.closest('[data-act=xmenu]')) toggleXMenu(false);
  if (!e.target.closest('.epop') && !e.target.closest('.ent')) hideEnt(true);
  if (!e.target.closest('.qb')) closeQMenus();
  if (!e.target.closest('.shwrap')) closeShare();
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, ctx = st.ctx;
  const f = ctx && ctx.company;
  switch (act) {
    case 'xmenu': toggleXMenu(); break;
    case 'data-export': exportData(el); break;
    case 'data-import': { const inp = $body.querySelector('.impf'); if (inp) inp.click(); } break;
    case 'li-x': { const li = curLi(); if (li) { st.liDismissed.add(li.key); liPaint(); } } break;
    case 'li-save': liSave(el.dataset.k, el.dataset.n); break;
    case 'li-osearch': liOfficerSearch(); break;
    case 'note-open': if (ctx && f) { st.note[f.number] = Object.assign(st.note[f.number] || {}, { open: true }); const c0 = (ctx.ai.notes || {}); const T = noteTargets(ctx); const to = st.note[f.number].to != null ? st.note[f.number].to : (T[0] && ctx.liPerson ? T[0].k : '_'); if (!c0[to]) doNote(ctx); else rerenderNote(f.number); } break;
    case 'note-close': if (f) { st.note[f.number] = Object.assign(st.note[f.number] || {}, { open: false }); rerenderNote(f.number); } break;
    case 'note-kind': if (f) { st.note[f.number] = Object.assign(st.note[f.number] || {}, { kind: el.dataset.kind }); rerenderNote(f.number); } break;
    case 'note-regen': if (ctx && f) doNote(ctx); break;
    case 'note-copy': { const ta = el.closest('.notebox').querySelector('.nta'); if (ta) copyFrom(el, ta.value, 'Copied'); } break;
    case 'export': if (!el.disabled) doExport(el.dataset.fmt, el); break;
    case 'settings': toggleSettings(); break;
    case 'back': toggleSettings(false); break;
    case 'save': saveKeys(); break;
    case 'clear-cache': clearCache(); ENUMS = null; FHD = null; dv(K.fhd); showToast('Cache cleared'); break;
    case 'reset-sections': secState = {}; saveSecState(); showToast('Section state reset'); break;
    case 'diag': runDiagnostics().catch((er) => { warn('diagnostics crashed', er); st.diag = { rows: [{ name: 'Diagnostics', state: 'fail', detail: String((er && er.message) || er) }], at: Date.now() }; rerenderDiag(); }); break;
    case 'diag-open': toggleSettings(true); runDiagnostics().catch((er) => warn('diagnostics crashed', er)); break;
    case 'diag-copy': copyFrom(el, diagReport(), 'Diagnostics copied'); break;
    case 'forget-ch': dv(K.chKey); renderSettings(); showToast('Companies House key removed'); break;
    case 'forget-cl': dv(K.claudeKey); renderSettings(); showToast('Claude key removed'); break;
    case 'retry': if (ctx && ctx.det) lookup(ctx.det.raw, $mode.value); break;
    case 'as-person': if (ctx) lookup(ctx.det.personName || (ctx.det.domain ? ctx.raw : ctx.query), 'person', true); break;
    case 'as-company': if (ctx) lookup(ctx.raw, 'company', true); break;
    case 'pick-dym': if (ctx) {
      e.preventDefault(); pushNav();
      const nc = st.ctx = { det: ctx.det, raw: ctx.raw, query: ctx.query, domain: ctx.domain, company: null, candidates: ctx.candidates, mode: ctx.mode, fromDym: true };
      const req = ++st.req; showCompany(nc, el.dataset.num, req).catch((er) => req === st.req && renderError(er));
    } break;
    case 'pick': if (ctx) { e.preventDefault(); const req = ++st.req; showCompany(ctx, el.dataset.num, req).catch((er) => req === st.req && renderError(er)); } break;
    case 'open-co': e.preventDefault(); openCompanyHere(el.dataset.num); break;
    case 'person': e.preventDefault(); openPerson(el.dataset.link, el.dataset.name); break;
    case 'person-search': e.preventDefault(); setView('main'); lookup(el.dataset.name, 'person', true); break;
    case 'nav-back': navBack(); break;
    case 'tog': toggleBlock(el.closest('.blk')); break;
    case 'ext': e.preventDefault(); e.stopPropagation(); openTab(el.dataset.url || el.getAttribute('href')); closeQMenus(); if (el.closest('.shm')) { st.lastShare = { via: el.dataset.share, url: el.dataset.url }; closeShare(); } break;
    case 'cp': e.preventDefault(); e.stopPropagation(); copyFrom(el.closest('.shm') ? null : el, el.dataset.copy, el.closest('.shm') ? 'Link copied' : undefined); if (el.closest('.shm')) { st.lastShare = { via: 'copy' }; closeShare(); } break;
    case 'roles': if (ctx && ctx.rolesOpen) { const l = el.dataset.link; ctx.rolesOpen[l] = !ctx.rolesOpen[l]; const o = f.officers.find((x) => x.link === l); if (o) refreshRoles(ctx, o); } break;
    case 'similar-more': if (ctx && ctx.similar) loadMoreSimilar(ctx); break;
    case 'map-toggle': if (ctx && f) toggleMap(el); break;
    case 'filing': onFilingRow(+el.dataset.i); break;
    case 'filings-all': openFilings(0); break;
    case 'fv-prev': fvStep(-1); break;
    case 'fv-next': fvStep(1); break;
    case 'fv-pick': fvSelect(+el.dataset.i); break;
    case 'fv-cat': if (st.fv) { const cat = el.dataset.cat; st.fv.cat = cat; renderFvList(); const c = $drawer.querySelector('.dwr.cur') || $drawer.querySelector('.dwr'); if (c) c.scrollIntoView({ block: 'nearest' }); const nb = $drawer.querySelector(`.dw-cats [data-cat="${cat}"]`); if (nb) nb.focus({ preventScroll: true }); } break;
    case 'fv-more': loadMoreFilings(); break;
    case 'fv-close': closeDrawer(); { const b = $body.querySelector('[data-act=filings-all]'); if (b) b.focus({ preventScroll: true }); } break;
    case 'f-dl': docDownload(el); break;
    case 'f-share': docShare(el); break;
    case 'appts': if (ctx) expandOfficer(ctx, +el.dataset.i, st.req); break;
    case 'link': if (ctx) openTab(linkFor(el.dataset.id, ctx)); break;
    case 'link-all': openAll(); break;
    case 'copy-note': copyNote(el); break;
    case 'ai-auto': case 'ai-refresh': if (f && !ctx.kind) doAuto(ctx); break;
    case 'ai-web': if (f && !ctx.kind) doWeb(ctx); break;
    case 'chat-web': if (f && !ctx.kind) sendChat(ctx, null, +el.dataset.i); break;
    case 'chat-retry': if (f && !ctx.kind) { const t = ctx.ai.chat[+el.dataset.i]; if (t) { ctx.ai.chat.splice(+el.dataset.i, 1); sendChat(ctx, t.q); } } break;
    case 'chat-clear': if (f && !ctx.kind) { ctx.ai.chat = []; aiSave(ctx.ai); rerenderAi(f.number); showToast('Chat cleared'); } break;
    case 'clear-ai': { aiClearAll(); const c = $body.querySelector('.aicount'); if (c) c.textContent = '0'; showToast('Saved summaries cleared'); } break;
    case 'ql': if (ctx) openTab(linkFor(el.dataset.id, ctx)); break;
    case 'qmenu': openQMenu(el.closest('.qb'), e.detail === 0); break;
    case 'ask': if (f && !ctx.kind) sendChat(ctx, el.dataset.q); break;
    case 'share-mail': closeShare(); st.lastShare = { via: 'email', url: el.dataset.url }; break; // default action opens the mail client
    case 'share-slack': e.preventDefault(); copyFrom(null, el.dataset.copy, 'Copied for Slack: paste it into a message'); closeShare(); st.lastShare = { via: 'slack' }; break;
    case 'menu-open': setView('main'); lookup(el.dataset.num, 'auto'); break;
    case 'pin': if (f && !ctx.kind) { togglePin(f); showToast(listGet(K.pins).some((x) => x.n === f.number) ? 'Pinned' : 'Unpinned'); } break;
  }
}
function copyNote(el) { const ctx = st.ctx; if (!ctx || !ctx.company || ctx.kind) return; copyFrom(el, crmNote(ctx.company, ctx.ai), 'Quick note copied'); }


/* ------------------------------------------------------------------ */


/* ======================================================================================================
   Web app layer: replaces the userscript's page-hosted parts (pill, edge tab, LinkedIn tab, hotkeys,
   userscript-manager downloads and favicon/logo byte fetches) with desktop-page equivalents.
   ====================================================================================================== */

/* ---------- panel: always open, three columns ---------- */
function openEmpty() { setView('main'); if (!st.ctx) { $input.value = ''; renderEmpty(); } setTimeout(() => { $input.focus(); $input.select(); }, 30); }

/* setBody: the centre column. The AI block lives in the right-hand panel; paintAi() fills it. */
function setBody(html, enter, keepAi) {
  $body.innerHTML = html;
  if (enter) { $body.classList.add('enter'); clearTimeout(setBody.t); setBody.t = setTimeout(() => $body.classList.remove('enter'), 700); }
  if (!keepAi) paintAi(null);
  liPaint(); paintSide();
}
function paintAi(ctx) {
  if (!$aip) return;
  if (!ctx || !ctx.company || ctx.kind) {
    $aip.innerHTML = '<div class="ph">AI summary, Expand and chat appear here when a company is open.</div>';
    return;
  }
  $aip.innerHTML = aiBlock(ctx);
}
function renderEmpty() {
  setBody(`<div class="card state"><b>Look someone up</b>Type a company name, work email, website, Companies House number, person or a LinkedIn link in the search box and press Enter.
    ${!chKey() ? '<div><button class="btn pri" data-act="settings">Add Companies House key</button></div>' : ''}</div>`, true);
}

/* ---------- LinkedIn: only links pasted into the search box (the app never opens or reads LinkedIn) ---------- */
function curLi() { return (st.ctx && st.ctx.det && st.ctx.det.li) || null; }
function liPaint() {
  const li = curLi(), bar = sroot && sroot.querySelector('.libar'); if (!bar) return;
  const r = li && st.liRes && st.liRes.key === li.key ? st.liRes : null;
  const off = !li || !r || st.liDismissed.has(li.key);
  bar.hidden = off;
  if (off) { bar.innerHTML = ''; return; }
  bar.innerHTML = `<div class="lq"><span class="lt">${li.kind === 'company' ? 'LinkedIn company page' : 'LinkedIn profile'}: <b>${esc(li.name)}</b> <span class="sub">(from the pasted link)</span></span>`
    + `<button class="ib lx" data-act="li-x" title="Hide" aria-label="Hide">${ICON.x}</button></div>`
    + (r.html ? `<div class="lres">${r.html}</div>` : '');
}

/* ---------- sidebar: pinned and recent (the extension's clock menu, always shown) ---------- */
function toggleMenu() { st.menu = false; }
function sideHtml() {
  const pins = listGet(K.pins), recent = listGet(K.recent).filter((x) => !pins.some((p) => p.n === x.n)).slice(0, 8);
  const cur = st.ctx && st.ctx.company && !st.ctx.kind ? st.ctx.company : null;
  const isPinned = cur && pins.some((x) => x.n === cur.number);
  const item = (x, pinned) => `<button class="mi${cur && cur.number === x.n ? ' cur' : ''}" data-act="menu-open" data-num="${esc(x.n)}">${pinned ? ICON.pinf : ICON.clock}<span class="n">${esc(x.name)}</span><small>${esc(x.n)}</small></button>`;
  return `${cur ? `<button class="mi pinb" data-act="pin">${isPinned ? ICON.pinf : ICON.pin}<span class="n">${isPinned ? 'Unpin' : 'Pin'} ${esc(cur.display)}</span></button>` : ''}
    <h6>Pinned</h6>${pins.length ? pins.map((x) => item(x, true)).join('') : '<div class="none">Nothing pinned yet.</div>'}
    <h6>Recent</h6>${recent.length ? recent.map((x) => item(x, false)).join('') : '<div class="none">No recent companies.</div>'}`;
}
function paintSide() {
  if (!$side) return;
  const l = $side.querySelector('.slist'); if (!l) return;
  const sc = l.scrollTop; l.innerHTML = sideHtml(); l.scrollTop = sc;
}
function addRecent(f) {
  const r = listGet(K.recent).filter((x) => x.n !== f.number);
  r.unshift({ n: f.number, name: f.display, t: Date.now() });
  sv(K.recent, JSON.stringify(r.slice(0, 10)));
  paintSide();
}
function togglePin(f) {
  let p = listGet(K.pins);
  if (p.some((x) => x.n === f.number)) p = p.filter((x) => x.n !== f.number);
  else p.unshift({ n: f.number, name: f.display, t: Date.now() });
  sv(K.pins, JSON.stringify(p.slice(0, 20)));
  paintSide();
}

/* ---------- favicons and logos: <img> (a web page cannot read another site's image bytes) ---------- */
const favMem = new Map(); // domain -> Promise<boolean> (the s2 icon loaded at a usable size)
function favOk(dom) {
  if (favMem.has(dom)) return favMem.get(dom);
  const p = new Promise((res) => {
    const im = new Image(); im.referrerPolicy = 'no-referrer';
    const t = setTimeout(() => res(false), 8000);
    im.onload = () => { clearTimeout(t); res(im.naturalWidth >= 16); };
    im.onerror = () => { clearTimeout(t); res(false); };
    im.src = favUrl(dom);
  });
  favMem.set(dom, p);
  return p;
}
const favUrl = (dom) => 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(dom) + '&sz=32';
function wireFavicons() {
  $body.querySelectorAll('.fb[data-dom]').forEach((el) => {
    if (el.dataset.c) el.style.setProperty('--fbc', el.dataset.c);
    const dom = el.dataset.dom;
    favOk(dom).then((ok) => {
      if (!ok || !el.isConnected) return; // keep the letter badge
      const im = document.createElement('img'); im.className = 'fbi'; im.alt = ''; im.referrerPolicy = 'no-referrer'; im.src = favUrl(dom);
      el.replaceWith(im);
    });
  });
}
function loadLogo(ctx) { wireLogo(ctx); } // logos come only from a site Expand verified (see runExpand in core.js)
function wireLogo(ctx) {
  const el = $body && $body.querySelector('.hcard .clogo'); const L = ctx && ctx.ai && ctx.ai.logo;
  if (!el || !L || !L.src || !settings.logos) return;
  const n = ctx.company.number;
  const im = new Image(); im.referrerPolicy = 'no-referrer'; im.alt = '';
  im.onload = () => {
    if (!el.isConnected || im.naturalWidth < 32) return;
    el.replaceChildren(im); el.classList.add('on');
    el.title = `Logo from ${L.site} (verified: the site shows ${/^number/.test(L.how) ? 'company number ' + n : 'the registered name and office postcode'})`;
  };
  im.src = L.src;
}

/* ---------- files, tabs, clipboard ---------- */
function downloadText(name, mime, text) {
  const blob = new Blob([text], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  let ok = false;
  try {
    const a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove(); ok = true;
  } catch (e) { warn('download link failed', e); }
  st.lastDownload = name;
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return ok;
}
function openTab(url, bg) {
  if (!url) return;
  try { const w = window.open(url, '_blank', 'noopener'); if (w && bg) { try { window.focus(); } catch (e) { /* ignore */ } } } catch (e) { warn('could not open tab', e); }
}
function fallbackCopy(text) {
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}
function copyText(text) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(() => { fallbackCopy(text); }); } catch (e) { /* ignore */ }
  fallbackCopy(text); return Promise.resolve();
}

/* ---------- filing viewer: drawer over the sidebar and centre column ---------- */
function placeDrawer() {
  if (!$drawer || !$aip) return;
  const r = $aip.getBoundingClientRect(), W = window.innerWidth, m = 12, gap = 10;
  const ds = $drawer.style;
  ds.top = m + 'px'; ds.bottom = m + 'px'; ds.left = m + 'px';
  ds.right = Math.max(m, Math.round(W - r.left + gap)) + 'px'; ds.width = 'auto';
  $drawer.classList.remove('over');
  $drawer.classList.toggle('narrow', (r.left - gap - m) < 620);
}
/* Companies House's document API does not allow cross-origin reads from a web page, so the viewer frames the public
   document link (Companies House redirects it to the PDF). */
function showDoc(ctx, x) {
  const box = () => $drawer && $drawer.querySelector(`.pdf[data-pdf="${x.id}"]`);
  if (st.fv !== ctx || !box()) return;
  const el = box(); el.innerHTML = '';
  if (navigator.pdfViewerEnabled === false) {
    el.setAttribute('data-state', 'noviewer');
    el.innerHTML = '<div class="mmsg">This browser has its built-in PDF viewer turned off, so use Open in new tab or Download.</div>';
    return;
  }
  const fr = document.createElement('iframe'); fr.title = x.text; fr.src = docUrl(ctx.company.number, x.id) + '#view=FitH&navpanes=0';
  fr.referrerPolicy = 'no-referrer';
  el.appendChild(fr);
  // Companies House's document link sometimes answers 502 (seen in testing); the page cannot see that inside the
  // frame, so a small Reload asks for it again.
  const rl = document.createElement('button'); rl.className = 'rl'; rl.type = 'button'; rl.textContent = 'Reload document';
  rl.title = 'Companies House sometimes fails to send a document the first time';
  let tries = 0;
  rl.addEventListener('click', (ev) => { ev.stopPropagation(); tries++; fr.src = docUrl(ctx.company.number, x.id) + '&r=' + tries + '#view=FitH&navpanes=0'; });
  el.appendChild(rl);
  watchFrame(fr, (u) => /company-information\.service\.gov\.uk|amazonaws\.com/.test(u) || !u, (why) => {
    el.setAttribute('data-state', 'fail');
    if (why === 'did not load') { el.insertAdjacentHTML('beforeend', '<div class="mmsg">If the document does not appear, use Open in new tab or Download.</div>'); return; }
    fr.remove();
    el.innerHTML = `<div class="mmsg">The document could not be shown here (${esc(why)}). Use Open in new tab or Download.</div>`;
  }, () => el.setAttribute('data-state', 'ok'), 15000);
}
function docDownload(btn) {
  const ctx = st.fv; if (!ctx) return; const x = ctx.company.filings[ctx.idx]; if (!x) return;
  openTab(docUrl(ctx.company.number, x.id, true), false); // Companies House serves it as a download
  st.lastDownload = `${ctx.company.number}_${x.type}_${x.date}.pdf`;
  confirmCopy(btn); if (btn) { btn.innerHTML = ICON.check + 'Saved'; }
}

/* ---------- keys: Esc and the filing viewer's arrows (no global shortcuts in the web app) ---------- */
function escapeAction() {
  if ($body.querySelector('.qb.open')) { const qb = $body.querySelector('.qb.open'); closeQMenus(); const c = qb.querySelector('.qc, .qc2'); if (c) c.focus(); return true; }
  const ae = sroot && sroot.activeElement;
  if (ae && ae.closest && ae.closest('.qmenu') && settings.qlHover) { ae.blur(); return true; }
  if (sroot.querySelector('.shm.show')) { closeShare(); return true; }
  if (st.xmenu) { toggleXMenu(false); return true; }
  if (entEl) { const el = entEl; hideEnt(true); if (el.focus) el.focus(); return true; }
  if (st.fv) { closeDrawer(); return true; }
  if (st.view === 'settings') { toggleSettings(false); return true; }
  return false;
}
function onKey(e) {
  const path = e.composedPath ? e.composedPath() : [e.target];
  const target = path[0];
  const typing = isEditable(target) || (target && target.tagName === 'SELECT');
  if (e.key === 'Escape') { if (escapeAction()) e.stopPropagation(); return; }
  if (st.fv && $drawer && path.includes($drawer) && !e.ctrlKey && !e.metaKey && !e.altKey && !(target && target.closest && target.closest('.shm'))) {
    const inQ = !!(target && target.classList && target.classList.contains('dw-q')), k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowUp' || (!typing && (k === 'ArrowRight' || k === 'ArrowLeft'))) { e.preventDefault(); e.stopPropagation(); fvStep(k === 'ArrowDown' || k === 'ArrowRight' ? 1 : -1); return; }
    if (inQ && k === 'Enter') { e.preventDefault(); if (st.fv.view.length) fvSelect(st.fv.view[0]); return; }
    if (!typing && k === '/') { e.preventDefault(); const q = $drawer.querySelector('.dw-q'); if (q) { q.focus(); q.select(); } return; }
    if (!typing && (k === 'Enter' || k === ' ') && target && target.classList && target.classList.contains('dwr')) { e.preventDefault(); }
  }
}

function toggleSettings(force) {
  const show = force != null ? force : st.view !== 'settings';
  setView(show ? 'settings' : 'main');
  if (show) renderSettings();
  else restoreMain();
}
function openAll() { const ctx = st.ctx; if (!ctx) return; PROVIDERS.forEach((p) => openTab(linkFor(p.id, ctx), true)); showToast('Opened ' + PROVIDERS.length + ' tabs'); }

/* ---------- diagnostics (web version: no userscript manager) ---------- */
async function runDiagnostics() {
  if (st.diag && st.diag.running) return;
  st.diag = { running: true }; rerenderDiag();
  const rows = [];
  const add = (name, state, detail) => rows.push({ name, state, detail });
  add('Environment', 'info', `Web app · ${browserInfo()} · storage ${LS ? 'localStorage' : 'memory only (localStorage blocked)'} · page ${location.hostname} · animations ${root.classList.contains('anim') ? 'on' : 'off'}${reducedMotion() ? ' (reduced motion)' : ''}`);
  add('Panel styles', st.styleMode === 'none' ? 'fail' : 'pass', st.styleMode === 'none' ? 'Blocked: ' + (st.styleErr || '') : 'Applied via ' + st.styleMode);
  ensureFonts();
  await new Promise((r) => setTimeout(r, 300));
  add('Font', /loaded/.test(st.fontStatus) ? 'pass' : 'info', (st.fontStatus || 'not loaded yet') + ' · ' + (st.displayFont || 'DM Sans not loaded'));
  const ci = keyInfo('ch');
  if (!ci.key) add('Companies House API', 'fail', 'No key saved. Add your REST key above.');
  else {
    const log = [];
    const saved = chAuthOk; chAuthOk = null;
    await chRequest('/company/00000006', log);
    if (!chAuthOk) chAuthOk = saved;
    const okm = log.find((x) => x.status === 200);
    const tried = log.map((x) => `${x.method}: HTTP ${x.status}${x.error ? ' ' + x.error : ''} (${x.ms} ms)`).join(' | ');
    let hint = '';
    if (!okm && log.some((x) => x.status === 403)) hint = ' -> 403: Companies House refused requests from ' + location.hostname + '. Add it to the key\'s JavaScript domains in the developer hub.';
    else if (!okm && log.every((x) => x.status === 401)) hint = ' -> 401 means the key itself was rejected; re-copy it from the Companies House developer hub (REST key).';
    else if (!okm && log.every((x) => x.status <= 0)) hint = ' -> no readable answer from Companies House. Most likely ' + location.origin + ' is not listed under JavaScript domains for this key on the Companies House developer hub; otherwise a connection problem, or a browser extension or network filter.';
    add('Companies House API', okm ? 'pass' : 'fail', `${okm ? 'OK with ' + okm.method + '. ' : ''}Key ${ci.source}, ${ci.len} chars. ${tried}${hint}`);
  }
  const li = keyInfo('claude');
  if (!li.key) add('Claude API', 'info', 'No key saved (only needed for AI summaries).');
  else {
    const t0 = Date.now();
    const r = await xhr({ url: 'https://api.anthropic.com/v1/models?limit=5', headers: claudeHeaders(li.key), timeout: 15000, quiet: true });
    let msg = ''; try { const j = JSON.parse(r.text); msg = (j.error && j.error.message) || ''; } catch (e) { /* ignore */ }
    add('Claude API (/v1/models, free)', r.status === 200 ? 'pass' : 'fail', `HTTP ${r.status} (${Date.now() - t0} ms). Key ${li.source}, ${li.len} chars.${msg || r.error ? ' ' + (msg || r.error) : ''}`);
  }
  {
    const t0 = Date.now();
    const r = await xhr({ url: ENUMS_URL, method: 'HEAD', timeout: 10000, quiet: true });
    add('Labels (raw.githubusercontent.com)', r.status === 200 ? 'pass' : 'info', `HTTP ${r.status} (${Date.now() - t0} ms)${r.error ? ' ' + r.error : ''}. Optional: SIC and filing descriptions.`);
  }
  {
    const t0 = Date.now();
    favMem.delete('linkedin.com');
    const ok = await favOk('linkedin.com');
    add('Favicons (google.com)', ok ? 'pass' : 'info', `${ok ? 'Loaded' : 'Not loaded'} (${Date.now() - t0} ms). Optional: letter badges are used otherwise.`);
  }
  st.diag = { rows, at: Date.now() };
  for (const x of rows) if (x.state === 'fail') warn('diagnostics:', x.name, '-', x.detail);
  rerenderDiag();
}

/* ---------- saved data: export / import (web app only; keys and caches are never included) ---------- */
const DATA_SKIP = (k) => k.startsWith('prosper.key.') || k.startsWith('prosper.c.') || k.startsWith('prosper.fav.') || k === K.enums || k === K.fhd;
function dataGroupHtml() {
  return `<div class="grp" data-grp="saved"><div class="gh">Saved data</div>
      <div class="help">Saved companies (summaries, Expand results, chats, notes), pinned and recent, and settings live only in this browser. Export them to a file to move them to another browser, or as a backup. API keys are never included.</div>
      <div class="row mt6 datarow"><button class="btn sm" data-act="data-export">${ICON.dl}Export saved data</button><button class="btn sm" data-act="data-import">Import</button><input class="impf" type="file" accept="application/json,.json"></div>
      <div class="help impres" hidden></div>
    </div>`;
}
function exportData(btn) {
  const data = {};
  for (const k of lv()) { if (DATA_SKIP(k)) continue; const v = LS ? LS.getItem(k) : memStore.get(k); if (v != null) data[k] = v; }
  const d = new Date(), pad = (x) => String(x).padStart(2, '0');
  downloadText(`prosper-data-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`, 'application/json', JSON.stringify({ app: 'Prosper', kind: 'saved-data', v: 1, at: d.toISOString(), data }, null, 1));
  confirmCopy(btn); if (btn) btn.innerHTML = ICON.check + 'Exported';
}
function importData(file) {
  const out = (msg, bad) => { const el = $body.querySelector('.impres'); if (el) { el.hidden = false; el.textContent = msg; el.classList.toggle('bad', !!bad); } };
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) return out('That file is too large to be a Prosper export.', true);
  const rd = new FileReader();
  rd.onerror = () => out('Could not read the file.', true);
  rd.onload = () => {
    let j; try { j = JSON.parse(String(rd.result || '')); } catch (e) { return out('That is not a Prosper export (not valid JSON).', true); }
    if (!j || j.app !== 'Prosper' || j.kind !== 'saved-data' || !j.data || typeof j.data !== 'object') return out('That is not a Prosper saved-data export.', true);
    let n = 0, skipped = 0;
    for (const [k, v] of Object.entries(j.data)) {
      if (typeof k !== 'string' || !k.startsWith('prosper.') || DATA_SKIP(k) || typeof v !== 'string') { skipped++; continue; }
      try { JSON.parse(v); } catch (e) { skipped++; continue; }
      try { if (LS) LS.setItem(k, v); else memStore.set(k, v); n++; } catch (e) { skipped++; }
    }
    loadSettings(); appSettings(); loadSecState(); st.aiMem = {}; st.aiErr = {};
    if (st.ctx && st.ctx.company && !st.ctx.kind) st.ctx.ai = aiRec(st.ctx.company);
    applyRootClasses(); renderSettings(); paintSide();
    out(`Imported ${n} item${n === 1 ? '' : 's'}${skipped ? ` (${skipped} skipped)` : ''}.`);
    showToast('Saved data imported');
  };
  rd.readAsText(file);
}

/* ---------- mount ---------- */
function mount() {
  host = document.createElement('prosper-root');
  host.style.cssText = 'all: initial; position: fixed; inset: 0; display: block;';
  const sr = sroot = host.attachShadow({ mode: 'open' });
  sr.innerHTML = `<i class="probe"></i>
<div class="root app">
  <div class="panel open" role="application" aria-label="Prosper">
    <nav class="side" aria-label="Search, pinned and recent">
      <div class="hd"><div class="brand">Prosper</div>
        <button class="ib" data-act="xmenu" title="Export" aria-haspopup="menu" aria-expanded="false">${ICON.dl}</button>
        <button class="ib" data-act="settings" title="Settings">${ICON.gear}</button></div>
      <div class="menu xmenu" role="menu" aria-label="Export"></div>
      <div class="sb">
        <form class="srow" data-form="search">
          <input type="text" placeholder="Company, email, website, company number, person or LinkedIn link" spellcheck="false" autocomplete="off" aria-label="Search">
          <select title="Search as"><option value="auto">Auto</option><option value="company">Company</option><option value="person">Person</option></select>
          <button class="btn pri" type="submit">Go</button>
        </form>
      </div>
      <div class="slist"></div>
    </nav>
    <main class="mainc">
      <div class="libar" role="region" aria-label="LinkedIn link" hidden></div>
      <div class="body"></div>
    </main>
    <aside class="aip" aria-label="AI"></aside>
    <div class="toast"></div>
    <div class="epop" role="tooltip"></div>
  </div>
  <aside class="drawer" role="dialog" aria-label="Filing history"></aside>
</div>`;
  root = sr.querySelector('.root');
  $panel = sr.querySelector('.panel'); $drawer = sr.querySelector('.drawer'); $side = sr.querySelector('.side'); $aip = $aib = sr.querySelector('.aip');
  $body = sr.querySelector('.body'); $input = sr.querySelector('.srow input'); $det = null;
  $mode = sr.querySelector('.srow select'); $toast = sr.querySelector('.toast'); $menu = null; $sheet = null;
  host.setAttribute('data-build', 'b' + BUILD + ' ' + EDITION);
  document.body.appendChild(host);
  applyStyles(sr);
  ensureDisplayFont();
  ensureFonts();
  applyRootClasses();
  try { window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyRootClasses); } catch (e) { /* ignore */ }
  sr.querySelector('[data-form=search]').addEventListener('submit', (e) => {
    e.preventDefault(); const v = $input.value.trim(); if (!v) return; setView('main'); lookup(v, $mode.value);
  });
  sr.addEventListener('click', onClick);
  sr.addEventListener('change', onChange);
  sr.addEventListener('change', (e) => { const t = e.target; if (t && t.classList && t.classList.contains('impf')) { importData(t.files && t.files[0]); t.value = ''; } });
  const fvFilter = debounce(() => { const q = $drawer && $drawer.querySelector('.dw-q'); if (st.fv && q) { st.fv.q = q.value; renderFvList(); } }, 110);
  sr.addEventListener('input', (e) => {
    const t = e.target;
    if (st.fv && t && t.classList && t.classList.contains('dw-q')) fvFilter();
    if (t && t.classList && t.classList.contains('chatin')) { t.style.height = 'auto'; t.style.height = Math.min(96, t.scrollHeight) + 'px'; }
    if (t && t.classList && t.classList.contains('nta') && st.ctx && st.ctx.company) {
      const n = st.ctx.company.number, ns = st.note[n] = st.note[n] || {}, kind = t.dataset.kind; ns.edit = ns.edit || {}; ns.edit[(ns.to || '_') + kind] = t.value;
      const c = t.parentElement.querySelector('.ncnt'); if (c) { c.textContent = t.value.length + (kind === 'note' ? ' / 300' : ' characters'); c.classList.toggle('over', kind === 'note' && t.value.length > 300); }
    }
  });
  sr.addEventListener('change', (e) => { const t = e.target; if (t && t.classList && t.classList.contains('nto') && st.ctx && st.ctx.company) { const n = st.ctx.company.number; st.note[n] = Object.assign(st.note[n] || {}, { to: t.value }); rerenderNote(n); } });
  sr.addEventListener('submit', (e) => { const fm = e.target; if (fm && fm.dataset && fm.dataset.form === 'chat') { e.preventDefault(); submitChat(fm.querySelector('.chatin')); } });
  sr.addEventListener('scroll', onDrawerScroll, true);
  sr.addEventListener('pointerover', (e) => {
    const t = e.target; if (!t || !t.closest) return;
    const ent = t.closest('.ent');
    if (ent) { clearTimeout(entT); entT = setTimeout(() => showEnt(ent), entEl ? 0 : 140); }
    else if (t.closest('.epop')) clearTimeout(entT);
    else hideEnt();
  });
  sr.addEventListener('focusin', (e) => { const t = e.target; if (!t || !t.closest) return; const ent = t.closest('.ent'); if (ent) showEnt(ent); else if (!t.closest('.epop')) hideEnt(true); });
  $body.addEventListener('scroll', () => hideEnt(true), { passive: true });
  $aip.addEventListener('scroll', () => hideEnt(true), { passive: true });
  sr.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && t.classList && t.classList.contains('chatin') && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submitChat(t); return; }
    if ((e.key === 'Enter' || e.key === ' ') && t && t.classList && t.classList.contains('bh')) { e.preventDefault(); toggleBlock(t.closest('.blk')); return; }
    if (t && t.classList && (t.classList.contains('qc') || t.classList.contains('qc2')) && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openQMenu(t.closest('.qb'), true); return; }
    const menu = t && t.closest && t.closest('.qmenu, .shm');
    if (menu && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const items = [...menu.querySelectorAll('.qi')]; const i = items.indexOf(t);
      const n = items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]; if (n) n.focus();
    } else if (menu && e.key === 'Tab') closeQMenus();
  }, true);
}

/* ---------- boot ---------- */
// No keyboard shortcuts in the web app, and the sidebar is always the pinned/recent list.
function appSettings() { settings.numKeys = false; settings.hotkeysOn = false; settings.pinsMenu = true; }
async function boot() {
  await storageInit();
  loadSettings();
  appSettings();
  loadSecState();
  ENUMS = readJSON(gv(K.enums, null));
  mount();
  st.open = true;
  paintSide(); paintAi(null);
  document.addEventListener('securitypolicyviolation', onCspViolation, true);
  window.addEventListener('keydown', (e) => { try { onKey(e); } catch (err) { warn('key handler failed', err); } }, true);
  window.addEventListener('resize', debounce(() => { if (st.fv) placeDrawer(); }, 100));
  setTimeout(() => { pruneCache(); loadEnums().catch(() => null); }, 1500);
  openEmpty();
  try { console.info('Prosper: build ' + BUILD + ' (' + EDITION + ') running. Styles: ' + st.styleMode + '. Storage: ' + API + '.'); } catch (e) { /* ignore */ }
}

// Exposed for automated tests only (no secrets).
window.__prosperTest = {
  detect, alphaKey, companyLabelFromDomain, hubspotNote: () => st.ctx && st.ctx.company ? crmNote(st.ctx.company, st.ctx.ai) : '', cleanName, findNumber,
  aiRecord: (n) => readJSON(gv(aiKey(n), null)), exportPayload: (fmt) => exportPayload(fmt), linkify: (t) => linkify(t, st.ctx), sseMessage, aiIndex: () => aiIdx(), coSig: () => (st.ctx && st.ctx.company ? coSig(st.ctx.company) : ''), state: () => st, cleanKey, rerender: () => { if (st.ctx && st.ctx.company) renderCompany(st.ctx, false); }, numberOnPage, liTitleParse, liParseUrl, liSlugName, liNameMatch,
  keyInfo: (k) => { const i = keyInfo(k); return { source: i.source, len: i.len, head: i.head }; },
  settings: () => Object.assign({}, settings), sections: () => Object.assign({}, secState), ukRegNumber, shortSummary: () => (st.ctx && st.ctx.company ? shortSummary(st.ctx.company) : ''),
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot().catch((e) => warn('failed to start:', e)));
else boot().catch((e) => warn('failed to start:', e));
