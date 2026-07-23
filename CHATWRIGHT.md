---
format: https://chatwright.dev/formats/chatwright-md/v1
id: greetbot
name: GreetBot
version: 0.2.0
authors:
  - github: chatwright
platforms: [telegram, whatsapp]
bots:
  - id: telegram
    platform: telegram
    transport: iframe
    url: https://chatwright.github.io/greetbot/telegram/
    capabilities:
      - messaging.buttons.inline
      - messaging.message.edit
  - id: whatsapp
    platform: whatsapp
    transport: iframe
    url: https://chatwright.github.io/greetbot/whatsapp/
    capabilities:
      - messaging.text
implements:
  - recipe: language-onboarding
    platform: telegram
    tier: official
  - recipe: language-onboarding
    platform: whatsapp
    tier: alternative
jobs: [onboard-users-in-their-language]
demos:
  - bot: telegram
    title: Language onboarding
  - bot: whatsapp
    title: Language onboarding (numbered replies)
---

# GreetBot

The first real [Chatwright](https://github.com/chatwright/chatwright) iframe
demo bot: a tiny language-onboarding conversation. No framework, no build
step, no dependencies — this repository is the proof that the
[iframe bot protocol](https://github.com/chatwright/chatwright/blob/main/formats/bot-protocol/v1/README.md)
is trivial to implement directly.

## About

Each platform adapter offers the same language choice and greeting, using
whatever affordances that platform actually has:

- **Telegram** (`telegram/`): `/start` offers the choice as an inline
  keyboard. Picking a language edits that same message in place —
  translating it to the chosen language — rather than sending a new one,
  and is remembered for the rest of the chat. Any other message is greeted
  in the chat's current language.
- **WhatsApp** (`whatsapp/`): the WhatsApp Cloud API has no inline
  keyboards and no message-edit endpoint, so the choice degrades to a
  numbered-reply menu — "Choose your language:\n1) English\n2) Español\n3)
  Français" — sent on a chat's first message, whatever its text. Replying
  with a digit or the language's own name picks it; the greeting always
  arrives as a **new** message, since there is nothing to edit in place.
  Any other message is greeted in the chat's current language, exactly as
  on Telegram.

The conversation itself lives once, in [`shared/greet.js`](shared/greet.js),
as platform-neutral pure functions with zero protocol or platform-API code
— the WhatsApp adapter landed without changing that file at all. Each
platform gets its own thin adapter directory that translates that
platform's native updates into calls into `shared/greet.js`, and the
returned intents back into that platform's own API calls:

| Platform | Adapter | Status |
|---|---|---|
| Telegram | [`telegram/`](telegram/) | Live |
| WhatsApp | [`whatsapp/`](whatsapp/) | Live |
| Viber | `viber/` | Planned |
| Slack | `slack/` | Planned |

`bots[]` above carries one entry per live adapter; a new adapter directory
adds a new `bots[]` entry rather than replacing this one.

## Demo

Both adapters are `transport: iframe` bots: each performs the
[handshake](https://github.com/chatwright/chatwright/blob/main/formats/bot-protocol/v1/README.md#handshake--the-bot-speaks-first)
with `window.parent`, then speaks its platform's own Update/call/result
envelopes exclusively over the `MessagePort` it receives — Telegram Bot API
JSON for `telegram/`, WhatsApp Cloud API JSON for `whatsapp/`, matching the
wire shapes [chatwright/runtime-go](https://github.com/chatwright/runtime-go)'s
platform emulators speak. Try either in Chatwright via the badge in
[README.md](README.md), or drive them by hand with
[`harness.html`](harness.html) — a minimal local host that performs the
handshake and lets you pick an adapter, send its first message, and pick a
language.

## Running locally

No build step. Serve the repository root with any static file server, e.g.:

```sh
npx serve .
# or: python3 -m http.server
```

Then open `harness.html` in a browser — it defaults to loading `telegram/`
in an iframe (switch to `whatsapp/` with the adapter picker) and plays the
host side of the protocol by hand.

## Trade-offs

- **No framework, no build step, no dependencies** — deliberate. This
  repository exists to prove the protocol is simple enough to hand-write
  against, not to demonstrate a nice bot SDK. A real bot repository is free
  to use one.
- **`harness.html` is a local dev tool, not a protocol reference.** It
  accepts any origin and emulates only the handful of methods each adapter
  calls (Telegram's `sendMessage`/`editMessageText`, WhatsApp's single
  `sendMessage`-shaped `/messages` call) — real hosts (the Chatwright
  runtime) validate origin against this manifest and emulate the platform
  faithfully.
- **Shared logic returns intents, not platform calls.** `shared/greet.js`
  never touches `sendMessage`/`editMessageText` directly, trading a small
  indirection for genuine reuse across future adapters.
