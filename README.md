# Market Desk

Market Desk is a full-stack prototype for a financial-market alerting experience. It is being built around the requirements in [`TASK.md`](./TASK.md): users should be able to define and manage alert rules for market instruments, including rules based on private portfolio data, while safely sharing selected alert information.

Step 2 is built: a signed-in Person can create, edit, pause, resume and delete Alerts on any Instrument, and the Alerts are kept in a local SQLite database. Terms such as Alert, Owner, Rule, Private Rule and Rule Revision are defined in [`CONTEXT.md`](./CONTEXT.md).

## Current functionality

- Browse 88 shares, currencies, commodities, ETFs, bonds, and indices
- Filter instruments by symbol or name
- View instrument prices and market metadata
- Create an Alert from `/alerts` or with "Create alert" on an Instrument page, choosing one Rule:
  - **Price**: the Instrument goes above or below a price you type
  - **Price, at what you paid** (a Private Rule): offered only for an Instrument you hold
  - **Percentage**: the Instrument rises or falls by N% from Today's Open
- Give an Alert an optional, private Alert Title
- Search, filter and sort your Alerts; edit, pause, resume and delete them
- See every Alert as "Not yet checked", because no Checking System is connected yet
- Select between local demo personas through a cookie-backed session
- Persist the selected colour theme and toggle it from the header or with the <kbd>D</kbd> key
- Exercise core utilities with unit tests and user journeys with Playwright

> [!NOTE]
> Authentication and market data are intentionally local at this stage. The people, holdings, instruments, and prices in `src/data` are fixtures; they are not live financial data.

> [!WARNING]
> Sign-in is the scaffold's demo persona cookie. It is unsigned and stands in for the site's real session; it is not authentication. Anyone can pick any persona, so do not treat it as access control. The server still scopes every Alert operation to the Owner in that session.

## Tech stack

- [TanStack Start](https://tanstack.com/start) and [TanStack Router](https://tanstack.com/router)
- React 19 and TypeScript
- Tailwind CSS 4 and [shadcn/ui](https://ui.shadcn.com/)
- Bun
- Vitest for unit tests
- Playwright for browser tests
- Biome, Husky, and lint-staged for code quality

## Getting started

### Prerequisites

Install [Bun](https://bun.sh/) and [Node.js](https://nodejs.org/) 22.13 or newer (`.nvmrc` pins 24). Bun installs packages and runs scripts, but Vite and Vitest run on Node, and Alerts use Node's built-in `node:sqlite`.

Clone the repository, then run:

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in as Ava Morgan or Liam Chen, and choose **Alerts** in the header. Ava holds AAPL, EUR/USD and SHIB/USD, so she is offered "What I paid" on those; Liam holds US500 and BTC/USD.

### The database

Alerts are stored with SQLite (`node:sqlite`) in `data/alerts.db`. The file and its tables are created on first start; there is no setup step. Delete the file (or the `data/` folder) to start over. Set `DATABASE_PATH` to use a different file:

```bash
DATABASE_PATH=/tmp/alerts.db bun run dev
```

### Tests

`bun run test` runs the Vitest unit suite, including the Alerts domain module against an in-memory database.

The browser tests build the app and serve the production build on port 3100 with `DATABASE_PATH=data/e2e-alerts.db`, so they never touch your dev data. Rebuild (or stop any server left on port 3100) after changing code, since a running server there is reused. To run them locally, install the Playwright browsers once:

```bash
bunx playwright install
```

## Available commands

| Command | Description |
| --- | --- |
| `bun run dev` | Start the development server on port 3000 |
| `bun run build` | Create a production build |
| `bun run preview` | Preview the production build locally |
| `bun run test` | Run the Vitest unit suite |
| `bun run test:e2e` | Run Playwright tests in Chromium, Firefox, and WebKit (production build on port 3100) |
| `bun run test:e2e:headed` | Run Chromium browser tests in headed mode |
| `bun run test:e2e:ui` | Open Playwright's interactive test runner |
| `bun run lint` | Lint the project with Biome |
| `bun run format` | Format the project with Biome |
| `bun run check` | Check formatting, lint rules, and imports with Biome |
| `bun run typecheck` | Type-check the project without emitting files |

## Project structure

```text
src/
├── components/        Reusable application and shadcn UI components
├── data/              Local instrument and holding fixtures
├── lib/               Shared formatting utilities and the Rule schema
├── routes/            File-based TanStack Router routes
└── server/            Server functions, the Alerts domain module, and demo sessions
data/                  SQLite database, created on first start (gitignored)
docs/                  Design, ADRs, and step specs
e2e/                   Playwright browser tests
.github/workflows/     Continuous integration workflow
```

TanStack Start server functions provide the boundary between the routes and server-only modules. The instrument catalogue is read from local JSON fixtures, while the selected demo persona is stored in an HTTP-only cookie. The server functions take the Owner from that session, never from the request.

## Quality checks

The GitHub Actions workflow runs formatting, linting, type-checking, unit tests, a production build, and the Chromium browser suite. The same checks can be run locally before opening a pull request:

```bash
bun run check
bun run typecheck
bun run test
bun run build
bun run test:e2e:ci
```

A Husky pre-commit hook also runs staged-file checks, type-checking, and unit tests.

## What's built and what isn't

Step 2 covers writing a Rule; the scope is [`docs/design.md` §11](./docs/design.md#11-step-2-what-is-built) and the details are in [`docs/specs/step-2-writing-a-rule.md`](./docs/specs/step-2-writing-a-rule.md).

- **Built:** creating, editing, pausing, resuming and deleting Alerts; Price, Private and Percentage Rules; Rule Revisions and stale-edit protection; the rule-message outbox for the Checking System (written, not yet published); and the public projection that Shared Links will use.
- **Not built:** publishing the outbox, receiving Matches, Checked-through and freshness, Shared Link pages and revocation, and the Holdings worker. Until those exist, every Alert shows "Not yet checked" and no Matches.

## Assignment context

The complete product brief is preserved in [`TASK.md`](./TASK.md). The larger design must account for durable alert storage, rule revisions, private holding-based conditions, idempotent and out-of-order checker events, freshness reporting, revocable public links, and high-traffic shared pages.
