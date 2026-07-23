---
format: https://specscore.md/feature-specification
status: Implemented
---

# Feature: GreetBot demo bot

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/chatwright/greetbot/spec/features/greetbot?op=explore) | [Edit](https://specscore.studio/app/github.com/chatwright/greetbot/spec/features/greetbot?op=edit) | [Ask question](https://specscore.studio/app/github.com/chatwright/greetbot/spec/features/greetbot?op=ask) | [Request change](https://specscore.studio/app/github.com/chatwright/greetbot/spec/features/greetbot?op=request-change) |
**Status:** Implemented
**Source Ideas:** greetbot

## Summary

A no-framework, no-build iframe bot demonstrating the Chatwright bot
protocol end to end: platform-neutral conversation logic in
`shared/greet.js`, one adapter directory per platform, a `CHATWRIGHT.md`
manifest, and a manual harness proving the protocol without the runtime.

## Contents

| Child | Description |
|---|---|
| [whatsapp-language-onboarding](whatsapp-language-onboarding/README.md) | The WhatsApp adapter's numbered-reply degradation of language onboarding: no buttons, no edits, still the same shared conversation logic. |

## Problem

The bot protocol and federation model need a living, readable proof — see
the [greetbot idea](../../ideas/greetbot.md).

## Behavior

The bot performs language onboarding (the
[telegram-language-onboarding](telegram-language-onboarding/README.md)
child feature) behind the protocol handshake: it posts `hello` when ready,
receives the `hello-ack` MessagePort, then exchanges platform-native
envelopes only.

## Dependencies

- The bot protocol v1 format (chatwright/chatwright, `formats/bot-protocol/v1`)
- The `CHATWRIGHT.md` manifest v1 format (decision 0013)

## Acceptance Criteria

### AC: handshake-completes-on-load

Scenario: The bot page is loaded in an iframe by a protocol host
Given the page's script has attached its message listener
When the page posts `{"chatwright":"hello"}` to its parent
Then the host's `hello-ack` transfers a MessagePort
And all subsequent traffic uses that port only
(Proven live in a real browser via `harness.html`, 2026-07-23.)

## Open Questions

- Should the host-side handshake in `harness.html` become a tiny reusable
  helper shared via the template repo, instead of being copy-pasted?
- Can the harness proof run headless in CI (automated browser) so the ACs
  are re-proven on every push, not only manually?
- Which iframe `sandbox`/CSP attributes should this page recommend to hosts
  once the standard fixes them (research item I-68)?
