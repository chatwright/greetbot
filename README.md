[![Try in Chatwright](https://chatwright.dev/badge.svg)](https://chatwright.dev/try/github/chatwright/greetbot)

# GreetBot

The first real [Chatwright](https://github.com/chatwright/chatwright) iframe
demo bot — a tiny language-onboarding conversation, built with **no
framework, no build step, no dependencies**. It exists to prove that the
[iframe bot protocol](https://github.com/chatwright/chatwright/blob/main/formats/bot-protocol/v1/README.md)
is trivial to implement directly against `window.postMessage` and a
`MessagePort`.

See **[CHATWRIGHT.md](CHATWRIGHT.md)** for the full repository manifest —
the file that lets Chatwright (the badge above, `chatwright.dev/try/...`,
and the [central registry](https://github.com/chatwright/recipes)) discover
this repository.

## What it does

Every adapter offers the same language choice and greeting, degraded to
whatever affordances its platform actually has. Telegram's `/start` offers
an inline keyboard — numbered, since typing a digit or a language's name
picks it too — whose pick edits the greeting in place and removes the
keyboard. WhatsApp has no buttons and no message-edit endpoint, so its
adapter sends the same kind of numbered-reply menu on a chat's first
message, but the greeting always arrives as a new message. Any other
message is greeted in the chat's current language, on either platform.

## Structure

Conversation logic lives once, independent of any platform or protocol; each
platform gets a thin adapter directory:

```
shared/greet.js    — platform-neutral conversation logic (pure functions,
                      no protocol/envelope/platform-API code at all)
telegram/           — the Telegram adapter: iframe bot-protocol handshake,
  bot.js              Telegram Update <-> shared/greet.js translation,
  index.html          Bot API calls (sendMessage / editMessageText)
whatsapp/           — the WhatsApp adapter: same handshake, WhatsApp Cloud
  bot.js              API webhook <-> shared/greet.js translation, a single
  index.html          sendMessage-shaped call (text only, no buttons/edits)
harness.html        — a local manual test host (see CHATWRIGHT.md)
index.html           — landing page listing platform adapters
```

A future `viber/` or `slack/` adapter would follow the same shape: translate
its platform's native updates into calls into `shared/greet.js`, and its
returned intents back into that platform's own API. `whatsapp/` proved the
split survives a second platform without any change to `shared/greet.js`.
See [CHATWRIGHT.md](CHATWRIGHT.md) for the full rationale and the platform
status table.

## Protocol

Both bots implement the bot side of the
[Chatwright iframe bot protocol v1](https://github.com/chatwright/chatwright/blob/main/formats/bot-protocol/v1/README.md):
handshake with `window.parent`, then that platform's own native
Update/call/result envelopes exclusively over the `MessagePort` each
receives — Telegram Bot API JSON for `telegram/bot.js`, WhatsApp Cloud API
JSON for `whatsapp/bot.js`. Both are commented as step-by-step reference
implementations of that document.

## License

Apache-2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).

---

An independent open-source demo for
[Chatwright](https://github.com/chatwright/chatwright), developed by
[Sneat.co](https://sneat.co).

## Spec-first

Chatwright is developed spec-first with [SpecScore](https://specscore.md/) —
product specs live in the [standard repository](https://github.com/chatwright/chatwright);
this repository's own specs live under [`spec/`](spec/README.md).
