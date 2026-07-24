---
format: https://specscore.md/feature-specification
status: Implemented
---

# Feature: Telegram language onboarding

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/chatwright/greetbot/spec/features/greetbot/telegram-language-onboarding?op=explore) | [Edit](https://specscore.studio/app/github.com/chatwright/greetbot/spec/features/greetbot/telegram-language-onboarding?op=edit) | [Ask question](https://specscore.studio/app/github.com/chatwright/greetbot/spec/features/greetbot/telegram-language-onboarding?op=ask) | [Request change](https://specscore.studio/app/github.com/chatwright/greetbot/spec/features/greetbot/telegram-language-onboarding?op=request-change) |
**Status:** Implemented
**Source Ideas:** greetbot

## Summary

The Telegram adapter's conversation: `/start` offers a language choice on
an inline keyboard, each button labelled with its position ("English (1)",
"Español (2)", "Français (3)") since a typed reply works too — typing a
digit or a language's own name picks it exactly like WhatsApp's
numbered-reply menu does. Either way, the choice edits the greeting in
place and removes the keyboard. The official implementation of the
`language-onboarding` recipe in chatwright/recipes.

## Problem

The demo must exercise real platform affordances — inline keyboards,
callback queries and message edits — not just text echo, so the protocol
proof covers the capabilities the manifest declares
(`messaging.buttons.inline`, `messaging.message.edit`). It must also prove
the platform-neutral split in `shared/greet.js` holds up when a second
adapter (Telegram) needs the exact same digit/name-parsing semantics
`whatsapp/bot.js` already offers, rather than reimplementing it.

## Behavior

Implemented by `telegram/bot.js` translating Telegram updates to the pure
logic in `shared/greet.js` — including the shared `languageFromText`
digit/name parser it now drives alongside its inline-keyboard taps, the
same parser `whatsapp/bot.js` drives its numbered-reply menu with — and
answering with genuine Bot API method calls (`sendMessage`,
`editMessageText`, the latter always omitting `reply_markup` so picking a
language removes the keyboard, tap or typed).

## Dependencies

- [GreetBot demo bot](../README.md) (the protocol handshake)

## Acceptance Criteria

### AC: start-shows-language-keyboard

Scenario: A user starts the conversation
Given the protocol handshake is complete
When an update with message text `/start` arrives
Then the bot calls `sendMessage` with text "Choose your language"
And the message carries an `inline_keyboard` with English, Español and Français

### AC: choice-edits-greeting-in-place

Scenario: The user picks a language
Given the language keyboard message exists
When a `callback_query` update with data `lang:en` arrives
Then the bot calls `editMessageText` on that same `message_id`
And the text becomes the English greeting
(Both ACs proven live via `harness.html` in a real browser, 2026-07-23.)

### AC: choice-removes-language-keyboard

Scenario: A language is picked, by tap or by typed digit/name
Given the language keyboard message exists
When the choice is recorded (see AC: choice-edits-greeting-in-place and
AC: numbered-reply-picks-language)
Then the bot's `editMessageText` call omits `reply_markup` entirely
And Telegram removes the inline keyboard from the message, leaving only
the greeting
(Proven live in Chrome against production — the Playground Compare view, 2026-07-24: numbered buttons rendered, click edited the prompt in place with the keyboard fully removed.)

### AC: numbered-reply-picks-language

Scenario: The user types instead of tapping
Given the language keyboard message exists
When a plain text message reading "2" (or "Español") arrives
Then the bot calls `editMessageText` on that same `message_id` — the
identical prompt a button tap would have edited
And the text becomes the Spanish greeting
(Proven live in Chrome against production — the Playground Compare view, 2026-07-24: numbered buttons rendered, click edited the prompt in place with the keyboard fully removed.)

## Open Questions

- The language list is hardcoded in `shared/greet.js` — should it derive
  from one i18n table so future platform adapters cannot drift?
- Should the adapter answer `callback_query` with toast text (visible
  confirmation) instead of a silent acknowledgement?
- How do longer language lists paginate within Telegram's callback-data
  size limits?
- Should an unrecognised typed reply (arriving after `/start`, matching no
  digit or label) re-send the keyboard — matching the
  [WhatsApp adapter's equivalent open question](../whatsapp-language-onboarding/README.md)
  — instead of silently falling back to the current-language greeting?
