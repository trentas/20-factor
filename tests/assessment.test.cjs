// Regression tests for the self-assessment page (assessment.html).
//
// They run the page's own script, taken from the built site, in a Node sandbox with
// minimal DOM, storage, and Chart.js stubs. That covers scoring, storage, import and
// export, and chart data — not layout or a real browser.
//
// Run after a Jekyll build:  node --test "tests/*.test.cjs"
// SITE_DIR selects the build output (default: _site).
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SITE_DIR = process.env.SITE_DIR || path.join(__dirname, "..", "_site");
const html = fs.readFileSync(path.join(SITE_DIR, "assessment.html"), "utf8");
const SCRIPT = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(m => m[1])
  .find(s => s.includes("const FACTORS"));
assert.ok(SCRIPT, "assessment script not found in the built page");

const STORAGE_KEY = "18factor-assessment";

function makeElement(id) {
  const classes = new Set();
  return {
    id,
    innerHTML: "",
    textContent: "",
    value: "",
    attributes: {},
    classList: {
      add: c => classes.add(c),
      remove: c => classes.delete(c),
      contains: c => classes.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !classes.has(c) : force;
        if (on) classes.add(c); else classes.delete(c);
        return on;
      }
    },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name]; },
    appendChild() {},
    addEventListener(type, cb) { this[`on_${type}`] = cb; },
    focus() {},
    click() {},
    scrollIntoView() {},
    getContext() { return {}; }
  };
}

// Load the page script in a fresh sandbox.
//   storage:      initial localStorage contents (key -> string)
//   failStorage:  make every localStorage write throw
//   noChart:      simulate the chart library failing to load
//   promptValue:  what window.prompt returns
function load({ storage = {}, failStorage = false, noChart = false, promptValue = null } = {}) {
  const store = new Map(Object.entries(storage));
  const elements = new Map();
  const getElement = id => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  };
  const ctx = {
    console,
    alerts: [],
    exported: [],
    themeObserverCallback: null,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => {
        if (failStorage) throw new Error("QuotaExceededError");
        store.set(k, String(v));
      }
    },
    document: {
      documentElement: getElement("html"),
      body: getElement("body"),
      activeElement: null,
      getElementById: getElement,
      querySelector: () => getElement("tfa"),
      querySelectorAll: () => [],
      createElement: () => makeElement(`el-${Math.random()}`),
      addEventListener() {}
    },
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    MutationObserver: class {
      constructor(cb) { ctx.themeObserverCallback = cb; }
      observe() {}
    },
    window: { matchMedia: () => ({ addEventListener() {} }) },
    Blob: class { constructor(parts) { ctx.exported.push(parts.join("")); } },
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
    alert: msg => ctx.alerts.push(msg),
    prompt: () => promptValue,
    confirm: () => true
  };
  if (!noChart) {
    ctx.Chart = class {
      constructor(_canvas, config) { this.data = config.data; this.options = config.options; }
      destroy() {}
      update() {}
    };
  }
  vm.createContext(ctx);
  vm.runInContext(SCRIPT, ctx);
  return {
    ctx,
    store,
    element: getElement,
    // Results are copied out of the sandbox as plain JSON, so assertions compare
    // values rather than objects from another realm.
    run: code => {
      const out = vm.runInContext(code, ctx);
      return out === undefined ? undefined : JSON.parse(JSON.stringify(out));
    }
  };
}

// Answer the given item indexes of a factor ("done" by default).
function answer(page, factor, indexes, status = "done") {
  page.run(`[${indexes.join(",")}].forEach(i => setAnswer(${factor}, i, ${JSON.stringify(status)}))`);
}

test("the catalog has 20 factors with unique, stable item IDs", () => {
  const page = load();
  const catalog = page.run(`({
    factors: FACTORS.length,
    shortNames: SHORT_NAMES.length,
    ids: FACTORS.flatMap(f => f.items.map(i => i.id)),
    empty: FACTORS.filter(f => f.items.length === 0).map(f => f.num),
    version: CATALOG_VERSION
  })`);
  assert.equal(catalog.factors, 20);
  assert.equal(catalog.shortNames, 20);
  assert.deepEqual(catalog.empty, []);
  assert.equal(new Set(catalog.ids).size, catalog.ids.length, "item IDs must be unique");
  for (const id of catalog.ids) assert.match(id, /^[0-9a-f]{16}$/);
  assert.match(catalog.version, /^[0-9a-f]{16}$/);
});

