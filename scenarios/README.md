# Scenarios

Test scenarios for this bot, referenced from `CHATWRIGHT.md` (`demos[].scenario`).

Two kinds live here:

1. **Golden recordings** — `*.chatwright.json` run bundles
   (https://chatwright.dev/formats/run-bundle/v1): a real recorded run
   whose journal doubles as a regression baseline and replays in the
   Studio player. The first golden lands here recorded from the browser
   Playground (the assertions it proves are this repo's feature ACs —
   see `spec/features/`).
2. **Declarative scenarios with assertions** — the portable scenario
   format ("expect a bot message with buttons [Yes, No]; click [Yes]"),
   executable by BOTH the Go and TypeScript runtimes with the same
   verdict. Format in design as research item I-71 in
   chatwright/chatwright; it ships into this directory unchanged.

Until a golden is recorded, the deterministic assertions for this bot are
its feature acceptance criteria (`spec/features/greetbot/`), proven live
via `harness.html`.
