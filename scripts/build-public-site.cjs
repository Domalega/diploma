const fs = require("node:fs");
const path = require("node:path");
const { content } = require("../client/site/content.cjs");

const DEFAULT_SITE_URL = "https://domalega.github.io/diploma/";
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );

function siteAddress(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.search || url.hash || url.username || url.password) {
    throw new Error(
      "DAYMARK_SITE_URL must be a public HTTPS URL without credentials, query or hash.",
    );
  }
  url.pathname = url.pathname.replace(/\/*$/, "/");
  return url;
}

function buildPublicSite({ buildDir, siteUrl = DEFAULT_SITE_URL, publicUrl = "" }) {
  const site = siteAddress(siteUrl);
  if (publicUrl && publicUrl.replace(/\/$/, "") !== site.pathname.replace(/\/$/, "")) {
    throw new Error("PUBLIC_URL must match the path in DAYMARK_SITE_URL.");
  }
  const source = path.resolve(__dirname, "../client/site");
  const appPath = path.join(buildDir, "app.html");
  if (!fs.existsSync(appPath)) fs.copyFileSync(path.join(buildDir, "index.html"), appPath);
  const app = fs.readFileSync(appPath, "utf8");
  if (!/<meta name="robots" content="noindex, follow"\s*\/?\s*>/.test(app)) {
    throw new Error("The app shell must contain noindex before publishing public pages.");
  }
  fs.mkdirSync(path.join(buildDir, "site"), { recursive: true });
  fs.copyFileSync(path.join(source, "site.css"), path.join(buildDir, "site/site.css"));
  const route = (lang, page) => `${lang === "en" ? "en/" : ""}${page === "home" ? "" : `${page}/`}`;
  const href = (lang, page) => site.pathname + route(lang, page);
  const absolute = (lang, page) => new URL(route(lang, page), site).href;
  const asset = (name) => site.pathname + name;
  const appHref = (screen) => `${asset("app.html")}#/${screen}`;
  const pages = [];

  for (const lang of ["ru", "en"]) {
    const t = content[lang];
    for (const page of ["home", "features", "download"]) {
      const data = t.pages[page];
      const url = absolute(lang, page);
      const link = (target, text, className = "") =>
        `<a href="${escape(href(lang, target))}"${className ? ` class="${className}"` : ""}${page === target ? ' aria-current="page"' : ""}>${escape(text)}</a>`;
      const cards = (items) =>
        items
          .map(
            ([title, text], index) =>
              `<article class="feature"><span class="feature-number" aria-hidden="true">0${index + 1}</span><h3>${escape(title)}</h3><p>${escape(text)}</p></article>`,
          )
          .join("");
      const cta = `<div class="actions"><a class="button" href="${appHref("calendar")}">${escape(t.open)} <span aria-hidden="true">↗</span></a>${link("download", t.download, "button secondary")}</div>`;
      const preview = `<div class="preview" role="img" aria-label="${escape(t.previewAlt)}"><div class="preview-header"><span>Daymark</span><span class="preview-dot" aria-hidden="true"></span></div><div class="preview-heading"><strong>${escape(t.month)}</strong><span aria-hidden="true">← &nbsp; →</span></div><div class="week" aria-hidden="true">${t.days.map((day) => `<span>${day}</span>`).join("")}</div><div class="dates" aria-hidden="true">${Array.from({ length: 35 }, (_, i) => `<span${i === 13 ? ' class="today"' : i > 29 ? ' class="outside"' : ""}>${i < 30 ? i + 1 : i - 29}${[5, 9, 13, 21].includes(i) ? "<i></i>" : ""}</span>`).join("")}</div><div class="preview-note"><span class="note-check" aria-hidden="true">✓</span><div><strong>${escape(t.sampleTitle)}</strong><span>${escape(t.sampleText)}</span></div><span class="note-time">18:30</span></div><p class="preview-caption">${escape(t.previewLabel)}</p></div>`;
      let body;
      if (page === "home") {
        body = `<section class="hero"><div class="hero-copy"><p class="eyebrow">${escape(t.eyebrow)}</p><h1>${escape(data.heading)}</h1><p class="lead">${escape(data.intro)}</p>${cta}<p class="quiet">${escape(t.platforms)}</p></div>${preview}</section><section class="section" aria-labelledby="features-heading"><div class="section-heading"><div><p class="eyebrow">${escape(t.everyday)}</p><h2 id="features-heading">${escape(t.featuresHeading)}</h2></div>${link("features", t.allFeatures, "text-link")}</div><div class="feature-grid">${cards(t.summary)}</div></section><section class="bottom-panel"><div><p class="eyebrow">${escape(t.startLabel)}</p><h2>${escape(t.startHeading)}</h2><p>${escape(t.startText)}</p></div><a class="button" href="${appHref("registration")}">${escape(t.register)} <span aria-hidden="true">↗</span></a></section>`;
      } else if (page === "features") {
        body = `<section class="page-intro"><p class="eyebrow">Daymark</p><h1>${escape(data.heading)}</h1><p class="lead">${escape(data.intro)}</p>${cta}</section><section class="section" aria-label="${escape(t.nav.features)}"><div class="feature-grid">${cards(t.features)}</div></section><section class="reading-panel"><h2>${escape(t.privacyTitle)}</h2><p>${escape(t.privacyText)}</p><a class="text-link" href="https://github.com/Domalega/diploma/blob/redesign/docs/ENCRYPTION.md">${escape(t.privacyLink)} <span aria-hidden="true">↗</span></a></section>`;
      } else {
        body = `<section class="page-intro"><p class="eyebrow">Daymark</p><h1>${escape(data.heading)}</h1><p class="lead">${escape(data.intro)}</p></section><section class="download-grid" aria-label="${escape(t.download)}">${t.clients.map((client, i) => `<article class="download-card"><span class="feature-number" aria-hidden="true">0${i + 1}</span><h2>${escape(client.title)}</h2><p class="platform">${escape(client.platform)}</p><p>${escape(client.text)}</p><a class="button${i ? " secondary" : ""}" href="${i ? "https://github.com/Domalega/diploma/releases" : appHref("calendar")}">${escape(client.button)} <span aria-hidden="true">↗</span></a></article>`).join("")}</section><section class="reading-panel"><h2>${escape(t.installTitle)}</h2><ol>${t.installSteps.map((step) => `<li>${escape(step)}</li>`).join("")}</ol><p>${escape(t.reminderNote)}</p><a class="text-link" href="https://github.com/Domalega/diploma/blob/redesign/apps/README.md">${escape(t.installLink)} <span aria-hidden="true">↗</span></a></section>`;
      }
      const schema = {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebSite",
            "@id": site.href + "#website",
            url: site.href,
            name: "Daymark",
            inLanguage: ["ru", "en"],
          },
          {
            "@type": "WebPage",
            "@id": url + "#webpage",
            url,
            name: data.title,
            description: data.description,
            inLanguage: lang,
            isPartOf: { "@id": site.href + "#website" },
          },
        ],
      };
      // Old hash links include password recovery and device connection requests.
      // Move the complete fragment without parsing or persisting its contents.
      const compatibility =
        page === "home" && lang === "ru"
          ? `<script>if (window.location.hash.indexOf("#/") === 0) { window.location.replace(${JSON.stringify(asset("app.html"))} + window.location.search + window.location.hash); }</script>`
          : "";
      const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#fcfcf9">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="google-site-verification" content="dkR3pNpD3m7CAKVu8TPUt6-Ca5N1jE8SiTHRYO7eBeU" />
<title>${escape(data.title)}</title>
<meta name="description" content="${escape(data.description)}">
<link rel="canonical" href="${escape(url)}">
<link rel="alternate" hreflang="ru" href="${escape(absolute("ru", page))}">
<link rel="alternate" hreflang="en" href="${escape(absolute("en", page))}">
<link rel="alternate" hreflang="x-default" href="${escape(absolute("ru", page))}">
<link rel="icon" type="image/svg+xml" href="${asset("daymark-light.svg")}">
<link rel="stylesheet" href="${asset("site/site.css")}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Daymark">
<meta property="og:locale" content="${lang === "ru" ? "ru_RU" : "en_US"}">
<meta property="og:locale:alternate" content="${lang === "ru" ? "en_US" : "ru_RU"}">
<meta property="og:title" content="${escape(data.title)}">
<meta property="og:description" content="${escape(data.description)}">
<meta property="og:url" content="${escape(url)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escape(data.title)}">
<meta name="twitter:description" content="${escape(data.description)}">
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>
${compatibility}
</head>
<body>
<a class="skip-link" href="#main">${escape(t.skip)}</a>
<header class="site-header"><a class="brand" href="${href(lang, "home")}" aria-label="${escape(t.homeLabel)}"><img src="${asset("daymark-light.svg")}" width="42" height="42" alt=""><span>Daymark</span></a><nav aria-label="${escape(t.navigation)}">${link("features", t.nav.features)}${link("download", t.nav.download)}<a href="${href(lang === "ru" ? "en" : "ru", page)}" lang="${lang === "ru" ? "en" : "ru"}" hreflang="${lang === "ru" ? "en" : "ru"}" aria-label="${lang === "ru" ? "Read in English" : "Читать на русском"}">${lang === "ru" ? "EN" : "RU"}</a><a class="nav-open" href="${appHref("calendar")}">${escape(t.signIn)} <span aria-hidden="true">↗</span></a></nav></header>
<main id="main">${body}</main>
<footer class="site-footer"><div><a class="footer-brand" href="${href(lang, "home")}">Daymark</a><p>${escape(t.footer)}</p></div><nav aria-label="${escape(t.footerNavigation)}">${link("features", t.nav.features)}${link("download", t.nav.download)}<a href="https://github.com/Domalega/diploma">GitHub <span aria-hidden="true">↗</span></a></nav><span class="creator">Made by Domalega</span></footer>
</body>
</html>`;
      const target = path.join(buildDir, route(lang, page), "index.html");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, html + "\n");
      pages.push({ url, page });
    }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${pages.map(({ url, page }) => `  <url><loc>${escape(url)}</loc>${["ru", "en", "x-default"].map((lang) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${escape(absolute(lang === "x-default" ? "ru" : lang, page))}"/>`).join("")}</url>`).join("\n")}\n</urlset>\n`;
  fs.writeFileSync(path.join(buildDir, "sitemap.xml"), xml);
  // Project Pages cannot control /robots.txt at the origin root. Submit the
  // sitemap directly in search consoles; this file also works at a root domain.
  fs.writeFileSync(
    path.join(buildDir, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${site.href}sitemap.xml\n`,
  );
  return pages.map(({ url }) => url);
}

if (require.main === module) {
  if (process.env.REACT_APP_ROUTER === "hash" && process.env.PUBLIC_URL !== ".") {
    const urls = buildPublicSite({
      buildDir: path.resolve(__dirname, "../client/build"),
      siteUrl: process.env.DAYMARK_SITE_URL || DEFAULT_SITE_URL,
      publicUrl: process.env.PUBLIC_URL || "",
    });
    console.log(`Built ${urls.length} public pages and sitemap; application: app.html.`);
  } else {
    console.log("Public pages skipped for the native bundle or browser-router development build.");
  }
}

module.exports = { buildPublicSite };
