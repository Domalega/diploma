# Daymark

A personal calendar for notes, tasks and reminders. Includes user accounts, search, a month view and a notes list. Optional panels add a to-do list, Kanban board and medication tracker.

End-to-end encryption is an optional setting. Device keys are created automatically; new devices connect after approval from an existing device. Encrypted changes sync while the interface is open. Existing unencrypted server records are retained. See [encryption and device access](docs/ENCRYPTION.md).

[Live demo](https://domalega.github.io/diploma/) · [Android and Windows clients](apps/README.md)

## Tech stack

React 18, Express, Sequelize. SQLite for local use; PostgreSQL for hosting.

## Run locally

Requires **Node.js 22+** and npm. Run commands from the project root.

1. Install dependencies:

   ```sh
   npm run setup
   ```

2. Copy `server/.env.example` to `server/.env` and set `SECRET_KEY` to a random secret:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   The SQLite database is created automatically at `server/data/calendar.sqlite`.

3. Start the API and frontend in separate terminals:

   ```sh
   npm run dev:server
   ```

   ```sh
   npm run dev:client
   ```

4. Open [localhost:3000](http://localhost:3000). The API runs on port `5000`.

For another API address, set `REACT_APP_API_URL` in `client/.env` using `client/.env.example`. PostgreSQL settings are listed in `server/.env.example`.

Local password recovery messages are saved in `server/data/mail/`. Hosted recovery requires the [Google mail setup](integrations/google-mail/README.md).

## Checks

Run `npm test`, `npm run lint` and `npm run build` from the project root. Native client checks are listed in [Device clients](apps/README.md#build).

## Documentation

- [Encrypted storage preparation](docs/ENCRYPTION.md)
- [Device clients and builds](apps/README.md)
- [Android offline storage and sync](docs/OFFLINE_SYNC.md)
- [Android updates and migration](docs/ANDROID_UPDATES.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Roadmap](docs/ROADMAP.md)
