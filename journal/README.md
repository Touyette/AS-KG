# Your notes

This folder is yours. Nothing else in this project writes here, and nothing here
is ever committed, uploaded or published — `.gitignore` keeps the whole folder
out of git except this readme, so the folder ships with the package and arrives
empty.

It is plain text. Read it, edit it, rewrite it, delete any of it at any time.
Deleting a file is the whole of deleting it; there is no other copy.

## What goes in it

```
journal/
  README.md        this file — the only part that is committed
  profile.md       what has landed, what hasn't, what you're trying
  sessions/
    2026-09-12.md  what was actually talked about, one file per conversation
```

**`profile.md`** is mostly pointers into the graph — which ideas fitted, which
didn't, what you're working on. It's the cheap way to pick up where you left off
without going back through everything.

**`sessions/`** is the conversation itself, summarised. More personal, and only
read if you ask for it.

## How an assistant is meant to treat it

These are rules, not suggestions. They're in `AGENTS.md` too.

**Nothing is written unless you're asked.** Once, at the end, plainly: *"do you
want me to keep a short note of this so we can pick it up next time?"* No answer
means nothing is written. Nothing is ever written mid-conversation.

**Nothing is read unless you're asked.** At the start it can *check* whether
entries exist — `node tools/journal.mjs --check` reports how many and when,
without opening them — and then ask: *"I found notes from before. Read them, or
start fresh?"* Starting fresh is a real option and picking it has no cost.

**It records what you said, not what the assistant concluded.** "She said the
volume-going-down description fitted" is a note. "Dismissive-avoidant" is a
verdict and doesn't get written. No styles, no scores, no percentages.

**Everything is dated, and old notes are read as old.** Anything more than a
couple of months back gets treated as where you were then, not where you are.
People change; a file doesn't.

**It comes back as a question.** *"Last time the avoidant material seemed to
fit — is that still how it looks from where you are now?"* Never as a settled
fact.

## The shape of the files

`profile.md` — every line dated, and in your words where possible:

```markdown
# Working notes

## What has landed
- 2026-09-12 · Deactivating Strategies — "that's it, the volume going down"
- 2026-09-12 · Radical Self-Responsibility — didn't fit; felt like a choice, not a reflex

## What I'm trying
- 2026-09-12 · Naming The Feeling Accurately — before bringing anything up

## Open questions
- 2026-09-12 · whether the going-quiet started when things were going well
```

`sessions/YYYY-MM-DD.md`:

```markdown
# 2026-09-12

**What I brought.**
**What we established.**
**What was offered, and how it landed.**
**Where we left it.**
```

## What this is not

It isn't a record anyone is watching, and it isn't a safeguard. If something
difficult or frightening comes up, the answer is a person — a therapist, a
service, someone who can hold the whole of it — not a file and not an assistant.
