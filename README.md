# Daymark

A personal calendar with user accounts, password recovery, multiple notes per day, optional local times, search, a month view and a notes list. Each note can be edited, moved to another day or deleted individually. Browser reminders respect note times while the calendar is open.

Sign-in is remembered in the browser for 30 days and renewed when the calendar opens. Signing out clears the saved session; resetting a password invalidates previous sessions.

The theme follows your device by default. Choose System, Light, or Dark on the sign-in page or in calendar Settings; your preference is saved in your browser.

The interface supports English and Russian. The language follows your browser by default; choose System, Russian, or English on the sign-in page or in Settings. Your choice is saved in the browser.

The calendar, current date, notes and medication tracker use independent tiles. Choose **Arrange panels** to drag tiles into open space or resize them using a side, bottom edge or corner. Neighbouring tiles automatically make room. Focused handles support arrow keys; Escape cancels a drag. Positions and sizes are saved in your browser; **Reset layout** restores the defaults. Smaller screens use a separate adaptive arrangement and preserve desktop widths.

Enable **Settings → Experimental options → Medication tracker** to create a personal intake table. Add medications, intake times and repeating weekdays, with optional course dates. By default, tall tiles show compact intake buttons and wide tiles show the medication table. In **Arrange panels**, choose **Auto**, **Table**, or **Buttons**; your choice is saved in the browser. Mark individual cells or all medications at a time using its heading; completing a time slot plays a short animation. Previous marks remain when a schedule is changed or disabled. Optional reminders use your device's local clock and work while the calendar is open.

Enable **Settings → Experimental options → Kanban board** for a separate task tile. Start with To do, In progress and Done; add, rename, reorder or hide any column and set work-in-progress limits. Drag cards between stages or use the stage selector and reorder buttons. Optional task dates appear in the calendar. Completed tasks remain in Done and History, can be reopened, and retain an activity log. Board data is saved to your account; hiding columns or disabling the tile preserves it. Tasks are currently separate from notes and do not send reminders.

Enable **Settings → Experimental options → To-do list** for a movable, resizable checklist. Enter adds a task and keeps the input ready for the next one; pasting several lines adds one task per nonempty line. Check a task to strike it through, or uncheck it to reopen it. Tasks can be edited or deleted. The list is saved to your account, with revision checks for concurrent edits; disabling the tile preserves its tasks. Failed saves preserve your draft.

[Live demo](https://domalega.github.io/diploma/) · [API health](https://diploma-api-zozr.onrender.com/api/health)

Optional [Android and Windows clients](apps/README.md) save reminders on the device. Scheduled alerts do not require an open browser, notification server, or paid hosting. The calendar UI and synchronization still use the hosted website and API. Preview builds are available in [Releases](https://github.com/Domalega/diploma/releases).

## Background

Originally created as a graduation thesis project. It is now being revisited to improve the code structure and make it easier to maintain.

The [roadmap](docs/ROADMAP.md) describes the experimental board and future integration.

## Tech stack

- **Frontend:** React 18, React Router, React Bootstrap, React Icons, [React Grid Layout core](https://github.com/react-grid-layout/react-grid-layout) for collision handling, native date handling.
- **Backend:** Node.js, Express, Sequelize, JWT, bcrypt.
- **Database:** SQLite for local use; PostgreSQL is also supported.
- **Email:** Google Apps Script for password recovery.
- **Device clients:** Android Java/WebView with AlarmManager; Windows .NET 8/WPF/WebView2 with scheduled system notifications and a local refill task.

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
