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
an inline keyboard; the choice edits the greeting in place. The official
implementation of the `language-onboarding` recipe in chatwright/recipes.

## Problem

The demo must exercise real platform affordances — inline keyboards,
callback queries and message edits — not just text echo, so the protocol
proof covers the capabilities the manifest declares
(`messaging.buttons.inline`, `messaging.message.edit`).

## Behavior

Implemented by `telegram/bot.js` translating Telegram updates to the pure
logic in `shared/greet.js` and answering with genuine Bot API method
calls (`sendMessage`, `editMessageText`).

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

## Open Questions

- The language list is hardcoded in `shared/greet.js` — should it derive
  from one i18n table so future platform adapters cannot drift?
- Should the adapter answer `callback_query` with toast text (visible
  confirmation) instead of a silent acknowledgement?
- How do longer language lists paginate within Telegram's callback-data
  size limits?
