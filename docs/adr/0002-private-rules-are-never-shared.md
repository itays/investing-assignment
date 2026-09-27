# Alerts with a Private Rule can never have a Shared Link

Anything a Shared Link shows about a Private Rule leaks the Holding: the price in a Match is roughly the Price Paid, the time of a Match together with the public price history gives it away just as well, and even "a private condition on AAPL" tells a Visitor that the Owner holds AAPL — ownership is itself private. So an Alert with a Private Rule cannot be shared at all, rather than being shared in a redacted form. The Checking System does receive the resolved threshold (ADR-0001), but it is an internal system; a Shared Link is a different audience.

The public view is built from data that cannot include Holdings, and it renders the same for every Visitor, the Owner included — there is no "the Owner is looking" branch.

## Considered Options

- **Share redacted** (Instrument and "a private condition", no times or prices) — rejected: still reveals ownership.
- **Share the Match time only** — rejected: the time plus public prices reveals the Price Paid.