test("a factor whose items are all N/A has no score and stays out of totals", () => {
  const page = load();
  const f1 = page.run("FACTOR_BY_NUM.get(1).items.length");
  answer(page, 1, [...Array(f1).keys()], "na");
  answer(page, 2, [0]);
  const r = page.run(`({
    f1: factorStats(1),
    f2: factorStats(2),
    total: totalStats(FACTORS.map(f => f.num)),
    badge: badgeText(factorStats(1)),
    chart: radarChart.data.datasets[0].data[0]
  })`);
  assert.equal(r.f1.applicable, 0);
  assert.equal(r.f1.coverage, null);
  assert.equal(r.badge, "N/A");
  assert.equal(r.chart, null);
  assert.equal(r.total.naFactors, 1);
  assert.equal(r.total.done, 1);
  assert.equal(r.total.applicable, page.run("FACTORS.reduce((n, f) => n + f.items.length, 0)") - f1);
});

test("everything N/A means nothing is scored, not a perfect score", () => {
  const page = load();
  page.run(`for (const f of FACTORS) f.items.forEach((_, i) => setAnswer(f.num, i, "na"))`);
  const total = page.run("totalStats(FACTORS.map(f => f.num))");
  assert.equal(total.applicable, 0);
  assert.equal(total.coverage, null);
  assert.equal(total.naFactors, 20);
  assert.match(page.element("summaryBar").innerHTML, /Nothing applicable/);
});

test("coverage is a declared percentage, not a maturity level", () => {
  const page = load();
  const f8 = page.run("FACTOR_BY_NUM.get(8).items.length");
  const skipped = [1, 4];
  answer(page, 8, [...Array(f8).keys()].filter(i => !skipped.includes(i)));
  const r = page.run("({ stats: factorStats(8), badge: badgeText(factorStats(8)) })");
  assert.equal(r.stats.done, f8 - 2);
  assert.equal(r.badge, `${Math.round(((f8 - 2) / f8) * 100)}%`);
  assert.doesNotMatch(SCRIPT, /Optimized/);
});

test("imports with unknown versions, missing items, or conflicts are rejected without changes", () => {
  const page = load();
  const before = page.run("profileIds().length");
  const cases = [
    { name: "Bad version", version: "not-supported", factors: {} },
    { name: "Out of range", version: "20factor-v1", factors: { 1: { checked: [0], na: [100, 101] } } },
    { name: "Conflict", version: "20factor-v1", factors: { 1: { checked: [0], na: [0] } } },
    { name: "Unknown factor", version: "20factor-v1", factors: { 99: { checked: [0] } } },
    { name: "", version: "20factor-v2", answers: [] },
    { name: "Bad status", version: "20factor-v2", answers: [{ id: "abc", factor: 1, index: 0, status: "maybe", text: null }] }
  ];
  for (const c of cases) {
    const ok = page.run(`importFromText(${JSON.stringify(JSON.stringify(c))})`);
    assert.equal(ok, false, `${c.name || "nameless"} should be rejected`);
  }
  assert.equal(page.run("importFromText('{not json')"), false);
  assert.equal(page.ctx.alerts.length, cases.length + 1);
  assert.equal(page.run("profileIds().length"), before);
});

test("export and import round-trip answers by item ID", () => {
  const page = load();
  answer(page, 3, [0, 2]);
  answer(page, 3, [1], "na");
  page.run("exportJSON()");
  const exported = JSON.parse(page.ctx.exported.at(-1));
  assert.equal(exported.version, "20factor-v2");
  assert.equal(exported.answers.length, 3);
  assert.equal(page.run(`importFromText(${JSON.stringify(JSON.stringify({ ...exported, name: "Copy" }))})`), true);
  const r = page.run("({ name: activeProfileName(), stats: factorStats(3) })");
  assert.equal(r.name, "Copy");
  assert.equal(r.stats.done, 2);
  assert.equal(r.stats.na, 1);
  assert.equal(r.stats.pending, 0);
});

test("version 1 imports are carried over for review, not trusted", () => {
  const page = load();
  const ok = page.run(`importFromText(${JSON.stringify(JSON.stringify({
    name: "Old export", version: "20factor-v1", factors: { 14: { checked: [2], na: [3] } }
  }))})`);
  assert.equal(ok, true);
  const before = page.run("factorStats(14)");
  assert.equal(before.done, 0);
  assert.equal(before.pending, 2);
  page.run("confirmAllPending()");
  const after = page.run("factorStats(14)");
  assert.equal(after.done, 1);
  assert.equal(after.na, 1);
  assert.equal(after.pending, 0);
});

