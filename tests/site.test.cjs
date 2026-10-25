// Checks on the built site as a whole: every factor page exists, theme assets resolve,
// and internal links and anchors point somewhere real.
//
// Run after a Jekyll build:  node --test "tests/*.test.cjs"
// SITE_DIR selects the build output (default: _site); BASEURL is the site's base path
// (default: /20-factor, as in _config.yml).
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SITE_DIR = process.env.SITE_DIR || path.join(__dirname, "..", "_site");
const BASEURL = (process.env.BASEURL || "/20-factor").replace(/\/$/, "");

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith(".html") ? [full] : [];
  });
}

// HTML comments are dropped: the theme leaves commented-out tags that browsers never load.
const pages = htmlFiles(SITE_DIR).map(file => ({
  file,
  rel: path.relative(SITE_DIR, file),
  html: fs.readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, "")
}));

// The file a site-absolute URL path is served from, or null when it does not exist.
function resolveTarget(urlPath) {
  let rel = decodeURIComponent(urlPath.slice(BASEURL.length)).replace(/^\//, "");
  const candidates = rel === "" || rel.endsWith("/")
    ? [path.join(rel, "index.html")]
    : [rel, `${rel}.html`, path.join(rel, "index.html")];
  for (const c of candidates) {
    const full = path.join(SITE_DIR, c);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  return null;
}

function idsIn(html) {
  return new Set([...html.matchAll(/\sid=["']?([^"'\s>]+)/g)].map(m => m[1]));
}

test("the site has a page for each of the 20 factors", () => {
  const factorPages = pages.filter(p => /^factors[\\/]\d{2}-[^\\/]+[\\/]index\.html$/.test(p.rel));
  assert.equal(factorPages.length, 20);
});

test("no page renders an empty asset URL or an unexpanded {{version}}", () => {
  // The theme builds asset tags from _config.yml; a missing or unexpanded entry used to
  // ship as src="" and break jQuery on every page.
  const broken = pages.filter(p => /\s(?:src|href)=""|\{\{version\}\}/.test(p.html)).map(p => p.rel);
  assert.deepEqual(broken, []);
});

test("prompt placeholders survive Liquid in factors 1 and 17", () => {
  for (const slug of ["01-declarative-codebase", "17-prompt-context-engineering"]) {
    const page = pages.find(p => p.rel === path.join("factors", slug, "index.html"));
    assert.ok(page, `${slug} page missing`);
    assert.match(page.html, /\{\{[a-z_]+\}\}/, `${slug} lost its {{placeholders}}`);
  }
});

test("internal links and anchors resolve", () => {
  const missing = [];
  const idCache = new Map();
  for (const page of pages) {
    for (const m of page.html.matchAll(/\s(?:href|src)=["']([^"']+)["']/g)) {
      const url = m[1];
      if (!url.startsWith(`${BASEURL}/`) && url !== BASEURL) continue;
      const [urlPath, fragment] = url.split("?")[0].split("#");
      const target = resolveTarget(urlPath);
      if (!target) { missing.push(`${page.rel} -> ${url}`); continue; }
      if (fragment && target.endsWith(".html")) {
        if (!idCache.has(target)) idCache.set(target, idsIn(fs.readFileSync(target, "utf8")));
        if (!idCache.get(target).has(decodeURIComponent(fragment))) missing.push(`${page.rel} -> ${url} (no #${fragment})`);
      }
    }
  }
  assert.deepEqual(missing, []);
});
