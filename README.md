# Daymark

A personal calendar with user accounts, password recovery, multiple notes per day, optional local times, search, a month view and a notes list. Each note can be edited, moved to another day or deleted individually. Browser reminders respect note times while the calendar is open.

The theme follows your device by default. Choose System, Light, or Dark on the sign-in page or in calendar Settings; your preference is saved in your browser.

Enable **Settings → Experimental options → Medication tracker** to create a personal intake table. Add medications, intake times and repeating weekdays, with optional course dates. Mark individual cells or a whole time column; completing a column plays a short animation. Previous marks remain when a schedule is changed or disabled. Optional reminders use your device's local clock and work while the calendar is open.

[Live demo](https://domalega.github.io/diploma/) · [API health](https://diploma-api-zozr.onrender.com/api/health)

## Background

Originally created as a graduation thesis project. It is now being revisited to improve the code structure and make it easier to maintain.

## Tech stack

- **Frontend:** React 18, React Router, React Bootstrap, React Icons, native date handling.
- **Backend:** Node.js, Express, Sequelize, JWT, bcrypt.
- **Database:** SQLite for local use; PostgreSQL is also supported.
- **Email:** Google Apps Script for password recovery.

## Run locally

Requires **Node.js 22+** and npm. Run all commands from the project root.

1. Install dependencies:

   ```sh
   npm run setup
   ```

2. Copy `server/.env.example` to `server/.env`. Replace `SECRET_KEY` with a random secret, which you can generate with:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   SQLite is configured in the example. Its database file is created automatically at `server/data/calendar.sqlite`; no database server is required.

3. Start the API and frontend in separate terminals:

   ```sh
   npm run dev:server
   ```

   ```sh
   npm run dev:client
   ```

4. Open [http://localhost:3000](http://localhost:3000). The API runs on port `5000`.

For a different API address, copy `client/.env.example` to `client/.env`, update `REACT_APP_API_URL`, and restart the frontend. To use PostgreSQL, set `DB_DIALECT=postgres` and provide the connection settings listed in `server/.env.example`.

Local password recovery messages are saved in `server/data/mail/`. Open the link from the generated JSON file to test recovery. Hosted recovery requires the [Google mail setup](integrations/google-mail/README.md); without it, recovery is shown as unavailable.

### Deploy from `redesign`

The hosted setup uses GitHub Pages for the frontend, Render for the API, and Neon PostgreSQL for storage.

1. Create a Neon database and set its connection URL as `DATABASE_URL` in Render.
2. Deploy the API using `render.yaml` with a random `SECRET_KEY`. Use the free plan; PostgreSQL connections use verified TLS.
3. Enable GitHub Pages with GitHub Actions and set the repository variable `REACT_APP_API_URL` to the API's HTTPS address ending in `/api`.

Successful checks on `redesign` publish the frontend. For Render services connected through a public repository URL, deploy the latest commit manually after checks pass; automatic API deployments require a connected Git provider. Pages uses hash routes such as `/diploma/#/calendar`; SQLite remains available for local development.