test("legacy saved data is backed up, migrated, and marked for review", () => {
  const legacy = JSON.stringify({
    profiles: { abc: { name: "Legacy app", state: { 1: { 0: true, 1: true }, "1_na": { 1: true }, 99: { 0: true } } } },
    activeProfile: "abc"
  });
  const page = load({ storage: { [STORAGE_KEY]: legacy } });
  assert.equal(page.store.get(`${STORAGE_KEY}.backup`), legacy);
  const saved = JSON.parse(page.store.get(STORAGE_KEY));
  assert.equal(saved.schema, 2);
  const r = page.run("({ f1: factorStats(1), orphaned: resolvedFor(db.activeProfile).orphaned.length })");
  assert.equal(r.f1.done, 0);
  assert.equal(r.f1.pending, 2);
  assert.equal(r.orphaned, 1, "factor 99 does not exist");
  assert.match(page.element("reviewBar").innerHTML, /2 answers need review/);
  page.run("discardOrphaned(); confirmAllPending()");
  const after = page.run("({ f1: factorStats(1), orphaned: resolvedFor(db.activeProfile).orphaned.length })");
  assert.equal(after.f1.done, 1);
  assert.equal(after.f1.na, 1);
  assert.equal(after.orphaned, 0);
});

test("a reworded item asks for review; a moved item keeps its answer", () => {
  const page = load();
  const item = page.run("FACTOR_BY_NUM.get(14).items[2]");
  const stored = {
    schema: 2,
    activeProfile: "p1",
    profiles: {
      p1: {
        name: "App",
        answers: {
          // Same wording, recorded when the item sat at another position.
          [item.id]: { f: 14, i: 7, s: "done", t: item.text },
          // An earlier wording of the item now at position 3.
          "0123456789abcdef": { f: 14, i: 3, s: "done", t: "client-side concurrency control" }
        }
      }
    }
  };
  const reloaded = load({ storage: { [STORAGE_KEY]: JSON.stringify(stored) } });
  const r = reloaded.run("({ s2: itemStatus(14, 2), p3: pendingFor(14, 3), stats: factorStats(14) })");
  assert.equal(r.s2, "done");
  assert.equal(r.p3.t, "client-side concurrency control");
  assert.equal(r.stats.done, 1);
  assert.equal(r.stats.pending, 1);
  reloaded.run("discardPending(14, 3)");
  assert.equal(reloaded.run("factorStats(14).pending"), 0);
});

test("comparison keeps profiles, colors, and tooltips aligned through a theme change", () => {
  const page = load();
  page.run(`
    db.profiles = { a: newProfile("A"), b: newProfile("B") };
    db.activeProfile = "b";
    setAnswer(1, 0, "done");
    db.activeProfile = "a";
    saveDB();
    compareMode = true;
    compareSelected = new Set(["b", "a"]);
    renderComparePanel();
    updateChart();
  `);
  const check = () => page.run(`radarChart.data.datasets.map((d, datasetIndex) => ({
    label: d.label,
    color: d.borderColor,
    first: d.data[0],
    tooltip: tooltipLabel({ dataIndex: 0, datasetIndex, dataset: d })
  }))`);
  const before = check();
  page.ctx.themeObserverCallback();
  const after = check();
  assert.deepEqual(after, before);
  assert.deepEqual(after.map(d => d.label), ["A", "B"], "same order as the compare panel");
  assert.equal(after[0].color, page.run("profileColor('a')"));
  assert.match(after[0].tooltip, /^A: 0% declared — 0\//);
  assert.match(after[1].tooltip, /^B: \d+% declared — 1\//);
  assert.equal(page.run("radarChart.options.plugins.legend.display"), true);
});

test("renaming a profile updates the chart right away", () => {
  const page = load({ promptValue: "Renamed app" });
  page.run("renameProfile()");
  assert.equal(page.run("radarChart.data.datasets[0].label"), "Renamed app");
});

test("a storage failure is reported and does not break the page", () => {
  const page = load({ failStorage: true });
  answer(page, 2, [0]);
  assert.equal(page.run("factorStats(2).done"), 1);
  assert.match(page.element("reviewBar").innerHTML, /could not be saved/);
});

test("unreadable saved data is kept as a backup and a fresh profile starts", () => {
  const page = load({ storage: { [STORAGE_KEY]: "{not json" } });
  assert.equal(page.store.get(`${STORAGE_KEY}.backup`), "{not json");
  assert.equal(page.run("Object.keys(activeProfile().answers).length"), 0);
  assert.match(page.element("reviewBar").innerHTML, /could not be read/);
});

test("without the chart library the checklist and table still work", () => {
  const page = load({ noChart: true });
  answer(page, 5, [0]);
  assert.equal(page.run("radarChart"), null);
  assert.match(page.element("chartWrap").innerHTML, /could not be loaded/);
  assert.match(page.element("chartTable").innerHTML, /<table/);
  assert.equal(page.run("factorStats(5).done"), 1);
});
