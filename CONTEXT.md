# Market Desk Alerts

People who follow market instruments set up alerts on them, manage those alerts, and can share an alert through a public link. A separate Checking System evaluates the alerts and sends the notifications; this context owns what an alert is and what people see about it.

## Language

### People

**Person**:
Someone signed in to the site; the only kind of identity that can own anything.
_Avoid_: user, account, customer

**Owner**:
The Person an Alert belongs to.
_Avoid_: creator, author

**Visitor**:
Anyone who opens a Shared Link — signed in or not, the Owner included. Every Visitor sees the same thing.
_Avoid_: guest, viewer, public user

### Market

**Instrument**:
One tradable thing — a share, currency pair, commodity, index, ETF or bond — named by exactly one Symbol.
_Avoid_: ticker, asset, security, stock

**Symbol**:
The unique name of an Instrument, such as `AAPL` or `EUR/USD`.
_Avoid_: ticker, code

**Holding**:
What a Person owns of one Instrument: the quantity and the Price Paid. Private to that Person.
_Avoid_: position, portfolio entry

**Price Paid**:
The price a Person paid for a Holding. Private.
_Avoid_: cost basis, entry price, buy price

**Today's Open**:
An Instrument's first price of the current day, where the Checking System decides when each Instrument's day starts.
_Avoid_: day start price, previous close

### Alerts

**Alert**:
An Owner's standing request to be told when a Rule matches on one Instrument. The Instrument never changes for the life of the Alert; an Owner can have any number of Alerts on the same Instrument.
_Avoid_: notification, watch, trigger

**Alert Title**:
An optional name the Owner gives an Alert to find it among many. Private: it is owner-written text, so it never appears on a Shared Link.
_Avoid_: label, name, note

**Rule**:
The condition an Alert watches for, of exactly one Rule Kind.
_Avoid_: condition, criteria, filter

**Rule Description**:
The Rule in words, generated from the Rule itself — never from anything the Owner typed. It is the only description of an Alert a Shared Link shows.
_Avoid_: summary, title

**Rule Kind**:
What a Rule compares. **Price**: the Instrument's price goes above or below a threshold — either a price the Owner enters or the Owner's Price Paid. **Percentage**: the Instrument's price rises or falls by a given percentage from Today's Open.
_Avoid_: alert type

**Private Rule**:
A Rule whose threshold comes from the Owner's Holding — a Price Rule set at the Owner's Price Paid. It follows the Holding: a new Price Paid makes a new Rule Revision. An Alert with a Private Rule can never have a Shared Link.
_Avoid_: price-paid alert, holding alert

**Rule Revision**:
The version of an Alert's Rule. Every change to the Rule — by the Owner, or a new Price Paid behind a Private Rule — makes the next Rule Revision and starts the Alert's Match history over.
_Avoid_: version, rule version

**Active** / **Paused**:
Whether the Alert should currently be checked. The Owner pauses and resumes an Alert; an Alert is also Paused automatically when the Holding behind its Private Rule is gone. Pausing never makes a new Rule Revision.
_Avoid_: enabled/disabled, on/off, armed

**Match**:
The Checking System's report that one Rule Revision's condition became true at a moment, with the price at that moment. A Rule matches each time its condition becomes true, not continuously while it stays true; if the condition already holds on the first check after the Rule is saved or resumed, that counts as becoming true.
_Avoid_: trigger, fire, hit

**Match After Pause**:
A Match whose moment falls after the Owner paused the Alert — the Checking System had not applied the pause yet. It is shown as what the Checking System reported, never as something the Owner was told about.
_Avoid_: late match (a late Match is any Match that arrives after its moment)

**Checked-through**:
The moment up to which every Alert on an Instrument has been checked against every price. It only moves forward.
_Avoid_: last checked, heartbeat, last update

**Stale**:
An Instrument whose Checked-through is more than 60 seconds old; what is shown about its Alerts may be missing recent Matches. The opposite is **Current**.
_Avoid_: offline, down, outdated

**Not Yet Checked**:
An Alert whose current Rule Revision is not known to be covered by its Instrument's Checked-through, so nothing can be said yet about whether the new Rule has matched — including "no matches".
_Avoid_: awaiting first check, pending, submitted

**Checking System**:
The separate system that evaluates Rules against prices, reports Matches and Checked-through, and sends the notifications.
_Avoid_: engine, evaluator, matcher

**Shared Link**:
A public, unguessable link to one Alert without a Private Rule, showing only that Alert's public information. Once the Owner stops sharing, the link is dead for good; sharing again makes a new link.
_Avoid_: share, public link, permalink
