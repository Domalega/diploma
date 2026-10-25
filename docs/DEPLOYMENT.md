# Deployment

The hosted setup uses GitHub Pages for the frontend, Render for the API and PostgreSQL for storage.

1. Create a PostgreSQL database and set `DATABASE_URL` in Render.
2. Deploy the API using `render.yaml`. Set a random `SECRET_KEY` and configure [password recovery](../integrations/google-mail/README.md) if needed.
3. Enable GitHub Pages with GitHub Actions. Set the repository variable `REACT_APP_API_URL` to the API's HTTPS address ending in `/api`.

The **Checks** workflow publishes the frontend from `redesign` after tests pass. Web builds use `PUBLIC_URL=/diploma`, `REACT_APP_ROUTER=hash` and `DAYMARK_SITE_URL=https://domalega.github.io/diploma/`.

The postbuild step creates six static public pages: `/diploma/`, `/diploma/features/`, `/diploma/download/` and their English versions under `/diploma/en/`. Their content, metadata, canonical URLs, language alternatives and WebSite/WebPage structured data are available without JavaScript. Edit public copy in `client/site/content.cjs` and appearance in `client/site/site.css`.

The React interface is published as `/diploma/app.html#/calendar` with `noindex`. Old links such as `/diploma/#/calendar`, password recovery links and device connection links forward to the application while preserving the full fragment. Existing browser data stays on the same origin. Android builds (`PUBLIC_URL=.`) keep the bundled interface as `index.html` and skip public pages. Local browser-router builds and the development server also keep the existing interface.

For a custom domain, set `DAYMARK_SITE_URL` to its full HTTPS address and `PUBLIC_URL` to the matching path (use `/` for the domain root). Hash routing is required for the published application. Configure the domain in GitHub Pages separately.

## Search indexing

After publishing:

1. Add the URL-prefix property `https://domalega.github.io/diploma/` to Google Search Console using the owner's account. Choose a URL-prefix property rather than DNS domain verification for the GitHub-owned domain.
2. For Google's HTML-file verification, save the supplied verification file unchanged in `client/public/` and publish it. It will be copied to the property root under `/diploma/`. If using HTML-meta verification instead, add the exact tag supplied by the service to the generated public head in `scripts/build-public-site.cjs`.
3. Submit `https://domalega.github.io/diploma/sitemap.xml` in Search Console. It includes only public canonical pages and their language alternatives, with no app URLs or account data.
4. Inspect the homepage and the two secondary pages in each language, request indexing and monitor crawl/indexing diagnostics. A published sitemap does not guarantee indexing or rankings.

The generated `robots.txt` includes the sitemap address. On project GitHub Pages it lives under `/diploma/robots.txt`; crawlers read `/robots.txt` at the origin root instead. This repository cannot control `https://domalega.github.io/robots.txt`, so submit the sitemap directly. At a custom domain root, the generated file is in the expected location. Account access is still enforced by authentication; `noindex` is not an access-control mechanism.

Yandex Webmaster accepts sites at domain level, rather than a URL-prefix property for `/diploma/`. To use it with the current host, first configure a working `https://domalega.github.io/` homepage and ownership verification at that root through the separate `Domalega.github.io` Pages repository. Verification files under `client/public/` in this project are published under `/diploma/` and do not verify the host root. Alternatively, configure an owned custom domain for this project. After verifying the host in Yandex Webmaster, submit the same full sitemap URL and request recrawling of public pages. Webmaster registration is separate from whether Yandex can discover and index public pages.

To check the public generator locally, run `node --test scripts/build-public-site.test.cjs`. To preview the actual published output, build with the web environment above and serve `client/build` mounted at `/diploma/`, without an SPA fallback: unknown public pages should return 404.

## API deployment

For Render services connected through a public repository URL, deploy the verified commit manually. To use the **Render setup** workflow, set the `RENDER_SETUP_ENABLED` repository variable to `true` and supply the `RENDER_API_KEY` secret (`DATABASE_URL` is also required for a new service). It runs on API changes pushed to `redesign` and verifies GitHub checks before requesting deployment. Confirm `/api/health` returns `{"status":"ok"}` afterward.
