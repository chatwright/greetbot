---
format: https://specscore.md/feature-specification
status: Implemented
---

# Feature: WhatsApp language onboarding

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/chatwright/greetbot/spec/features/greetbot/whatsapp-language-onboarding?op=explore) | [Edit](https://specscore.studio/app/github.com/chatwright/greetbot/spec/features/greetbot/whatsapp-language-onboarding?op=edit) | [Ask question](https://specscore.studio/app/github.com/chatwright/greetbot/spec/features/greetbot/whatsapp-language-onboarding?op=ask) | [Request change](https://specscore.studio/app/github.com/chatwright/greetbot/spec/features/greetbot/whatsapp-language-onboarding?op=request-change) |
**Status:** Implemented
**Source Ideas:** greetbot

## Summary

The WhatsApp adapter's numbered-reply degradation of language onboarding:
no buttons, no message edits, still the same shared conversation logic in
`shared/greet.js`. The `alternative`-tier implementation of the
`language-onboarding` recipe in chatwright/recipes, via its
`universal-numbered-replies` technique.

## Problem

The Telegram adapter's inline keyboard and in-place edit
([telegram-language-onboarding](../telegram-language-onboarding/README.md))
depend on capabilities the WhatsApp Cloud API does not have: no inline
buttons, no message-edit endpoint. The demo must prove the platform-neutral
split in `shared/greet.js` survives a platform that genuinely can't offer
the same interaction — honestly, not by pretending WhatsApp has buttons it
doesn't.

## Behavior

Implemented by `whatsapp/bot.js` translating WhatsApp Cloud API webhook
JSON to the pure logic in `shared/greet.js` and answering with a genuine
Cloud API `/messages` call. On a chat's first inbound message (any text),
the bot sends a numbered menu built from `GreetBot.LANGUAGES` — "Choose
your language:\n1) English\n2) Español\n3) Français". A later reply is
parsed as a 1-based digit or the language's own label
(case-insensitively); a match records the choice and sends the greeting as
a **new** message, since there is no message to edit. Any other message
falls back to `GreetBot.greet` — the chat's current language, English by
default — exactly as telegram/bot.js falls back for any non-`/start`,
non-pick message.

`shared/greet.js` required no changes at first: `LANGUAGES`,
`CHOOSE_LANGUAGE_TEXT`, `greetingFor` and `createChatState` were already
platform-neutral and already exported, and the numbered-menu rendering and
digit/label parsing both started out living in `whatsapp/bot.js` as
WhatsApp-specific UI convention. That held only until a second
numbered-reply consumer arrived: when
[telegram-language-onboarding](../telegram-language-onboarding/README.md)
added typed-digit/name support alongside its inline-keyboard taps, the
digit/label *parsing* half turned out to be platform-neutral conversation
semantics after all — both adapters need to agree on what counts as a
valid pick — so it moved into `shared/greet.js` as `languageFromText`,
consumed by both `whatsapp/bot.js` and `telegram/bot.js` unchanged. The
numbered-*menu* text itself is still WhatsApp-specific rendering and still
lives here — Telegram never renders it, since its keyboard buttons already
show the numbering.

## Dependencies

- [GreetBot demo bot](../README.md) (the protocol handshake)

## Acceptance Criteria

### AC: first-message-shows-numbered-menu

Scenario: A user sends their first message to the bot
Given the protocol handshake is complete and this chat has sent no prior
message
When any inbound text message arrives
Then the bot calls the Cloud API `/messages` endpoint with body
"Choose your language:\n1) English\n2) Español\n3) Français"

### AC: numeric-reply-sends-greeting-as-new-message

Scenario: The user replies with a language pick
Given the numbered-language menu has already been sent to this chat
When a further inbound text message with body "1" arrives
Then the bot calls the Cloud API `/messages` endpoint again — a **second,
distinct** call, never an edit of the first — with body "Howdy stranger"
(Both ACs proven live via `harness.html` in a real browser, 2026-07-23.)

## Open Questions

- Should an unrecognised second reply (neither a valid digit nor a
  recognised label) re-send the numbered menu instead of silently falling
  back to the English greeting?
- **Resolved 2026-07-23:** digit-and-label parsing moved from
  `whatsapp/bot.js` into `shared/greet.js` (`languageFromText`) the moment
  a second numbered-reply consumer landed — see
  [telegram-language-onboarding](../telegram-language-onboarding/README.md)
  and this document's Behavior section above.
- How should a WhatsApp 24-hour customer-service-window closure (Cloud API
  error code 131047, requiring a template message) surface here, given
  this adapter only ever sends free-form text?

---
*This document follows the https://specscore.md/feature-specification*
