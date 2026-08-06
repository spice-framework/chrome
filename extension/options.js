(function initializeOptionsPage() {
  "use strict";

  const { SpiceSyntax, SpiceSettings } = globalThis;
  const form = document.querySelector("#settings-form");
  const concealPrefix = document.querySelector("#conceal-prefix");
  const colorGrid = document.querySelector("#color-grid");
  const preview = document.querySelector("#preview");
  const reset = document.querySelector("#reset");
  const status = document.querySelector("#status");
  const previewLines = [
    '// @import { Application } from "github.com/spice-framework/spice/pkg/app"',
    "// @Application",
    '// @management.Enable(expose=["health"], access="loopback", retries=-1)',
    "// @Implements(payments.Processor, health.Checker)",
    "package main",
  ];

  function buildColorFields() {
    for (const definition of SpiceSettings.COLOR_DEFINITIONS) {
      const field = document.createElement("label");
      field.className = "color-field";
      const picker = document.createElement("input");
      picker.type = "color";
      picker.dataset.colorKey = definition.key;
      picker.setAttribute("aria-label", `${definition.label} color`);
      const label = document.createElement("span");
      label.textContent = definition.label;
      const text = document.createElement("input");
      text.type = "text";
      text.dataset.colorText = definition.key;
      text.maxLength = 7;
      text.pattern = "#[0-9a-fA-F]{6}";
      text.setAttribute("aria-label", `${definition.label} hex value`);
      field.append(picker, label, text);
      colorGrid.append(field);
    }
  }

  function populate(settings) {
    concealPrefix.checked = settings.concealPrefix;
    document.querySelector(
      `input[name="theme"][value="${settings.theme}"]`,
    ).checked = true;
    for (const [key, value] of Object.entries(settings.colors)) {
      document.querySelector(`[data-color-key="${key}"]`).value = value;
      document.querySelector(`[data-color-text="${key}"]`).value = value;
    }
    renderPreview();
  }

  function readForm() {
    const colors = {};
    for (const definition of SpiceSettings.COLOR_DEFINITIONS) {
      colors[definition.key] = document.querySelector(
        `[data-color-key="${definition.key}"]`,
      ).value;
    }
    return SpiceSettings.normalizeSettings({
      theme: new FormData(form).get("theme"),
      concealPrefix: concealPrefix.checked,
      colors,
    });
  }

  function renderPreview() {
    const current = readForm();
    preview.replaceChildren();
    for (const source of previewLines) {
      const line = document.createElement("span");
      line.className = "preview-line";
      const tokens = SpiceSyntax.highlightTokens(source);
      let offset = 0;
      for (const token of tokens) {
        line.append(source.slice(offset, token.start));
        const span = document.createElement("span");
        span.textContent = source.slice(token.start, token.end);
        if (
          token.kind === SpiceSyntax.TokenKind.PREFIX &&
          current.concealPrefix
        ) {
          span.className = "preview-hidden-prefix";
        }
        const colorKey = token.kind
          .toLowerCase()
          .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        span.style.color = current.colors[colorKey];
        line.append(span);
        offset = token.end;
      }
      line.append(source.slice(offset));
      preview.append(line);
    }
  }

  function showStatus(message) {
    status.textContent = message;
    setTimeout(() => {
      if (status.textContent === message) {
        status.textContent = "";
      }
    }, 2400);
  }

  buildColorFields();
  chrome.storage.sync.get(SpiceSettings.STORAGE_KEY, (stored) => {
    populate(
      SpiceSettings.normalizeSettings(stored[SpiceSettings.STORAGE_KEY]),
    );
  });

  colorGrid.addEventListener("input", (event) => {
    const colorKey = event.target.dataset.colorKey;
    const textKey = event.target.dataset.colorText;
    if (colorKey) {
      document.querySelector(`[data-color-text="${colorKey}"]`).value =
        event.target.value;
    } else if (textKey && SpiceSettings.isColor(event.target.value)) {
      document.querySelector(`[data-color-key="${textKey}"]`).value =
        event.target.value;
    }
    renderPreview();
  });
  form.addEventListener("input", renderPreview);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      return;
    }
    chrome.storage.sync.set({ [SpiceSettings.STORAGE_KEY]: readForm() }, () =>
      showStatus("Settings saved"),
    );
  });
  reset.addEventListener("click", () => {
    populate(SpiceSettings.DEFAULT_SETTINGS);
    chrome.storage.sync.set(
      { [SpiceSettings.STORAGE_KEY]: SpiceSettings.DEFAULT_SETTINGS },
      () => showStatus("Defaults restored"),
    );
  });
})();
