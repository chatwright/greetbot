// whatsapp/bot.js — the WhatsApp adapter for GreetBot.
//
// This is the second platform the multi-platform structure in
// ../shared/greet.js was built for. It proves the same protocol and the
// same shared conversation logic port to a platform whose Cloud API is
// materially different from Telegram's Bot API — no buttons, no
// message-edit endpoint — without touching ../shared/greet.js at all:
//   https://github.com/chatwright/chatwright/blob/main/formats/bot-protocol/v1/README.md
//
// Its job is narrow and entirely mechanical: perform the handshake, turn
// inbound WhatsApp Cloud API webhook JSON into calls into ../shared/greet.js
// (the platform-neutral conversation logic), and turn that file's
// platform-neutral "intents" back into real WhatsApp Cloud API calls
// (a POST to https://graph.facebook.com/{version}/{phone-number-id}/messages)
// — exactly the call this bot would make against the real Cloud API. The
// wire shapes here — the inbound webhook payload, the outbound text
// message body, the success/error response shapes — match
// chatwright/runtime-go's whatsapp platform emulator exactly.
//
// WhatsApp has no inline-keyboard equivalent and no message-edit endpoint,
// so this adapter cannot reuse Telegram's inline-keyboard + in-place-edit
// conversation: it degrades the language choice to a numbered-reply menu
// (a plain-text list the user answers with a digit or the language's own
// name) and sends the greeting as a brand-new message rather than editing
// one that doesn't exist to edit. That degradation logic is WhatsApp-
// specific UI convention, not shared conversation semantics, so it lives
// here rather than in ../shared/greet.js — the shared file still owns the
// language list, the greeting texts and the per-chat language state.
//
// No framework, no build step: plain script, loaded after
// ../shared/greet.js so the `GreetBot` global is already defined.
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Protocol constants (bot-protocol/v1)
  // ---------------------------------------------------------------------

  var PROTOCOL_VERSION = '1';
  var PLATFORM = 'whatsapp';

  // Capability keys this bot exercises. Informative only (fidelity
  // display), never an access-control mechanism — decision 0011 in
  // chatwright/chatwright. WhatsApp here is text-only: no buttons, no
  // message edits, unlike telegram/bot.js's capability set.
  var CAPABILITIES = ['messaging.text'];

  // One chat-state instance for this adapter's chats, reused unchanged
  // from ../shared/greet.js. GreetBot itself knows nothing about WhatsApp
  // chat ids (WhatsApp's wa_id is a phone-number string, not Telegram's
  // integer chat id) beyond treating them as opaque map keys.
  var chatState = GreetBot.createChatState();

  // Chats this adapter has already sent the numbered-language menu to.
  // WhatsApp has no `/start` command to key off (there is no command
  // concept at all): the menu goes out on a chat's very first inbound
  // message, whatever its text. This tracking is purely a WhatsApp-adapter
  // concern, so it stays local to this file rather than generalising
  // ../shared/greet.js's chat state.
  var menuSentTo = new Set();

  // ---------------------------------------------------------------------
  // Numbered-reply menu — the WhatsApp-specific degradation of Telegram's
  // inline keyboard. Built from GreetBot.LANGUAGES (already
  // platform-neutral: code/label/greeting), so the language list itself
  // still lives once, in ../shared/greet.js.
  // ---------------------------------------------------------------------

  // Renders "Choose your language:\n1) English\n2) Español\n3) Français".
  function languageMenuText() {
    var lines = GreetBot.LANGUAGES.map(function (language, index) {
      return (index + 1) + ') ' + language.label;
    });
    return GreetBot.CHOOSE_LANGUAGE_TEXT + ':\n' + lines.join('\n');
  }

  // Parses a reply as a language pick: a 1-based digit position in
  // GreetBot.LANGUAGES ("1", "2", "3", ...) or the language's own label,
  // case-insensitively ("english", "Español", ...). Returns the matched
  // language code, or null if `text` isn't a recognised pick — the
  // adapter then falls back to GreetBot.greet, exactly as telegram/bot.js
  // falls back to it for any non-/start, non-language-pick message.
  function languageFromReply(text) {
    var trimmed = (text == null ? '' : String(text)).trim();
    if (!trimmed) return null;

    var oneBasedIndex = Number(trimmed);
    if (Number.isInteger(oneBasedIndex) && oneBasedIndex >= 1 && oneBasedIndex <= GreetBot.LANGUAGES.length) {
      return GreetBot.LANGUAGES[oneBasedIndex - 1].code;
    }

    var lower = trimmed.toLowerCase();
    for (var i = 0; i < GreetBot.LANGUAGES.length; i++) {
      if (GreetBot.LANGUAGES[i].label.toLowerCase() === lower) return GreetBot.LANGUAGES[i].code;
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Intent -> WhatsApp Cloud API call. This is the only place that knows
  // how a platform-neutral {kind, text} intent becomes a Cloud API call.
  // WhatsApp intents here are always "send" — this adapter never produces
  // an "edit" intent because it never calls GreetBot.pickLanguage (whose
  // "edit" intent kind has no WhatsApp equivalent); the guard below exists
  // only as the same defensive posture telegram/bot.js takes on an
  // unrecognised intent kind.
  // ---------------------------------------------------------------------

  // The exact WhatsApp Cloud API text-message request body
  // (wabotapi.SendTextConfig's JSON shape): messaging_product/
  // recipient_type/to/type + a nested text.body — matches what
  // chatwright/runtime-go's whatsapp emulator decodes.
  function sendTextParams(chatId, text) {
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: String(chatId),
      type: 'text',
      text: { body: text },
    };
  }

  function applyIntent(chatId, intent) {
    if (!intent) return;
    if (intent.kind === 'send') {
      callMethod('sendMessage', sendTextParams(chatId, intent.text));
    } else {
      console.warn('[greetbot/whatsapp] unsupported intent kind (no edit on WhatsApp):', intent.kind);
    }
  }

  // ---------------------------------------------------------------------
  // WhatsApp Cloud API webhook handling — payloads are exactly the
  // WhatsApp Cloud API webhook JSON a real subscription would deliver
  // (protocol §"Envelope", kind "update"): object/entry[]/changes[]/value.
  // This bot is text-only, so it only looks at messages of type "text";
  // any other inbound message type (image, location, interactive, ...) is
  // ignored, matching this repository's declared "messaging.text" only
  // capability.
  // ---------------------------------------------------------------------

  function handleUpdate(update) {
    if (!update || typeof update !== 'object' || !Array.isArray(update.entry)) return;
    update.entry.forEach(function (entry) {
      (entry.changes || []).forEach(handleChange);
    });
  }

  function handleChange(change) {
    if (!change || change.field !== 'messages' || !change.value) return;
    (change.value.messages || []).forEach(handleInboundMessage);
  }

  function handleInboundMessage(message) {
    if (!message || message.type !== 'text' || !message.from) return; // text only — see file header
    handleText(message.from, message.text && message.text.body);
  }

  function handleText(chatId, text) {
    if (!menuSentTo.has(chatId)) {
      menuSentTo.add(chatId);
      applyIntent(chatId, { kind: 'send', text: languageMenuText() });
      return;
    }

    var code = languageFromReply(text);
    if (code) {
      chatState.setLang(chatId, code);
      applyIntent(chatId, { kind: 'send', text: GreetBot.greetingFor(code) });
      return;
    }

    // Not a recognised pick: greet in whatever language this chat has
    // settled on so far (English until a valid pick lands) — the same
    // fallback ../shared/greet.js's greet() gives telegram/bot.js for any
    // message that isn't /start or a language pick.
    applyIntent(chatId, GreetBot.greet(chatId, chatState));
  }

  // ---------------------------------------------------------------------
  // Outbound calls — `payload` is exactly `{method, params}` (protocol
  // §"Envelope", kind "call"). Results come back on the same port carrying
  // the same envelope `id` (kind "result").
  // ---------------------------------------------------------------------

  var nextCallId = 1;
  var pendingCalls = new Map(); // envelope id -> {method, params}, for correlating + logging results

  function callMethod(method, params) {
    if (!port) {
      console.error('[greetbot/whatsapp] cannot call "' + method + '" before the handshake completes');
      return;
    }
    var id = 'call-' + nextCallId++;
    pendingCalls.set(id, { method: method, params: params });
    sendEnvelope({ id: id, kind: 'call', platform: PLATFORM, payload: { method: method, params: params } });
  }

  // Results are correlated by `id` back to the call that triggered them.
  // Unlike Telegram's {ok, result|error_code} envelope, the WhatsApp Cloud
  // API has no top-level "ok" flag: a successful call returns the result
  // object directly, and a failed one returns exactly {"error": {...}} —
  // so failure here is detected by the presence of an `error` key, not by
  // the absence of `ok === true`. Failures are logged, never thrown — a
  // bot must never crash the page a demo (or a real chat) depends on.
  function handleResult(envelope) {
    var pending = pendingCalls.get(envelope.id);
    pendingCalls.delete(envelope.id);
    var payload = envelope.payload;
    if (!payload || payload.error) {
      console.error('[greetbot/whatsapp] call failed', pending, payload);
      logLine('call failed: ' + (pending ? pending.method : '(unknown)') + ' — ' + JSON.stringify(payload));
    }
  }

  // ---------------------------------------------------------------------
  // Transport — the handshake, then the MessagePort. This is the only part
  // of this file that is Chatwright-specific; everything above is ordinary
  // WhatsApp-adapter logic. Identical in shape to telegram/bot.js's
  // transport section (only PLATFORM/log-prefix differ), because the
  // protocol is the same regardless of platform.
  // ---------------------------------------------------------------------

  var port = null; // the MessagePort, live only after a successful handshake

  function sendEnvelope(envelope) {
    logEnvelope('bot -> host', envelope);
    port.postMessage(envelope);
  }

  // Step 1 (protocol): "When its listener is attached and it is ready to
  // serve, the bot posts to window.parent." We attach the window listener
  // first so we can never miss the reply, then post hello.
  function sendHello() {
    var hello = {
      chatwright: 'hello',
      protocolVersion: PROTOCOL_VERSION,
      platform: PLATFORM,
      capabilities: CAPABILITIES,
    };
    logEnvelope('bot -> host (window)', hello);
    // targetOrigin "*" is correct here: the hello message carries no
    // secrets (protocol §"Handshake", step 1).
    window.parent.postMessage(hello, '*');
  }

  // Step 2 (protocol): the host replies with `hello-ack`, transferring a
  // MessagePort in the message's transfer list. After this, all traffic
  // moves to the port; window-level messages are ignored.
  function onWindowMessage(event) {
    var data = event.data;
    if (!data || data.chatwright !== 'hello-ack') return;
    if (data.protocolVersion !== PROTOCOL_VERSION || data.platform !== PLATFORM) {
      console.warn('[greetbot/whatsapp] hello-ack protocol/platform mismatch, ignoring', data);
      return;
    }
    var receivedPort = event.ports && event.ports[0];
    if (!receivedPort) {
      console.error('[greetbot/whatsapp] hello-ack carried no MessagePort, ignoring');
      return;
    }
    logEnvelope('host -> bot (window)', data);

    port = receivedPort;
    port.onmessage = onPortMessage;
    logLine('handshake complete — now speaking on the MessagePort only');
  }

  // Step 3 (protocol): every port message is one envelope
  // {id, kind, platform, payload}. `kind` is "update" (fire-and-forget,
  // ordered) or "result" (answers a call this bot made, by `id`); this bot
  // never receives "call" (that direction is bot -> host only).
  function onPortMessage(event) {
    var envelope = event.data;
    if (!envelope || typeof envelope !== 'object') return;
    logEnvelope('host -> bot', envelope);

    try {
      switch (envelope.kind) {
        case 'update':
          handleUpdate(envelope.payload);
          break;
        case 'result':
          handleResult(envelope);
          break;
        default:
          console.warn('[greetbot/whatsapp] unexpected envelope kind on port:', envelope.kind);
      }
    } catch (err) {
      // Never let a bad update or a bug in the handler take the page down.
      console.error('[greetbot/whatsapp] envelope handler crashed', err, envelope);
      logLine('handler error: ' + (err && err.message ? err.message : String(err)));
    }
  }

  // ---------------------------------------------------------------------
  // Tiny on-page log — purely for the demo; not part of the protocol.
  // ---------------------------------------------------------------------

  function logEnvelope(direction, envelope) {
    console.log('[greetbot/whatsapp] ' + direction, envelope);
    logLine(direction + ': ' + JSON.stringify(envelope));
  }

  function logLine(text) {
    var log = document.getElementById('log');
    if (!log) return;
    var entry = document.createElement('li');
    var time = document.createElement('time');
    time.textContent = new Date().toISOString().slice(11, 19);
    entry.appendChild(time);
    entry.appendChild(document.createTextNode(' ' + text));
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  // ---------------------------------------------------------------------
  // Go.
  // ---------------------------------------------------------------------

  window.addEventListener('message', onWindowMessage);
  sendHello();
})();
