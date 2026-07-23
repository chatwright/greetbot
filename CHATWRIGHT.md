---
format: https://chatwright.dev/formats/chatwright-md/v1
id: greetbot
name: GreetBot
version: 0.1.0
authors:
  - github: chatwright
platforms: [telegram]
bots:
  - id: telegram
    platform: telegram
    transport: iframe
    url: https://chatwright.github.io/greetbot/telegram/
    capabilities:
      - messaging.buttons.inline
      - messaging.message.edit
demos:
  - bot: telegram
    title: Language onboarding
---

# GreetBot

The first real [Chatwright](https://github.com/chatwright/chatwright) iframe
demo bot: a tiny language-onboarding conversation. No framework, no build
step, no dependencies — this repository is the proof that the
[iframe bot protocol](https://github.com/chatwright/chatwright/blob/main/formats/bot-protocol/v1/README.md)
is trivial to implement directly.

## About

`/start` offers a language choice as an inline keyboard. Picking a language
edits that same message in place — translating it to the chosen language —
rather than sending a new one, and is remembered for the rest of the chat.
Any other message is greeted in the chat's current language.

The conversation itself lives once, in [`shared/greet.js`](shared/greet.js),
as platform-neutral pure functions with zero protocol or platform-API code.
Each platform gets its own thin adapter directory that translates that
platform's native updates into calls into `shared/greet.js`, and the
returned intents back into that platform's own API calls:

| Platform | Adapter | Status |
|---|---|---|
| Telegram | [`telegram/`](telegram/) | Live |
| WhatsApp | `whatsapp/` | Planned |
| Viber | `viber/` | Planned |
| Slack | `slack/` | Planned |

`bots[]` above carries one entry per live adapter; a new adapter directory
adds a new `bots[]` entry rather than replacing this one.

## Demo

The Telegram adapter ([`telegram/`](telegram/)) is a `transport: iframe`
bot: it performs the [handshake](https://github.com/chatwright/chatwright/blob/main/formats/bot-protocol/v1/README.md#handshake--the-bot-speaks-first)
with `window.parent`, then speaks Telegram Update/call/result envelopes
exclusively over the `MessagePort` it receives. Try it in Chatwright via the
badge in [README.md](README.md), or drive it by hand with
[`harness.html`](harness.html) — a minimal local host that performs the
handshake and lets you send `/start` and click the first language button.

## Running locally

No build step. Serve the repository root with any static file server, e.g.:

```sh
npx serve .
# or: python3 -m http.server
```

Then open `harness.html` in a browser — it loads `telegram/` in an iframe
and plays the host side of the protocol by hand.

## Trade-offs

- **No framework, no build step, no dependencies** — deliberate. This
  repository exists to prove the protocol is simple enough to hand-write
  against, not to demonstrate a nice bot SDK. A real bot repository is free
  to use one.
- **`harness.html` is a local dev tool, not a protocol reference.** It
  accepts any origin and emulates only the two Telegram methods this bot
  calls — real hosts (the Chatwright runtime) validate origin against this
  manifest and emulate the platform faithfully.
- **Shared logic returns intents, not platform calls.** `shared/greet.js`
  never touches `sendMessage`/`editMessageText` directly, trading a small
  indirection for genuine reuse across future adapters.
