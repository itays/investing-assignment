# Private thresholds are resolved before they reach the Checking System

A Private Rule ("tell me when AAPL drops below what I paid") is resolved by the web server into a plain numeric threshold when it is saved, and the Checking System receives only that number — never a reference to the Holding, and nothing that marks the threshold as private. This keeps the rule contract uniform (every Rule the Checking System sees has the same public shape) and keeps reading Holdings inside this system. The cost is that we, not the Checking System, must notice when a Holding changes and send it a new threshold.

## Considered Options

- **Send a reference and let the Checking System read Holdings** — rejected: it widens the set of systems that read private data, and gives the Checking System a second kind of rule to implement.
