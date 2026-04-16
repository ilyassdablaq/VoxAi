(function () {
  var currentScript = document.currentScript;
  if (!currentScript) {
    return;
  }

  var embedKey = currentScript.getAttribute("data-embed-key");
  if (!embedKey) {
    return;
  }

  var scriptOrigin = window.location.origin;
  try {
    scriptOrigin = new URL(currentScript.src, window.location.href).origin;
  } catch (_urlError) {
    scriptOrigin = window.location.origin;
  }

  var apiBase = (currentScript.getAttribute("data-api-base") || scriptOrigin || window.location.origin).replace(/\/+$/, "");
  var theme = currentScript.getAttribute("data-theme") || "#6366f1";
  var themeMode = (currentScript.getAttribute("data-theme-mode") || "light").toLowerCase();
  var position = currentScript.getAttribute("data-position") || "bottom-right";
  var language = currentScript.getAttribute("data-language") || "en";
  var botName = (currentScript.getAttribute("data-bot-name") || "Chatbot").trim() || "Chatbot";
  var launcherText = (currentScript.getAttribute("data-launcher-text") || "Chat").trim();
  var launcherIcon = currentScript.getAttribute("data-launcher-icon") || "chat";
  var initialMessage = (currentScript.getAttribute("data-initial-message") || "Hi. Send me a message and I will reply here.").trim();
  var maxSessionQuestionsValue = Number.parseInt(currentScript.getAttribute("data-max-session-questions") || "3", 10);
  var microphoneEnabled = (currentScript.getAttribute("data-microphone-enabled") || "false").toLowerCase() === "true";
  var loadingStyle = (currentScript.getAttribute("data-loading-style") || "free").toLowerCase();
  var maxSessionQuestions = Number.isFinite(maxSessionQuestionsValue) ? Math.max(1, maxSessionQuestionsValue) : 3;
  var side = position === "bottom-left" ? "left" : "right";

  if (loadingStyle !== "free" && loadingStyle !== "pro" && loadingStyle !== "enterprise") {
    loadingStyle = "free";
  }

  if (themeMode !== "light" && themeMode !== "dark") {
    themeMode = "light";
  }

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
  styles.textContent = "\n    :host, * { box-sizing: border-box; }\n    .shell { display: flex; flex-direction: column; align-items: end; gap: 12px; }\n    .panel {\n      display: none;\n      width: min(340px, calc(100vw - 32px));\n      height: min(490px, calc(100vh - 96px));\n      background: #f8fafc;\n      border: 1px solid rgba(148, 163, 184, 0.35);\n      border-radius: 22px;\n      box-shadow: 0 30px 60px rgba(15, 23, 42, 0.22);\n      overflow: hidden;\n      backdrop-filter: blur(18px);\n    }\n    .panel.open { display: flex; flex-direction: column; }\n    .header {\n      min-height: 56px;\n      padding: 0 16px;\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n      background: linear-gradient(135deg, var(--theme), color-mix(in srgb, var(--theme) 72%, #ffffff 28%));\n      color: #fff;\n    }\n    .header-title { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }\n    .header-copy { display: flex; flex-direction: column; gap: 1px; }\n    .status-pill {\n      font-size: 11px;\n      font-weight: 600;\n      padding: 6px 10px;\n      border-radius: 999px;\n      background: rgba(255, 255, 255, 0.18);\n      border: 1px solid rgba(255, 255, 255, 0.18);\n      white-space: nowrap;\n    }\n    .messages {\n      flex: 1;\n      overflow-y: auto;\n      padding: 14px;\n      display: flex;\n      flex-direction: column;\n      gap: 12px;\n      background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);\n    }\n    .row { display: flex; }\n    .row.user { justify-content: flex-end; }\n    .row.assistant { justify-content: flex-start; }\n    .bubble {\n      max-width: 82%;\n      padding: 11px 13px;\n      border-radius: 14px;\n      font-size: 13px;\n      line-height: 1.45;\n      white-space: pre-wrap;\n      word-break: break-word;\n      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);\n    }\n    .bubble.user {\n      color: #fff;\n      background: var(--theme);\n      border-bottom-right-radius: 6px;\n    }\n    .bubble.assistant {\n      color: #1e293b;\n      background: #e5e7eb;\n      border-bottom-left-radius: 6px;\n    }\n    .bubble.system {\n      color: #475569;\n      background: #eef2ff;\n      border: 1px solid rgba(99, 102, 241, 0.16);\n    }\n    .typing { display: inline-flex; align-items: center; gap: 4px; min-width: 44px; }\n    .dot { width: 6px; height: 6px; border-radius: 999px; background: #94a3b8; animation: bounce 1s infinite ease-in-out; }\n    .dot:nth-child(2) { animation-delay: 120ms; }\n    .dot:nth-child(3) { animation-delay: 240ms; }\n    @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.45; } 40% { transform: translateY(-4px); opacity: 1; } }\n    .composer {\n      border-top: 1px solid rgba(148, 163, 184, 0.22);\n      background: rgba(255, 255, 255, 0.92);\n      padding: 10px;\n      display: flex;\n      gap: 8px;\n      align-items: center;\n    }\n    .input {\n      flex: 1;\n      min-height: 42px;\n      border: 1px solid rgba(148, 163, 184, 0.45);\n      border-radius: 12px;\n      padding: 0 12px;\n      background: #fff;\n      color: #0f172a;\n      outline: none;\n      font-size: 14px;\n      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);\n    }\n    .input:focus { border-color: var(--theme); box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme) 20%, transparent); }\n    .send {\n      min-width: 64px;\n      min-height: 42px;\n      padding: 0 14px;\n      border: 0;\n      border-radius: 12px;\n      cursor: pointer;\n      color: #fff;\n      background: var(--theme);\n      font-weight: 700;\n      font-size: 14px;\n      box-shadow: 0 10px 24px color-mix(in srgb, var(--theme) 25%, transparent);\n    }\n    .send:disabled { opacity: 0.6; cursor: not-allowed; }\n    .launcher {\n      width: 56px;\n      height: 56px;\n      border-radius: 999px;\n      border: 0;\n      cursor: pointer;\n      color: #fff;\n      background: linear-gradient(135deg, var(--theme), color-mix(in srgb, var(--theme) 72%, #ffffff 28%));\n      box-shadow: 0 18px 30px rgba(15, 23, 42, 0.2);\n      display: inline-flex;\n      align-items: center;\n      justify-content: center;\n      font-weight: 700;\n      letter-spacing: 0.01em;\n    }\n    .launcher svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; }\n    .empty { color: #64748b; font-size: 13px; line-height: 1.5; padding: 8px 4px; }\n  ";
  styles.textContent += "\n    .typing-bubble { background: var(--loading-bg, #ffffff) !important; border: 1px solid var(--loading-border, #e2e8f0) !important; }\n    .typing-bubble .dot { background: var(--loading-dot, #94a3b8) !important; }\n  ";
  styles.textContent += "\n    .voice {\n      width: 36px;\n      height: 36px;\n      border: 1px solid transparent;\n      border-radius: 12px;\n      cursor: pointer;\n      color: #fff;\n      background: var(--theme);\n      display: inline-flex;\n      align-items: center;\n      justify-content: center;\n      box-shadow: none;\n      flex-shrink: 0;\n    }\n    .voice svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; }\n  ";

  var shell = document.createElement("div");
  shell.className = "shell";
  shell.style.setProperty("--theme", theme);
  if (loadingStyle === "enterprise") {
    shell.style.setProperty("--loading-bg", "#111827");
    shell.style.setProperty("--loading-border", "transparent");
    shell.style.setProperty("--loading-dot", "rgba(255,255,255,0.88)");
  } else if (loadingStyle === "pro") {
    shell.style.setProperty("--loading-bg", "#ca8a04");
    shell.style.setProperty("--loading-border", "transparent");
    shell.style.setProperty("--loading-dot", "#fef3c7");
  } else {
    shell.style.setProperty("--loading-bg", "#ffffff");
    shell.style.setProperty("--loading-border", "#e2e8f0");
    shell.style.setProperty("--loading-dot", "#94a3b8");
  }
  shell.style.alignItems = side === "left" ? "flex-start" : "flex-end";

  var panel = document.createElement("div");
  panel.className = "panel";

  var header = document.createElement("div");
  header.className = "header";

  var headerCopy = document.createElement("div");
  headerCopy.className = "header-copy";

  var headerTitle = document.createElement("div");
  headerTitle.className = "header-title";
  headerTitle.innerText = botName;

  headerCopy.appendChild(headerTitle);

  var closeButton = document.createElement("button");
  closeButton.className = "status-pill";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close chat");
  closeButton.innerText = "X";

  header.appendChild(headerCopy);
  header.appendChild(closeButton);

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

  var voiceButton = null;
  var speechRecognitionSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  if (microphoneEnabled) {
    voiceButton = document.createElement("button");
    voiceButton.className = "voice";
    voiceButton.type = "button";
    voiceButton.setAttribute("aria-label", "Start voice input");
    if (!speechRecognitionSupported) {
      voiceButton.disabled = true;
      voiceButton.title = "Speech recognition is not supported in this browser.";
    }
    voiceButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0"/><path d="M12 19v3M8 22h8"/></svg>';
  }

  if (voiceButton) {
    composer.appendChild(voiceButton);
  }
  composer.appendChild(input);
  composer.appendChild(send);

  panel.appendChild(header);
  panel.appendChild(messages);
  panel.appendChild(composer);

  var launcher = document.createElement("button");
  launcher.className = "launcher";
  launcher.type = "button";
  launcher.setAttribute("aria-label", launcherText || "Open chat");

  function createLauncherIcon(iconName) {
    if (iconName === "none") {
      return null;
    }

    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");

    var pathOne = document.createElementNS("http://www.w3.org/2000/svg", "path");
    var pathTwo = document.createElementNS("http://www.w3.org/2000/svg", "path");

    if (iconName === "sparkles") {
      pathOne.setAttribute("d", "M12 3l1.6 3.7L17 8.3l-3.4 1.6L12 13.6l-1.6-3.7L7 8.3l3.4-1.6L12 3z");
      pathTwo.setAttribute("d", "M18.5 13l.8 1.8L21 15.6l-1.7.8-.8 1.8-.8-1.8-1.7-.8 1.7-.8.8-1.8zM5.5 14l1 2.3L9 17.3l-2.5 1L5.5 21l-1-2.7L2 17.3l2.5-1L5.5 14z");
      pathOne.setAttribute("fill", "currentColor");
      pathTwo.setAttribute("fill", "currentColor");
      svg.appendChild(pathOne);
      svg.appendChild(pathTwo);
      return svg;
    }

    pathOne.setAttribute("d", "M21 12a8 8 0 0 1-8 8H8l-5 3 1.7-4.1A8 8 0 1 1 21 12z");
    pathOne.setAttribute("fill", "none");
    pathOne.setAttribute("stroke", "currentColor");
    pathOne.setAttribute("stroke-width", "2");
    pathOne.setAttribute("stroke-linecap", "round");
    pathOne.setAttribute("stroke-linejoin", "round");
    svg.appendChild(pathOne);

    if (iconName === "message") {
      pathTwo.setAttribute("d", "M8 11h8M8 15h5");
      pathTwo.setAttribute("fill", "none");
      pathTwo.setAttribute("stroke", "currentColor");
      pathTwo.setAttribute("stroke-width", "2");
      pathTwo.setAttribute("stroke-linecap", "round");
      svg.appendChild(pathTwo);
    }

    return svg;
  }

  if (themeMode === "dark") {
    panel.style.background = "#0f172a";
    panel.style.border = "1px solid rgba(71, 85, 105, 0.52)";
    messages.style.background = "linear-gradient(180deg, #0f172a 0%, #020617 100%)";
    composer.style.background = "rgba(15, 23, 42, 0.95)";
    composer.style.borderTop = "1px solid rgba(71, 85, 105, 0.55)";
    input.style.background = "#1e293b";
    input.style.color = "#e2e8f0";
    input.style.border = "1px solid rgba(100, 116, 139, 0.72)";
    if (voiceButton) {
      voiceButton.style.border = "1px solid rgba(71, 85, 105, 0.85)";
    }
  }

  launcher.innerHTML = "";
  var launcherIconNode = createLauncherIcon(launcherIcon);
  if (launcherIconNode) {
    launcher.appendChild(launcherIconNode);
  }

  if (launcherText) {
    var launcherLabel = document.createElement("span");
    launcherLabel.innerText = launcherText;
    launcherLabel.style.maxWidth = "120px";
    launcherLabel.style.overflow = "hidden";
    launcherLabel.style.textOverflow = "ellipsis";
    launcherLabel.style.whiteSpace = "nowrap";
    launcher.appendChild(launcherLabel);
    launcher.style.width = "auto";
    launcher.style.minWidth = "56px";
    launcher.style.padding = "0 16px";
    launcher.style.gap = "8px";
  } else {
    launcher.style.width = launcherIconNode ? "56px" : "auto";
    launcher.style.minWidth = "56px";
    launcher.style.padding = launcherIconNode ? "0" : "0 16px";
    launcher.style.gap = "0";
  }

  shell.appendChild(panel);
  shell.appendChild(launcher);
  shadow.appendChild(styles);
  shadow.appendChild(shell);
  document.body.appendChild(root);

  var conversationId = null;
  var userQuestionCount = 0;
  var sessionCompleted = false;
  var isOpen = false;
  var isPending = false;
  var recognition = null;
  var isListening = false;

  function getSpeechRecognitionConstructor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function getSpeechRecognitionLocale() {
    var localeMap = {
      en: "en-US",
      de: "de-DE",
      fr: "fr-FR",
      ar: "ar-SA",
    };

    return localeMap[language] || language || "en-US";
  }

  function setVoiceButtonState(listening) {
    if (!voiceButton) {
      return;
    }

    isListening = listening;

    voiceButton.innerHTML = listening
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0"/><path d="M12 19v3M8 22h8"/></svg>';
    voiceButton.setAttribute("aria-label", listening ? "Stop voice input" : "Start voice input");
  }

  function ensureRecognition() {
    if (recognition || !microphoneEnabled) {
      return recognition;
    }

    var SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      return null;
    }

    recognition = new SpeechRecognition();
    recognition.lang = getSpeechRecognitionLocale();
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = function (event) {
      var transcript = event.results[0] && event.results[0][0] && event.results[0][0].transcript ? event.results[0][0].transcript.trim() : "";
      if (transcript) {
        input.value = transcript;
      }
    };

    recognition.onerror = function () {
      setVoiceButtonState(false);
    };

    recognition.onend = function () {
      setVoiceButtonState(false);
    };

    return recognition;
  }

  function updateComposerAvailability() {
    var limitReached = sessionCompleted || userQuestionCount >= maxSessionQuestions;
    input.disabled = limitReached || isPending;
    send.disabled = limitReached || isPending;
    if (voiceButton) {
      voiceButton.disabled = !speechRecognitionSupported || limitReached || isPending;
    }
    input.placeholder = limitReached ? "Session ended (" + maxSessionQuestions + "/" + maxSessionQuestions + ")." : "Type your message...";
  }

  if (voiceButton) {
    voiceButton.addEventListener("click", function () {
      var activeRecognition = ensureRecognition();
      if (!activeRecognition) {
        return;
      }

      if (isListening) {
        activeRecognition.stop();
        return;
      }

      try {
        setVoiceButtonState(true);
        activeRecognition.start();
      } catch (_error) {
        setVoiceButtonState(false);
      }
    });
  }

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

    if (themeMode === "dark" && role !== "USER") {
      bubble.style.background = "#334155";
      bubble.style.color = "#e2e8f0";
    }

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
    bubble.className += " typing-bubble";

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
    if (isPending || sessionCompleted || userQuestionCount >= maxSessionQuestions) {
      if (!isPending) {
        createBubble("SYSTEM", "This chat session is complete. Start a new website session to continue.");
      }
      return;
    }

    isPending = true;
    updateComposerAvailability();

    createBubble("USER", text);
    var typingRow = createTypingBubble();

    try {
      var controller = new AbortController();
      var timeout = window.setTimeout(function () {
        controller.abort();
      }, 20000);

      try {
        var requestBody = {
          embedKey: embedKey,
          message: text,
          language: language,
        };

        if (conversationId) {
          requestBody.conversationId = conversationId;
        }

        var response = await fetch(apiBase + "/api/embed/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
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
        userQuestionCount = payload && typeof payload.remainingQuestions === "number"
          ? Math.max(0, maxSessionQuestions - payload.remainingQuestions)
          : userQuestionCount + 1;
        sessionCompleted = Boolean(payload && payload.sessionCompleted);

        var assistantText = getAssistantText(payload);
        if (!assistantText) {
          throw new Error("Empty assistant response");
        }

        typingRow.remove();
        createBubble("ASSISTANT", assistantText);
        if (sessionCompleted || userQuestionCount >= maxSessionQuestions) {
          sessionCompleted = true;
          createBubble("SYSTEM", "This session is saved to Conversations after " + maxSessionQuestions + " questions.");
        }
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
      updateComposerAvailability();
      if (!sessionCompleted) {
        input.focus();
      }
    }
  }

  launcher.addEventListener("click", function () {
    setOpen(!isOpen);
  });

  closeButton.addEventListener("click", function () {
    setOpen(false);
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

  createBubble("ASSISTANT", initialMessage || "Hi. Send me a message and I will reply here.");
  updateComposerAvailability();
  setOpen(false);
})();
