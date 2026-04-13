(function () {
  var currentScript = document.currentScript;
  if (!currentScript) {
    return;
  }

  var embedKey = currentScript.getAttribute("data-embed-key");
  if (!embedKey) {
    return;
  }

  var apiBase = (currentScript.getAttribute("data-api-base") || new URL(currentScript.src).origin || window.location.origin).replace(/\/+$/, "");
  var theme = currentScript.getAttribute("data-theme") || "#6366f1";
  var position = currentScript.getAttribute("data-position") || "bottom-right";
  var language = currentScript.getAttribute("data-language") || "en";
  var botName = currentScript.getAttribute("data-bot-name") || "Assistant";
  var side = position === "bottom-left" ? "left" : "right";

  var root = document.createElement("div");
  root.setAttribute("data-voxflow-chatbot-root", "true");
  root.style.position = "fixed";
  root.style.zIndex = "2147483647";
  root.style.bottom = "18px";
  root.style[side] = "18px";
  root.style.fontFamily = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  root.style.color = "#0f172a";

  var shadow = root.attachShadow ? root.attachShadow({ mode: "open" }) : root;
  var styles = document.createElement("style");
  styles.textContent = "\n    :host, * { box-sizing: border-box; }\n    .shell { display: flex; flex-direction: column; align-items: end; gap: 12px; }\n    .panel {\n      display: none;\n      width: min(340px, calc(100vw - 32px));\n      height: min(490px, calc(100vh - 96px));\n      background: #f8fafc;\n      border: 1px solid rgba(148, 163, 184, 0.35);\n      border-radius: 22px;\n      box-shadow: 0 30px 60px rgba(15, 23, 42, 0.22);\n      overflow: hidden;\n      backdrop-filter: blur(18px);\n    }\n    .panel.open { display: flex; flex-direction: column; }\n    .header {\n      min-height: 56px;\n      padding: 0 16px;\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n      background: linear-gradient(135deg, var(--theme), color-mix(in srgb, var(--theme) 72%, #ffffff 28%));\n      color: #fff;\n    }\n    .header-title { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }\n    .header-subtitle { font-size: 12px; opacity: 0.82; }\n    .header-copy { display: flex; flex-direction: column; gap: 1px; }\n    .status-pill {\n      font-size: 11px;\n      font-weight: 600;\n      padding: 6px 10px;\n      border-radius: 999px;\n      background: rgba(255, 255, 255, 0.18);\n      border: 1px solid rgba(255, 255, 255, 0.18);\n      white-space: nowrap;\n    }\n    .messages {\n      flex: 1;\n      overflow-y: auto;\n      padding: 14px;\n      display: flex;\n      flex-direction: column;\n      gap: 12px;\n      background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);\n    }\n    .row { display: flex; }\n    .row.user { justify-content: flex-end; }\n    .row.assistant { justify-content: flex-start; }\n    .bubble {\n      max-width: 82%;\n      padding: 11px 13px;\n      border-radius: 14px;\n      font-size: 13px;\n      line-height: 1.45;\n      white-space: pre-wrap;\n      word-break: break-word;\n      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);\n    }\n    .bubble.user {\n      color: #fff;\n      background: var(--theme);\n      border-bottom-right-radius: 6px;\n    }\n    .bubble.assistant {\n      color: #1e293b;\n      background: #e5e7eb;\n      border-bottom-left-radius: 6px;\n    }\n    .bubble.system {\n      color: #475569;\n      background: #eef2ff;\n      border: 1px solid rgba(99, 102, 241, 0.16);\n    }\n    .typing { display: inline-flex; align-items: center; gap: 4px; min-width: 44px; }\n    .dot { width: 6px; height: 6px; border-radius: 999px; background: #94a3b8; animation: bounce 1s infinite ease-in-out; }\n    .dot:nth-child(2) { animation-delay: 120ms; }\n    .dot:nth-child(3) { animation-delay: 240ms; }\n    @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.45; } 40% { transform: translateY(-4px); opacity: 1; } }\n    .composer {\n      border-top: 1px solid rgba(148, 163, 184, 0.22);\n      background: rgba(255, 255, 255, 0.92);\n      padding: 10px;\n      display: flex;\n      gap: 8px;\n      align-items: center;\n    }\n    .input {\n      flex: 1;\n      min-height: 42px;\n      border: 1px solid rgba(148, 163, 184, 0.45);\n      border-radius: 12px;\n      padding: 0 12px;\n      background: #fff;\n      color: #0f172a;\n      outline: none;\n      font-size: 14px;\n      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);\n    }\n    .input:focus { border-color: var(--theme); box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme) 20%, transparent); }\n    .send {\n      min-width: 64px;\n      min-height: 42px;\n      padding: 0 14px;\n      border: 0;\n      border-radius: 12px;\n      cursor: pointer;\n      color: #fff;\n      background: var(--theme);\n      font-weight: 700;\n      font-size: 14px;\n      box-shadow: 0 10px 24px color-mix(in srgb, var(--theme) 25%, transparent);\n    }\n    .send:disabled { opacity: 0.6; cursor: not-allowed; }\n    .launcher {\n      width: 56px;\n      height: 56px;\n      border-radius: 999px;\n      border: 0;\n      cursor: pointer;\n      color: #fff;\n      background: linear-gradient(135deg, var(--theme), color-mix(in srgb, var(--theme) 72%, #ffffff 28%));\n      box-shadow: 0 18px 30px rgba(15, 23, 42, 0.2);\n      display: inline-flex;\n      align-items: center;\n      justify-content: center;\n      font-weight: 700;\n      letter-spacing: 0.01em;\n    }\n    .launcher svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; }\n    .empty { color: #64748b; font-size: 13px; line-height: 1.5; padding: 8px 4px; }\n  ";

  var shell = document.createElement("div");
  shell.className = "shell";
  shell.style.setProperty("--theme", theme);

  var panel = document.createElement("div");
  panel.className = "panel";

  var header = document.createElement("div");
  header.className = "header";

  var headerCopy = document.createElement("div");
  headerCopy.className = "header-copy";

  var headerTitle = document.createElement("div");
  headerTitle.className = "header-title";
  headerTitle.innerText = botName;

  var headerSubtitle = document.createElement("div");
  headerSubtitle.className = "header-subtitle";
  headerSubtitle.innerText = "Assistant";

  headerCopy.appendChild(headerTitle);
  headerCopy.appendChild(headerSubtitle);

  var status = document.createElement("div");
  status.className = "status-pill";
  status.innerText = "Online";

  header.appendChild(headerCopy);
  header.appendChild(status);

  var messages = document.createElement("div");
  messages.className = "messages";

  var composer = document.createElement("form");
  composer.className = "composer";

  var input = document.createElement("input");
  input.className = "input";
  input.type = "text";
  input.placeholder = "Type your message...";
  input.setAttribute("aria-label", "Message input");

  var send = document.createElement("button");
  send.className = "send";
  send.type = "submit";
  send.innerText = "Send";

  composer.appendChild(input);
  composer.appendChild(send);

  panel.appendChild(header);
  panel.appendChild(messages);
  panel.appendChild(composer);

  var launcher = document.createElement("button");
  launcher.className = "launcher";
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Open chat");
  launcher.innerText = "Chat";

  shell.appendChild(panel);
  shell.appendChild(launcher);
  shadow.appendChild(styles);
  shadow.appendChild(shell);
  document.body.appendChild(root);

  var conversationId = null;
  var isOpen = false;
  var isPending = false;

  function setOpen(nextOpen) {
    isOpen = nextOpen;
    panel.className = nextOpen ? "panel open" : "panel";
    if (nextOpen) {
      window.setTimeout(function () {
        input.focus();
      }, 0);
    }
  }

  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  function createBubble(role, text) {
    var row = document.createElement("div");
    row.className = "row " + role.toLowerCase();

    var bubble = document.createElement("div");
    bubble.className = "bubble " + role.toLowerCase();
    bubble.innerText = text;

    row.appendChild(bubble);
    messages.appendChild(row);
    scrollToBottom();
    return bubble;
  }

  function createTypingBubble() {
    var row = document.createElement("div");
    row.className = "row assistant";

    var bubble = document.createElement("div");
    bubble.className = "bubble assistant";

    var typing = document.createElement("span");
    typing.className = "typing";

    var dotOne = document.createElement("span");
    dotOne.className = "dot";
    var dotTwo = document.createElement("span");
    dotTwo.className = "dot";
    var dotThree = document.createElement("span");
    dotThree.className = "dot";

    typing.appendChild(dotOne);
    typing.appendChild(dotTwo);
    typing.appendChild(dotThree);
    bubble.appendChild(typing);
    row.appendChild(bubble);
    messages.appendChild(row);
    scrollToBottom();

    return row;
  }

  function getAssistantText(payload) {
    if (!payload || typeof payload !== "object") {
      return "";
    }

    var message = payload.message;
    if (message && typeof message === "object") {
      if (typeof message.content === "string" && message.content.trim()) {
        return message.content;
      }

      if (typeof message.text === "string" && message.text.trim()) {
        return message.text;
      }
    }

    if (typeof payload.responseText === "string" && payload.responseText.trim()) {
      return payload.responseText;
    }

    if (typeof payload.text === "string" && payload.text.trim()) {
      return payload.text;
    }

    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }

    return "";
  }

  async function sendMessage(text) {
    if (isPending) {
      return;
    }

    isPending = true;
    send.disabled = true;
    input.disabled = true;

    createBubble("USER", text);
    var typingRow = createTypingBubble();

    try {
      var controller = new AbortController();
      var timeout = window.setTimeout(function () {
        controller.abort();
      }, 20000);

      try {
        var response = await fetch(apiBase + "/api/embed/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embedKey: embedKey,
            message: text,
            conversationId: conversationId,
            language: language,
          }),
          signal: controller.signal,
        });

        var rawText = await response.text();
        var payload = null;

        try {
          payload = rawText ? JSON.parse(rawText) : null;
        } catch (_parseError) {
          payload = null;
        }

        if (!response.ok) {
          var serverError = payload && typeof payload === "object"
            ? (payload.error && payload.error.message) || payload.message || "Request failed"
            : "Request failed";
          throw new Error(serverError);
        }

        conversationId = payload && typeof payload.conversationId === "string" ? payload.conversationId : conversationId;

        var assistantText = getAssistantText(payload);
        if (!assistantText) {
          throw new Error("Empty assistant response");
        }

        typingRow.remove();
        createBubble("ASSISTANT", assistantText);
      } finally {
        window.clearTimeout(timeout);
      }
    } catch (error) {
      if (typingRow && typingRow.parentNode) {
        typingRow.remove();
      }

      var message = "Sorry, I couldn't reply right now. Please try again.";
      if (error && error.name === "AbortError") {
        message = "The request timed out. Please try again.";
      } else if (error && error.message) {
        message = error.message;
      }

      createBubble("ASSISTANT", message);
    } finally {
      isPending = false;
      send.disabled = false;
      input.disabled = false;
      input.focus();
    }
  }

  launcher.addEventListener("click", function () {
    setOpen(!isOpen);
  });

  composer.addEventListener("submit", function (event) {
    event.preventDefault();
    var value = input.value.trim();
    if (!value) {
      return;
    }

    input.value = "";
    sendMessage(value);
  });

  createBubble("ASSISTANT", "Hi. Send me a message and I will reply here.");
  setOpen(false);
})();
