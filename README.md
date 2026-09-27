# Market Desk

Market Desk is a full-stack prototype for a financial-market alerting experience. It is being built around the requirements in [`TASK.md`](./TASK.md): users should be able to define and manage alert rules for market instruments, including rules based on private portfolio data, while safely sharing selected alert information.

The repository currently contains the application foundation for that work. Users can browse and search a catalogue of market instruments, inspect instrument details, select a local demo persona, and switch between light and dark themes.

## Current functionality

- Browse 88 shares, currencies, commodities, ETFs, bonds, and indices
- Filter instruments by symbol or name
- View instrument prices and market metadata
- Select between local demo personas through a cookie-backed session
- Persist the selected colour theme and toggle it from the header or with the <kbd>D</kbd> key
- Exercise core utilities with unit tests and user journeys with Playwright

> [!NOTE]
> Authentication and market data are intentionally local at this stage. The people, holdings, instruments, and prices in `src/data` are fixtures; they are not live financial data.

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

Install [Bun](https://bun.sh/) and clone the repository, then run:

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

To run the browser tests locally, install the Playwright browsers once:

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
| `bun run test:e2e` | Run Playwright tests in Chromium, Firefox, and WebKit |
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
├── lib/               Shared formatting utilities
├── routes/            File-based TanStack Router routes
└── server/            Server functions, catalogue access, and demo sessions
e2e/                   Playwright browser tests
.github/workflows/     Continuous integration workflow
```

TanStack Start server functions provide the boundary between the routes and server-only modules. The instrument catalogue is read from local JSON fixtures, while the selected demo persona is stored in an HTTP-only cookie.

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

## Assignment context

The complete product brief is preserved in [`TASK.md`](./TASK.md). The larger design must account for durable alert storage, rule revisions, private holding-based conditions, idempotent and out-of-order checker events, freshness reporting, revocable public links, and high-traffic shared pages.
