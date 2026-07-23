// shared/greet.js — GreetBot's platform-neutral conversation logic.
//
// This is the one piece of GreetBot every platform adapter (telegram/ today;
// whatsapp/, viber/, slack/, ... later) drives. It knows the greeting texts,
// the language list, and the /start -> language-choice -> edited-greeting
// state machine — and NOTHING about Telegram, iframes, postMessage, or the
// Chatwright envelope protocol. An adapter's whole job is: turn its
// platform's native updates into calls into this file, then turn this
// file's platform-neutral "intents" into its platform's native API calls.
//
// No build step: this attaches a single `GreetBot` global so any adapter
// page can load it with a plain <script src="../shared/greet.js"> tag. It
// also assigns `module.exports` so it can be `require()`d from Node (e.g.
// for a future adapter test) without a bundler.

(function (global) {
  'use strict';

  var DEFAULT_LANGUAGE = 'en';
  var ACTION_PREFIX = 'lang:'; // platform-neutral action-id scheme, e.g. Telegram callback_data

  // code / label (button text) / greeting (reply once selected). Order
  // matters: it is the order buttons are offered in.
  var LANGUAGES = [
    { code: 'en', label: 'English', greeting: 'Howdy stranger' },
    { code: 'es', label: 'Español', greeting: '¡Hola, forastero!' },
    { code: 'fr', label: 'Français', greeting: "Salut l'inconnu" },
  ];

  var CHOOSE_LANGUAGE_TEXT = 'Choose your language';

  function greetingFor(code) {
    for (var i = 0; i < LANGUAGES.length; i++) {
      if (LANGUAGES[i].code === code) return LANGUAGES[i].greeting;
    }
    return greetingFor(DEFAULT_LANGUAGE);
  }

  function actionIdFor(code) {
    return ACTION_PREFIX + code;
  }

  // Returns the language code encoded in a platform-neutral action id, or
  // null if the action id isn't one of ours (an adapter should ignore it).
  function languageFromActionId(actionId) {
    if (typeof actionId !== 'string' || actionId.indexOf(ACTION_PREFIX) !== 0) return null;
    var code = actionId.slice(ACTION_PREFIX.length);
    for (var i = 0; i < LANGUAGES.length; i++) {
      if (LANGUAGES[i].code === code) return code;
    }
    return null;
  }

  // Per-chat state: which language each chat has picked so far. A plain Map
  // keyed by whatever chat identifier the adapter's platform uses (Telegram
  // chat id, WhatsApp thread id, ...). Each adapter owns one instance, so
  // chats on different platforms never collide.
  function createChatState() {
    var lang = new Map();
    return {
      langFor: function (chatId) {
        return lang.has(chatId) ? lang.get(chatId) : DEFAULT_LANGUAGE;
      },
      setLang: function (chatId, code) {
        lang.set(chatId, code);
      },
    };
  }

  // ---------------------------------------------------------------------
  // The conversation, expressed as pure functions returning a platform-
  // neutral "intent" for the adapter to realise:
  //   {kind: "send", text, actions?: [{id, label}, ...]}
  //   {kind: "edit", text}
  // An adapter maps "send" to its platform's send-message call (with an
  // inline/native keyboard built from `actions` when present) and "edit" to
  // its platform's edit-message-in-place call, using whatever message
  // identifier its own transport gave it.
  // ---------------------------------------------------------------------

  // /start (or its platform equivalent): offer the language choice.
  function start() {
    return {
      kind: 'send',
      text: CHOOSE_LANGUAGE_TEXT,
      actions: LANGUAGES.map(function (l) {
        return { id: actionIdFor(l.code), label: l.label };
      }),
    };
  }

  // Any other inbound text: greet in whatever language this chat has
  // picked so far (English until a choice is made).
  function greet(chatId, state) {
    return { kind: 'send', text: greetingFor(state.langFor(chatId)) };
  }

  // A language button/action was picked. Records the choice and returns the
  // "edit" intent that replaces the language-choice message with the
  // greeting, in place. Returns null if `actionId` isn't a language pick —
  // the adapter should then ignore the interaction entirely.
  function pickLanguage(chatId, actionId, state) {
    var code = languageFromActionId(actionId);
    if (!code) return null;
    state.setLang(chatId, code);
    return { kind: 'edit', text: greetingFor(code) };
  }

  var GreetBot = {
    DEFAULT_LANGUAGE: DEFAULT_LANGUAGE,
    LANGUAGES: LANGUAGES,
    CHOOSE_LANGUAGE_TEXT: CHOOSE_LANGUAGE_TEXT,
    greetingFor: greetingFor,
    actionIdFor: actionIdFor,
    languageFromActionId: languageFromActionId,
    createChatState: createChatState,
    start: start,
    greet: greet,
    pickLanguage: pickLanguage,
  };

  global.GreetBot = GreetBot;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GreetBot;
  }
})(typeof window !== 'undefined' ? window : globalThis);
