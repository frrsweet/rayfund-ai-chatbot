(function () {
  var script = document.currentScript;
  var API = script.dataset.api || new URL(script.src).origin;
  var BOTTOM = parseInt(script.dataset.bottom || "20", 10);
  var TITLE = script.dataset.title || "Помощник фонда «РЭЙ»";
  var STARTERS = [
    "Как сделать пожертвование",
    "Я нашёл животное, что делать?",
    "Как стать волонтёром",
    "Можно ли сдать вам животное?"
  ];

  function makeId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "s" + Date.now() + Math.random().toString(16).slice(2);
  }

  function sessionId() {
    try {
      var saved = localStorage.getItem("rb_sid");
      if (!saved) {
        saved = makeId();
        localStorage.setItem("rb_sid", saved);
      }
      return saved;
    } catch (e) {
      window.__rbSid = window.__rbSid || makeId();
      return window.__rbSid;
    }
  }

  var CSS = [
    ":host{all:initial}",
    "*{box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}",
    ".fab{width:56px;height:56px;border-radius:50%;border:0;background:#0f766e;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(15,23,42,.25)}",
    ".fab:focus-visible,.send:focus-visible,.chip:focus-visible,.close:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}",
    ".fab svg{width:26px;height:26px}",
    ".panel{position:absolute;right:0;bottom:68px;width:360px;max-width:calc(100vw - 24px);height:520px;max-height:calc(100vh - 110px);background:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(15,23,42,.28);display:none;flex-direction:column;overflow:hidden}",
    ".panel.open{display:flex}",
    ".head{background:#0f766e;color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;font-size:15px;font-weight:600}",
    ".close{background:none;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:2px 6px}",
    ".log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#f6f8f8}",
    ".msg{max-width:86%;padding:9px 12px;border-radius:12px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}",
    ".msg.bot{background:#fff;color:#1f2937;align-self:flex-start;border:1px solid #e3e8e8;border-bottom-left-radius:4px}",
    ".msg.user{background:#0f766e;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}",
    ".msg a{color:#0f766e;font-weight:600}",
    ".note{font-size:12px;color:#5b6770;margin-top:6px}",
    ".chips{display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start;max-width:100%}",
    ".chip{background:#fff;border:1px solid #0f766e;color:#0f766e;border-radius:16px;padding:6px 11px;font-size:13px;cursor:pointer;text-align:left}",
    ".chip:hover{background:#e6f2f0}",
    ".typing{color:#5b6770;font-size:20px;letter-spacing:2px;line-height:1}",
    ".form{display:flex;gap:8px;padding:10px;border-top:1px solid #e3e8e8;background:#fff}",
    ".input{flex:1;border:1px solid #cbd5d5;border-radius:10px;padding:9px 11px;font-size:14px;outline:none}",
    ".input:focus{border-color:#0f766e}",
    ".send{background:#0f766e;color:#fff;border:0;border-radius:10px;padding:0 14px;font-size:14px;cursor:pointer}",
    ".send:disabled{opacity:.5;cursor:default}",
    "@media (max-width:480px){.panel{position:fixed;right:8px;left:8px;width:auto;bottom:" + (BOTTOM + 68) + "px}}",
    "@media (prefers-reduced-motion:no-preference){.panel.open{animation:rise .18s ease-out}@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}}"
  ].join("");

  var HTML =
    '<div class="panel" role="dialog" aria-label="Чат с помощником">' +
    '<div class="head"><span></span><button class="close" aria-label="Закрыть чат">×</button></div>' +
    '<div class="log" aria-live="polite"></div>' +
    '<form class="form"><input class="input" maxlength="1000" placeholder="Напишите вопрос" aria-label="Сообщение">' +
    '<button class="send" type="submit">Отправить</button></form></div>' +
    '<button class="fab" aria-label="Открыть чат">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg></button>';

  var host = document.createElement("div");
  host.style.cssText = "position:fixed;right:20px;bottom:" + BOTTOM + "px;z-index:2147483000";
  var root = host.attachShadow({ mode: "open" });
  root.innerHTML = "<style>" + CSS + "</style>" + HTML;
  document.body.appendChild(host);

  var panel = root.querySelector(".panel");
  var log = root.querySelector(".log");
  var form = root.querySelector(".form");
  var input = root.querySelector(".input");
  var sendBtn = root.querySelector(".send");
  var fab = root.querySelector(".fab");
  root.querySelector(".head span").textContent = TITLE;

  var greeted = false;

  function scroll() {
    log.scrollTop = log.scrollHeight;
  }

  function addMsg(role, text) {
    var el = document.createElement("div");
    el.className = "msg " + role;
    el.textContent = text;
    log.appendChild(el);
    scroll();
    return el;
  }

  function addChips(items, onPick) {
    var wrap = document.createElement("div");
    wrap.className = "chips";
    items.forEach(function (item) {
      var b = document.createElement("button");
      b.className = "chip";
      b.type = "button";
      b.textContent = item.title;
      b.addEventListener("click", function () {
        wrap.remove();
        onPick(item);
      });
      wrap.appendChild(b);
    });
    log.appendChild(wrap);
    scroll();
  }

  function setBusy(busy) {
    sendBtn.disabled = busy;
    input.disabled = busy;
    if (!busy) input.focus();
  }

  function post(payload) {
    payload.session_id = sessionId();
    var typing = addMsg("bot", "…");
    typing.classList.add("typing");
    setBusy(true);
    return fetch(API + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        if (r.status === 429) throw new Error("Слишком много запросов, подождите минуту");
        if (!r.ok) throw new Error("Сервис временно недоступен");
        return r.json();
      })
      .then(function (data) {
        typing.remove();
        renderReply(data);
      })
      .catch(function (err) {
        typing.remove();
        addMsg("bot", err.message || "Сервис временно недоступен");
      })
      .then(function () {
        setBusy(false);
      });
  }

  function renderReply(data) {
    var el = addMsg("bot", data.reply);
    if (data.url) {
      var link = document.createElement("div");
      link.className = "note";
      var a = document.createElement("a");
      a.href = data.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Подробнее на сайте";
      link.appendChild(a);
      el.appendChild(link);
    }
    if (data.escalate && data.status !== "fallback") {
      var note = document.createElement("div");
      note.className = "note";
      note.textContent = "Если нужна помощь человека, напишите на info@rayfund.ru";
      el.appendChild(note);
    }
    if (data.suggestions && data.suggestions.length) {
      addChips(data.suggestions, function (item) {
        addMsg("user", item.title);
        post({ intent_id: item.id });
      });
    }
  }

  function sendText(text) {
    text = text.trim();
    if (!text) return;
    addMsg("user", text);
    post({ text: text });
  }

  function greet() {
    if (greeted) return;
    greeted = true;
    addMsg("bot", "Здравствуйте! Отвечаю на частые вопросы о фонде. Выберите тему или напишите свой вопрос.");
    addChips(
      STARTERS.map(function (s) {
        return { title: s };
      }),
      function (item) {
        sendText(item.title);
      }
    );
  }

  function toggle(open) {
    var willOpen = typeof open === "boolean" ? open : !panel.classList.contains("open");
    panel.classList.toggle("open", willOpen);
    if (willOpen) {
      greet();
      input.focus();
    }
  }

  fab.addEventListener("click", function () {
    toggle();
  });
  root.querySelector(".close").addEventListener("click", function () {
    toggle(false);
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var value = input.value;
    input.value = "";
    sendText(value);
  });
})();
