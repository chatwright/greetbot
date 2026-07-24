// telegram/bot.js — the Telegram adapter for GreetBot.
//
// This file is the reference example that proves the Chatwright iframe bot
// protocol (v1) is trivial to implement directly against
// `window.postMessage` and a `MessagePort`:
//   https://github.com/chatwright/chatwright/blob/main/formats/bot-protocol/v1/README.md
// Everything below maps to a numbered step in that document.
//
// Its job is narrow and entirely mechanical: perform the handshake, turn
// inbound Telegram Update JSON into calls into ../shared/greet.js (the
// platform-neutral conversation logic), and turn that file's platform-
// neutral "intents" back into real Telegram Bot API calls
// (sendMessage / editMessageText) — exactly the calls this bot would POST
// to https://api.telegram.org. A future whatsapp/bot.js, viber/bot.js, ...
// would do the same translation for its own platform, sharing the same
// ../shared/greet.js.
//
// Telegram supports numbered replies too, not just button taps: a plain
// inbound message reading "1"/"2"/"3" or a language's own name picks that
// language exactly as it does on whatsapp/bot.js's numbered-reply menu —
// same GreetBot.languageFromText parser, same shared/greet.js language
// list. Only the "(N)" suffix on each inline-keyboard button label (so a
// tap and a typed digit agree on numbering) is Telegram-specific
// rendering and lives here, not in the shared file.
//
// No framework, no build step: plain script, loaded after
// ../shared/greet.js so the `GreetBot` global is already defined.
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Protocol constants (bot-protocol/v1)
  // ---------------------------------------------------------------------

  var PROTOCOL_VERSION = '1';
  var PLATFORM = 'telegram';

  // Capability keys this bot exercises. Informative only (fidelity
  // display), never an access-control mechanism — decision 0011 in
  // chatwright/chatwright.
  var CAPABILITIES = ['messaging.buttons.inline', 'messaging.message.edit'];

  // One chat-state instance for this adapter's chats. GreetBot itself
  // knows nothing about Telegram chat ids beyond treating them as opaque
  // map keys.
  var chatState = GreetBot.createChatState();

  // chat id -> message_id of the language-choice message this adapter most
  // recently sent to that chat (the one carrying the inline keyboard).
  // Needed so a *typed* digit/name pick — which arrives as an ordinary
  // message, with no message_id of its own to edit — can still edit that
  // same prompt in place, exactly like a button tap already can via
  // callback_query.message.message_id. Purely Telegram transport plumbing
  // (a message_id), so it stays local to this adapter rather than
  // generalising ../shared/greet.js's platform-neutral chat state.
  var promptMessageIds = new Map();

  // ---------------------------------------------------------------------
  // Intent -> Telegram Bot API call. This is the only place that knows how
  // a platform-neutral {kind, text, actions?} intent becomes a Telegram
  // method + params.
  // ---------------------------------------------------------------------

  // One row per action, one button per row — real Telegram Bot API shape
  // (`text` + `callback_data`), exactly as this bot would send it. The
  // "(N)" suffix on each label is Telegram-adapter rendering only: it
  // spells out the digit that types the same pick (GreetBot.languageFromText
  // accepts a 1-based position in GreetBot.LANGUAGES), so a tap and a typed
  // reply agree on numbering. shared/greet.js's action labels themselves
  // stay plain ("English") — this is purely how this adapter draws buttons.
  function inlineKeyboardFromActions(actions) {
    return {
      inline_keyboard: actions.map(function (action, index) {
        return [{ text: action.label + ' (' + (index + 1) + ')', callback_data: action.id }];
      }),
    };
  }

  // `editTarget` is only needed for "edit" intents: the chat_id/message_id
  // of the message to edit in place, taken from whatever update the intent
  // is answering. A "send" intent carrying language-choice `actions` is the
  // prompt message: once Telegram confirms it, its message_id is recorded
  // in `promptMessageIds` so a later typed digit/name pick has something to
  // edit, the same way a button tap's callback_query already carries one.
  function applyIntent(chatId, intent, editTarget) {
    if (!intent) return;
    if (intent.kind === 'send') {
      var params = { chat_id: chatId, text: intent.text };
      var isPrompt = Boolean(intent.actions && intent.actions.length);
      if (isPrompt) {
        params.reply_markup = inlineKeyboardFromActions(intent.actions);
      }
      callMethod('sendMessage', params, isPrompt ? function (result) {
        if (result && result.message_id != null) promptMessageIds.set(chatId, result.message_id);
      } : undefined);
    } else if (intent.kind === 'edit') {
      // No `reply_markup` here — omitting it on editMessageText is how
      // Telegram removes a message's existing inline keyboard, which is
      // exactly what should happen the moment a language is picked (tap or
      // typed digit/name): the prompt becomes the greeting, buttons gone.
      callMethod('editMessageText', {
        chat_id: chatId,
        message_id: editTarget.messageId,
        text: intent.text,
      });
    } else {
      console.warn('[greetbot/telegram] unknown intent kind:', intent.kind);
    }
  }

  // ---------------------------------------------------------------------
  // Telegram Update handling — payloads are exactly the Telegram Update
  // JSON a real webhook would deliver (protocol §"Envelope", kind "update").
  // ---------------------------------------------------------------------

  function handleUpdate(update) {
    if (!update || typeof update !== 'object') return;
    if (update.message) {
      handleMessage(update.message);
    } else if (update.callback_query) {
      handleCallbackQuery(update.callback_query);
    }
  }

  function handleMessage(message) {
    var chat = message && message.chat;
    if (!chat) return;

    if (message.text === '/start') {
      applyIntent(chat.id, GreetBot.start());
      return;
    }

    // Typed digit/name pick — the same GreetBot.languageFromText parser
    // whatsapp/bot.js drives its numbered-reply menu with. Only acted on
    // when this chat already has a tracked prompt message to edit (i.e.
    // /start has already run): with nothing to edit in place, it falls
    // through to the ordinary greet below, exactly like any other
    // unrecognised message.
    var code = GreetBot.languageFromText(message.text);
    var promptMessageId = promptMessageIds.get(chat.id);
    if (code && promptMessageId != null) {
      var intent = GreetBot.pickLanguage(chat.id, GreetBot.actionIdFor(code), chatState);
      applyIntent(chat.id, intent, { messageId: promptMessageId });
      return;
    }

    applyIntent(chat.id, GreetBot.greet(chat.id, chatState));
  }

  function handleCallbackQuery(callbackQuery) {
    var message = callbackQuery && callbackQuery.message;
    if (!message || !message.chat) return;
    var intent = GreetBot.pickLanguage(message.chat.id, callbackQuery.data, chatState);
    if (!intent) return; // not a language pick — ignore, per protocol (fire-and-forget)
    applyIntent(message.chat.id, intent, { messageId: message.message_id });
  }

  // ---------------------------------------------------------------------
  // Outbound calls — `payload` is exactly `{method, params}` (protocol
  // §"Envelope", kind "call"). Results come back on the same port carrying
  // the same envelope `id` (kind "result").
  // ---------------------------------------------------------------------

  var nextCallId = 1;
  var pendingCalls = new Map(); // envelope id -> {method, params, onSuccess}, for correlating + logging results

  // `onSuccess`, when given, is invoked with the call's `result` payload
  // once its matching "result" envelope arrives. Today's only use is
  // applyIntent recording a just-sent prompt message's message_id.
  function callMethod(method, params, onSuccess) {
    if (!port) {
      console.error('[greetbot/telegram] cannot call "' + method + '" before the handshake completes');
      return;
    }
    var id = 'call-' + nextCallId++;
    pendingCalls.set(id, { method: method, params: params, onSuccess: onSuccess });
    sendEnvelope({ id: id, kind: 'call', platform: PLATFORM, payload: { method: method, params: params } });
  }

  // Results are correlated by `id` back to the call that triggered them.
  // Failures are logged, never thrown — a bot must never crash the page a
  // demo (or a real chat) depends on.
  function handleResult(envelope) {
    var pending = pendingCalls.get(envelope.id);
    pendingCalls.delete(envelope.id);
    var payload = envelope.payload;
    if (!payload || payload.ok !== true) {
      console.error('[greetbot/telegram] call failed', pending, payload);
      logLine('call failed: ' + (pending ? pending.method : '(unknown)') + ' — ' + JSON.stringify(payload));
      return;
    }
    if (pending && pending.onSuccess) pending.onSuccess(payload.result);
  }

  // ---------------------------------------------------------------------
  // Transport — the handshake, then the MessagePort. This is the only part
  // of this file that is Chatwright-specific; everything above is ordinary
  // Telegram-adapter logic.
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
      console.warn('[greetbot/telegram] hello-ack protocol/platform mismatch, ignoring', data);
      return;
    }
    var receivedPort = event.ports && event.ports[0];
    if (!receivedPort) {
      console.error('[greetbot/telegram] hello-ack carried no MessagePort, ignoring');
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
          console.warn('[greetbot/telegram] unexpected envelope kind on port:', envelope.kind);
      }
    } catch (err) {
      // Never let a bad update or a bug in the handler take the page down.
      console.error('[greetbot/telegram] envelope handler crashed', err, envelope);
      logLine('handler error: ' + (err && err.message ? err.message : String(err)));
    }
  }

  // ---------------------------------------------------------------------
  // Tiny on-page log — purely for the demo; not part of the protocol.
  // ---------------------------------------------------------------------

  function logEnvelope(direction, envelope) {
    console.log('[greetbot/telegram] ' + direction, envelope);
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
