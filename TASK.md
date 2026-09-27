# Alerts

## Before you start

Use AI. We expect you to, and we give you an account so it costs you nothing. Two things we
ask about that account: work with Sonnet or Opus, not Fable, and leave credit billing off.
The account works in five-hour usage windows, and this exercise is meant to fit inside one.

We read the session transcripts too — we like seeing how somebody works with an agent. Step 3
says how to collect them.

## Where this sits

We run a financial markets site used by millions of people around the world. They follow
instruments — shares, currencies, commodities like gold and oil, crypto — listed on dozens of
exchanges, and they read the site in many languages.

Prices move all day. Traffic is not flat: it climbs when a big market opens and when news
breaks, and it never fully stops, because somewhere a market is always open.

People already keep lists with us — the instruments they own, and the instruments they only
follow. What somebody owns, and the price they paid for it, is private.

We expect to hold about a hundred thousand alerts, and we expect them to crowd together:
most sitting on a handful of popular instruments — the S&P 500, Bitcoin, EUR/USD, Tesla —
whose prices change many times a second.

## What we want to build

People who follow an instrument want to be told when something happens to it. Each person
decides for themselves what "something" means — for example, this price falling 5% from where
it started the day. How they express that is your decision.

**You are designing the web application**: the browser side and the web server behind it —
how a person creates and manages their alerts, and what they and other people see. Another
team builds the part that checks those alerts and sends the notifications.

The alerts do not exist yet.

It has to:

- let a person set up an alert, change it, pause it, or delete it;
- let a rule use something private to that person, not only the price everybody can see —
  "tell me when this drops below the price I paid for it". We hold what each person owns and
  what they paid;
- show each alert: whether it is on, when it last matched, and how recently its instrument
  was checked. Changing a rule starts its match history over;
- work for a person who has hundreds of alerts of their own;
- let an owner share some of their alert information through a public link, and keep the
  rest private;
- never expose the owner's private information through a shared link — not to a visitor, and
  not to the owner opening their own link;
- let an owner stop sharing, after which the link stops working;
- serve a popular shared link to thousands of visitors in the same minute, with most of that
  traffic landing on a few links;
- keep working when the checking system is down or delayed, without showing anybody
  something misleading.

## What the checking system sends you

All of that rests on one input. Everything you show comes from the checking system, one
message at a time — you never see the price feed, and the only price that reaches you is the
one that matched. There are two kinds of message, one about an alert and one about an
instrument:

```json
{"event_id": "evt_004413", "alert_id": "a-4417", "rule_revision": 7,
 "matched_at": "2026-08-24T09:30:58.004Z", "price": 316.46}
{"event_id": "evt_004412", "symbol": "AAPL", "checked_through": "2026-08-24T09:31:02.118Z"}
```

The second one says every alert on that instrument has been checked against every price up
to that moment. While the checking system is working normally it arrives every few seconds for
each instrument somebody has an alert on, whether or not anything matched.

How that system behaves:

- the same message can arrive more than once. Two messages with the same `event_id` say the
  same thing;
- messages can arrive late, and out of the order the events happened in;
- `rule_revision` is the version of the rule that matched. You give it to the checking system
  when you save a rule, and a match for an old version can still arrive after you change it;
- the one exception to that: a `checked_through` time only moves forward once everything up
  to it has been checked, and it reaches you only after the matches it covers;
- the checking system can go quiet for a long time and then deliver everything it held back
  at once;
- a symbol names one instrument in our system;
- these two messages are everything it sends.

## 1. Design it

Pick your stack. Write your design.

Write it in whatever form suits you. We have no template, and we do not count
pages.

Name the parts and what passes between them. Say what happens when the web server restarts,
when the checking system delivers a large batch after a quiet spell, when the same message
arrives twice, and when one shared link takes most of your traffic.

You do not have to build any of it in this step.

Where you chose one option over another, say briefly why.

Say which part you would build first, and why. Step 2 names one for you — if it is not the
part you would have chosen, say so.

## 2. Build one part of it

We give you a scaffold so you can skip the setup. Its stack is only a starting point, not
the stack we expect you to pick. Change it, replace it, or ignore it.

Build this part: **writing a rule.** A person creates an alert, changes it, and pauses it,
including a rule that refers to what they hold. How a person expresses the rule is your
decision.

Build the whole path, from the browser to somewhere the alert is kept. A person who comes
back finds the same alerts they left.

Include the steps to run it.

## 3. Send us your work

Your design, your code, and the transcripts of the sessions you ran here.

**The transcripts.** Claude Code writes them as it goes: a `<session-id>.jsonl` file per
session, and a `<session-id>/` folder next to it holding the transcripts of any subagents that
session ran. We want both, for every session you worked in.

They usually live under `~/.claude/projects`, in an entry named after the folder the agent ran
in. From the repository, in a macOS or Linux shell, this normally collects them:

```bash
mkdir -p transcripts
cp -R ~/.claude/projects/"$(pwd | tr '/.' '--')"/. transcripts/
```

There is one entry per folder, so if you ran the agent from more than one place — a subfolder,
a worktree, a second copy of the repository — there is an entry for each, and we want them
all. If your setup keeps them elsewhere, or that path is not there, they are somewhere else on
your machine: find them, or ask the agent to — *put every session transcript for this project,
subagent transcripts included, in ./transcripts*. On Windows, ask the agent for the commands
that suit your shell.

That folder holds a little more than the transcripts: cached tool output, and the paths on
your machine the agent worked in. Look through it before you send it, and take out anything
you would rather we did not read.

**The pack.** Commit everything, then pack the repository into one file:

```bash
git add -A && git commit -m "Submission" \
  && git bundle create ../fullstack-submission.bundle --all
```

If git says there is nothing to commit, you are already clean — run the `git bundle` line on
its own.

A bundle is your repository in one file: every commit you made, and nothing git does not
track, so `node_modules`, build output, and your machine's own files stay behind. Anything you
did not commit does not travel.
