const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { buildPublicSite } = require("./build-public-site.cjs");
const { JSDOM } = require(
  require.resolve("jsdom", { paths: [path.resolve(__dirname, "../client")] }),
);

function fixture(t) {
  const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), "daymark-site-"));
  t.after(() => fs.rmSync(buildDir, { recursive: true, force: true }));
  const app =
    '<!doctype html><html><head><meta name="robots" content="noindex, follow"></head><body><div id="root"></div><script src="/diploma/static/js/app.js"></script></body></html>';
  fs.writeFileSync(path.join(buildDir, "index.html"), app);
  fs.copyFileSync(
    path.resolve(__dirname, "../client/public/daymark-light.svg"),
    path.join(buildDir, "daymark-light.svg"),
  );
  return { buildDir, app };
}

test("published pages contain readable content without React and link to real static pages", (t) => {
  const { buildDir, app } = fixture(t);
  const urls = buildPublicSite({ buildDir, publicUrl: "/diploma" });
  assert.equal(fs.readFileSync(path.join(buildDir, "app.html"), "utf8"), app);
  assert.equal(urls.length, 6);
  const titles = new Set();
  const descriptions = new Set();
  for (const url of urls) {
    const target = new URL(url).pathname.replace("/diploma/", "");
    const dom = new JSDOM(fs.readFileSync(path.join(buildDir, target, "index.html"), "utf8"), {
      url,
    });
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll("h1").length, 1);
    assert.ok(doc.querySelector("main").textContent.length > 500);
    assert.equal(doc.querySelector('meta[name="robots"]'), null);
    assert.equal(doc.querySelector("script[src]"), null);
    assert.equal(doc.querySelector('link[rel="canonical"]').href, url);
    titles.add(doc.title);
    descriptions.add(doc.querySelector('meta[name="description"]').content);
    const graph = JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent);
    assert.equal(graph["@graph"][1].url, url);
    for (const alternate of doc.querySelectorAll('link[rel="alternate"]')) {
      assert.ok(urls.includes(alternate.href), alternate.href);
    }
    for (const link of doc.querySelectorAll('a[href], link[rel="stylesheet"], link[rel="icon"]')) {
      const parsed = new URL(link.href);
      if (parsed.origin !== new URL(url).origin) continue;
      assert.ok(parsed.pathname.startsWith("/diploma/"));
      const relative = parsed.pathname.slice("/diploma/".length);
      const file = path.join(
        buildDir,
        relative,
        relative.endsWith("/") || !relative ? "index.html" : "",
      );
      assert.ok(fs.existsSync(file), `Missing link target: ${link.href}`);
    }
    dom.window.close();
  }
  assert.equal(titles.size, 6);
  assert.equal(descriptions.size, 6);
  const xml = new JSDOM(fs.readFileSync(path.join(buildDir, "sitemap.xml"), "utf8"), {
    contentType: "application/xml",
  });
  assert.deepEqual(
    [...xml.window.document.querySelectorAll("loc")].map((loc) => loc.textContent),
    urls,
  );
  assert.ok(!fs.readFileSync(path.join(buildDir, "sitemap.xml"), "utf8").includes("app.html"));
  xml.window.close();
});

test("legacy calendar, recovery and connection links keep their complete fragments", (t) => {
  const { buildDir } = fixture(t);
  buildPublicSite({ buildDir });
  const doc = new JSDOM(fs.readFileSync(path.join(buildDir, "index.html"), "utf8")).window.document;
  const script = [...doc.querySelectorAll("script")].find((node) => !node.type).textContent;
  for (const hash of [
    "#/calendar",
    "#/login",
    "#/reset-password?token=secret",
    "#/calendar?connect=public-request",
  ]) {
    let destination;
    vm.runInNewContext(script, {
      window: {
        location: {
          hash,
          search: "?source=old",
          replace: (value) => {
            destination = value;
          },
        },
      },
    });
    assert.equal(destination, "/diploma/app.html?source=old" + hash);
  }
  for (const hash of ["", "#main", "#features"]) {
    vm.runInNewContext(script, {
      window: { location: { hash, replace: () => assert.fail("Public page must remain visible") } },
    });
  }
});

test("public pages also support a custom domain at the root", (t) => {
  const { buildDir } = fixture(t);
  const urls = buildPublicSite({ buildDir, siteUrl: "https://calendar.example", publicUrl: "/" });
  assert.equal(urls[0], "https://calendar.example/");
  const dom = new JSDOM(fs.readFileSync(path.join(buildDir, "en/features/index.html"), "utf8"), {
    url: urls[4],
  });
  assert.equal(
    dom.window.document.querySelector('link[rel="canonical"]').href,
    "https://calendar.example/en/features/",
  );
  assert.equal(
    dom.window.document.querySelector("a.nav-open").getAttribute("href"),
    "/app.html#/calendar",
  );
  assert.match(
    fs.readFileSync(path.join(buildDir, "robots.txt"), "utf8"),
    /Sitemap: https:\/\/calendar.example\/sitemap.xml/,
  );
  dom.window.close();
});

test("a mismatched deployment path or unsafe canonical origin fails before replacing the app", (t) => {
  const { buildDir, app } = fixture(t);
  for (const siteUrl of [
    "http://example.com",
    "https://example.com/?token=secret",
    "https://user:secret@example.com/",
    "https://example.com/#app",
  ]) {
    assert.throws(() => buildPublicSite({ buildDir, siteUrl }), /DAYMARK_SITE_URL/);
  }
  assert.throws(() => buildPublicSite({ buildDir, publicUrl: "/wrong-path" }), /PUBLIC_URL/);
  assert.equal(fs.readFileSync(path.join(buildDir, "index.html"), "utf8"), app);
});

test("the public build refuses to publish an indexable app shell", (t) => {
  const { buildDir } = fixture(t);
  fs.writeFileSync(path.join(buildDir, "index.html"), "<html><body>App</body></html>");
  assert.throws(() => buildPublicSite({ buildDir }), /noindex/);
});
