---
format: https://specscore.md/idea-specification
status: Implementing
---

# Idea: GreetBot — the reference iframe demo bot

**Status:** Implementing
**Date:** 2026-07-23
**Owner:** alex
**Promotes To:** —
**Supersedes:** —
**Related Ideas:** —

## Problem Statement

The Chatwright bot protocol and federation model need a living proof: a
bot anyone can read in one sitting that demonstrates the iframe transport,
the `CHATWRIGHT.md` manifest, the registry, and the badge — without a
framework or build step hiding what actually happens on the wire.

## Context

Decision 0012 in the standard repository fixes the black-box bot contract
(platform-native payloads; iframe `postMessage` envelope per
`https://chatwright.dev/formats/bot-protocol/v1`); decision 0013 fixes the
manifest and registry. GreetBot is the first implementation of both: live
on GitHub Pages, registered as the federation registry's first entry, and
the official implementation of the `language-onboarding` recipe in
chatwright/recipes.

## Recommended Direction

- Plain hand-written JavaScript, no framework, no build step, no
  dependencies — the repository doubles as teaching material.
- Platform-neutral conversation logic in `shared/greet.js` (pure
  functions); one adapter directory per platform (`telegram/` now;
  WhatsApp, Viber, Slack later), mirroring the ecosystem's
  platform-neutral-core convention.
- `CHATWRIGHT.md` declares one `bots[]` entry per platform; versions follow
  the tag-is-release rule.
- `harness.html` proves the protocol end to end without the runtime.

## Alternatives Considered

- **Build GreetBot with a bot framework.** Rejected: a framework would hide
  the envelope and payloads this repository exists to teach.
- **Keep it Telegram-only.** Rejected (founder, 2026-07-23): the structure
  must show how one conversation serves many platforms.

## MVP Scope

Shipped 2026-07-23: the Telegram adapter (language onboarding with inline
buttons and in-place edit), Pages hosting, manifest v0.1.1 with
`implements`/`jobs`, registry entry with cache snapshot, live browser proof
of the handshake and call/result exchange.

## Not Doing (and Why)

- **Additional platforms now** — each adapter lands with its platform's
  browser-runtime codec, so demos stay executable, never prose-only.
- **AI behaviour** — GreetBot stays deterministic; AI actors are the
  runtime's concern, not the demo bot's.

## Key Assumptions to Validate

| Tier | Assumption | How to validate |
|---|---|---|
| Must-be-true | A newcomer can implement the bot side of the protocol from this repository alone | First community iframe bot that cites GreetBot as its starting point |
| Should-be-true | The shared-logic/adapter split survives a second platform without rework | The WhatsApp adapter lands without touching `shared/greet.js` |

## SpecScore Integration

- **Existing Features affected:** none in this repository — product-level
  features live in the standard repository's tree
  (chatwright/playground, chatwright/platform-emulators).

## Open Questions

- None at this time.

*This document follows the https://specscore.md/idea-specification*
