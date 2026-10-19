# Deployment

The hosted setup uses GitHub Pages for the frontend, Render for the API and PostgreSQL for storage.

1. Create a PostgreSQL database and set `DATABASE_URL` in Render.
2. Deploy the API using `render.yaml`. Set a random `SECRET_KEY` and configure [password recovery](../integrations/google-mail/README.md) if needed.
3. Enable GitHub Pages with GitHub Actions. Set the repository variable `REACT_APP_API_URL` to the API's HTTPS address ending in `/api`.

The **Checks** workflow publishes the frontend from `redesign` after tests pass. Pages uses hash routes such as `/diploma/#/calendar`.

For Render services connected through a public repository URL, deploy the verified commit manually. To use the **Render setup** workflow, set the `RENDER_SETUP_ENABLED` repository variable to `true` and supply the `RENDER_API_KEY` secret (`DATABASE_URL` is also required for a new service). It runs on API changes pushed to `redesign` and verifies GitHub checks before requesting deployment. Confirm `/api/health` returns `{"status":"ok"}` afterward.
