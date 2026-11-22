# Deployment

English · [Русский](ru/DEPLOYMENT.md)

Jotstride uses GitHub Pages for the website, Render for the API and PostgreSQL for hosted data. Set up the API first so you have its address when you build the frontend.

## Publish the site and API

1. Create a PostgreSQL database and deploy the API service using [`render.yaml`](../render.yaml). Set `DATABASE_URL` on Render. The Blueprint can generate `SECRET_KEY`, or you can supply your own random value. The API checks `CLIENT_ORIGIN` against the frontend origin. Change it if you use your own domain.
2. If the hosted site needs password recovery, set up [Google Apps Script mail](../integrations/google-mail/README.md).
3. In the GitHub repository, open **Settings → Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. In **Settings → Secrets and variables → Actions**, open the **Variables** tab and select **New repository variable**. Create `REACT_APP_API_URL` with the API's HTTPS address ending in `/api`.
5. Push to `redesign`. In the **Actions** tab, wait for **Checks** to build and publish the site.
6. Confirm the API's `/api/health` returns `{"status":"ok"}`. Open the published site and check that the app can reach the API.

## Build and preview the website

The [**Checks** workflow](../.github/workflows/ci.yml) uses the following settings for the project site.

| Variable            | Value                                             |
| ------------------- | ------------------------------------------------- |
| `PUBLIC_URL`        | `/diploma`                                        |
| `REACT_APP_ROUTER`  | `hash`                                            |
| `DAYMARK_SITE_URL`  | `https://domalega.github.io/diploma/`             |
| `REACT_APP_API_URL` | The deployed API's HTTPS address ending in `/api` |

With these values in your environment, run `npm run build` from the repository root. Serve `client/build` at `/diploma/` without an SPA fallback. A public URL that doesn't exist should return 404. To check the generator on its own, run:

```sh
node --test scripts/build-public-site.test.cjs
```

For a custom domain, configure the domain in GitHub Pages. Set `DAYMARK_SITE_URL` to the full HTTPS site address and `PUBLIC_URL` to its path, or `/` for a site at the domain root. Keep hash routing for the published app and update `CLIENT_ORIGIN` and the password reset URL for the new domain.

### What the build publishes

The build generates three Russian pages at `/diploma/`, `/diploma/features/` and `/diploma/download/`, with English versions under `/diploma/en/`. Content, metadata, canonical URLs, language links and WebSite/WebPage structured data are available without JavaScript. Edit website copy in [`client/site/content.cjs`](../client/site/content.cjs) and styles in [`client/site/site.css`](../client/site/site.css).

The calendar opens at `/diploma/app.html#/calendar`. The app page has `noindex`, and authentication controls access to accounts. The homepage forwards old hash links, including password reset and device connection links, to `app.html` with their full fragment intact. Browser storage stays on the same origin.

The development server keeps the React interface as the entry point. Android bundles it as `index.html` with `PUBLIC_URL=.`. Browser-router builds and the Android bundle skip the public pages.

## Search indexing

### Google Search Console

1. Add `https://domalega.github.io/diploma/` as a URL-prefix property. This lets you verify the project path without control of the `github.io` domain.
2. If you choose HTML-file verification, put the file Google supplies in `client/public/` and publish it unchanged. It will be served under `/diploma/`. For HTML-tag verification, use the exact tag from Google in the public page head in [`scripts/build-public-site.cjs`](../scripts/build-public-site.cjs).
3. Submit `https://domalega.github.io/diploma/sitemap.xml`. The sitemap lists only public canonical pages and their language alternatives. Inspect the home, features and download pages in both languages. You can request indexing and track it in Search Console, but submission alone doesn't guarantee indexing or ranking.

GitHub Pages serves the generated `robots.txt` under `/diploma/`. Crawlers look for it at the origin root, which this repository doesn't control. Submit the sitemap directly. On a custom domain with the site at its root, the generated file is already in the right place.

### Yandex Webmaster

Verify the host where the website is published. For the project URL, verify `https://domalega.github.io/` through the separate `Domalega.github.io` Pages repository and keep a working homepage there. Files in this project's `client/public/` are served below `/diploma/`, so they can't verify the host root. You can also verify your own custom domain.

Once verified, submit the full sitemap URL and request a recrawl of the public pages. Yandex can discover public pages independently of Webmaster registration. [Yandex Webmaster setup](https://www.yandex.com/support/webmaster/en/service/quick-start)

## API deployment

If Render uses a public repository URL for the service, deploy the verified commit manually or use the [**Render setup** workflow](../.github/workflows/render-setup.yml). Enable the workflow with the `RENDER_SETUP_ENABLED=true` repository variable and the `RENDER_API_KEY` secret. Add the `DATABASE_URL` secret if the workflow needs to create the service. To configure mail through the workflow, supply both `GOOGLE_MAIL_URL` and `GOOGLE_MAIL_SECRET`.

On API changes pushed to `redesign`, the workflow waits for the GitHub verification job to pass and then requests a Render deployment for that commit. After deployment, check `/api/health` for `{"status":"ok"}`. [Render deployment modes](https://render.com/docs/deploys)
