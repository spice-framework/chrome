(function initializeSpiceForGitHub() {
  "use strict";

  const { SpiceSyntax, SpiceSettings } = globalThis;
  const RENDERED_ATTRIBUTE = "data-spice-rendered";
  const INDICATOR_CLASS = "spice-file-indicator";
  const SPICE_URL = "https://github.com/spice-framework/spice";
  const LINE_SELECTORS = [
    ".react-file-line",
    ".blob-code-inner",
    "td.blob-code",
    '[data-testid="diff-line-code"]',
  ];
  const FILE_CONTAINER_SELECTORS = [
    '[data-testid="diff-file"]',
    ".js-file",
    ".file",
  ];
  let settings = SpiceSettings.DEFAULT_SETTINGS;
  let scanQueued = false;

  function isGoPath(path) {
    return typeof path === "string" && /\.go(?:$|[?#])/.test(path);
  }

  function currentBlobIsGo() {
    return /\/blob\//.test(location.pathname) && isGoPath(location.pathname);
  }

  function currentPageCanContainDiffs() {
    return /\/(?:pull\/\d+\/files|commit\/[^/]+|compare\/)/.test(
      location.pathname,
    );
  }

  function lineCandidates(root) {
    const found = [];
    const seen = new Set();
    for (const line of root.querySelectorAll(LINE_SELECTORS.join(","))) {
      if (
        seen.has(line) ||
        found.some((candidate) => candidate.contains(line))
      ) {
        continue;
      }
      seen.add(line);
      found.push(line);
    }
    return found;
  }

  function renderLine(line) {
    const source = line.textContent ?? "";
    const tokens = SpiceSyntax.highlightTokens(source);
    if (tokens.length === 0) {
      return false;
    }
    if (line.getAttribute(RENDERED_ATTRIBUTE) === source) {
      return true;
    }

    const fragment = document.createDocumentFragment();
    let offset = 0;
    for (const token of tokens) {
      if (token.start > offset) {
        fragment.append(source.slice(offset, token.start));
      }
      const span = document.createElement("span");
      span.dataset.spiceToken = token.kind;
      if (token.kind === SpiceSyntax.TokenKind.PREFIX) {
        span.className = "spice-source-prefix";
        span.setAttribute("aria-hidden", "true");
      }
      span.textContent = source.slice(token.start, token.end);
      fragment.append(span);
      offset = token.end;
    }
    if (offset < source.length) {
      fragment.append(source.slice(offset));
    }

    line.replaceChildren(fragment);
    line.setAttribute(RENDERED_ATTRIBUTE, source);
    return line.textContent === source;
  }

  function renderLines(root) {
    let annotationCount = 0;
    for (const line of lineCandidates(root)) {
      if (renderLine(line)) {
        annotationCount += 1;
      }
    }
    return annotationCount;
  }

  function indicatorLabel(annotationCount) {
    return `Spice file · ${annotationCount} ${
      annotationCount === 1 ? "declaration" : "declarations"
    } · Open Spice framework`;
  }

  function createIndicator(annotationCount, size) {
    const indicator = document.createElement("a");
    indicator.className = INDICATOR_CLASS;
    indicator.classList.toggle(
      "spice-file-indicator--medium",
      size === "medium",
    );
    indicator.href = SPICE_URL;
    indicator.target = "_blank";
    indicator.rel = "noopener noreferrer";
    indicator.title = indicatorLabel(annotationCount);
    indicator.setAttribute("aria-label", indicator.title);

    const logo = document.createElement("img");
    logo.src = chrome.runtime.getURL("assets/logo-16.png");
    logo.width = 16;
    logo.height = 16;
    logo.alt = "";
    indicator.append(logo);
    return indicator;
  }

  function isVisible(element) {
    return (
      element.getClientRects().length > 0 &&
      getComputedStyle(element).display !== "none"
    );
  }

  function findBlobIndicatorPlacement() {
    const selectors = [
      '[data-testid="more-file-actions-button-nav-menu-wide"]',
      '[data-testid="more-file-actions-button-nav-menu-narrow"]',
      '[data-testid="more-file-actions-button"]',
      '[data-testid="raw-button"]',
    ];
    const candidates = selectors.flatMap((selector) => [
      ...document.querySelectorAll(selector),
    ]);
    const anchor = candidates.find(isVisible) ?? candidates[0];
    if (!anchor?.parentElement) {
      return null;
    }
    return {
      host: anchor.parentElement,
      before: anchor,
      size: anchor.dataset.testid?.includes("nav-menu") ? "medium" : "small",
    };
  }

  function updateIndicator(root, placement, annotationCount) {
    const indicators = [...root.querySelectorAll(`.${INDICATOR_CLASS}`)];
    const existing = indicators.shift();
    for (const duplicate of indicators) {
      duplicate.remove();
    }
    if (annotationCount === 0) {
      existing?.remove();
      return;
    }
    if (!placement) {
      return;
    }
    if (existing) {
      existing.title = indicatorLabel(annotationCount);
      existing.setAttribute("aria-label", existing.title);
      existing.classList.toggle(
        "spice-file-indicator--medium",
        placement.size === "medium",
      );
      if (
        existing.parentElement !== placement.host ||
        existing.nextSibling !== placement.before
      ) {
        placement.host.insertBefore(existing, placement.before);
      }
      return;
    }
    placement.host.insertBefore(
      createIndicator(annotationCount, placement.size),
      placement.before,
    );
  }

  function pathForDiffContainer(container) {
    const explicit =
      container.getAttribute("data-path") ??
      container.getAttribute("data-file-path") ??
      container.querySelector("[data-path]")?.getAttribute("data-path") ??
      container
        .querySelector("[data-file-path]")
        ?.getAttribute("data-file-path");
    if (explicit) {
      return explicit;
    }
    const label = container.querySelector(
      '.file-info a[title], [data-testid="file-header"] a[title], .Link--primary[title]',
    );
    return label?.getAttribute("title") ?? label?.textContent?.trim() ?? "";
  }

  function findDiffIndicatorPlacement(container) {
    const actions = container.querySelector(
      '.file-actions, [data-testid="file-header-actions"], .file-header .BtnGroup',
    );
    if (actions) {
      return {
        host: actions,
        before: actions.firstElementChild,
        size: "small",
      };
    }
    const header = container.querySelector(
      '.file-header, [data-testid="file-header"]',
    );
    return header ? { host: header, before: null, size: "small" } : null;
  }

  function scanDiffs() {
    if (!currentPageCanContainDiffs()) {
      return;
    }
    const seen = new Set();
    for (const selector of FILE_CONTAINER_SELECTORS) {
      for (const container of document.querySelectorAll(selector)) {
        if (seen.has(container)) {
          continue;
        }
        seen.add(container);
        const placement = findDiffIndicatorPlacement(container);
        if (!isGoPath(pathForDiffContainer(container))) {
          updateIndicator(container, placement, 0);
          continue;
        }
        updateIndicator(container, placement, renderLines(container));
      }
    }
  }

  function applySettings(nextSettings) {
    settings = SpiceSettings.normalizeSettings(nextSettings);
    const root = document.documentElement;
    root.classList.toggle("spice-conceal-prefix", settings.concealPrefix);
    root.classList.toggle("spice-vivid-theme", settings.theme === "vivid");
    root.classList.toggle("spice-custom-theme", settings.theme === "custom");
    for (const [key, value] of Object.entries(settings.colors)) {
      root.style.setProperty(`--spice-custom-${key}`, value);
    }
  }

  function scan() {
    scanQueued = false;
    for (const legacyBadge of document.querySelectorAll(".spice-file-badge")) {
      legacyBadge.remove();
    }
    if (currentBlobIsGo()) {
      updateIndicator(
        document,
        findBlobIndicatorPlacement(),
        renderLines(document),
      );
    } else {
      for (const indicator of document.querySelectorAll(
        `.${INDICATOR_CLASS}`,
      )) {
        if (!indicator.closest(FILE_CONTAINER_SELECTORS.join(","))) {
          indicator.remove();
        }
      }
    }
    scanDiffs();
  }

  function queueScan() {
    if (scanQueued) {
      return;
    }
    scanQueued = true;
    requestAnimationFrame(scan);
  }

  chrome.storage.sync.get(SpiceSettings.STORAGE_KEY, (stored) => {
    applySettings(stored[SpiceSettings.STORAGE_KEY]);
    queueScan();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && changes[SpiceSettings.STORAGE_KEY]) {
      applySettings(changes[SpiceSettings.STORAGE_KEY].newValue);
      queueScan();
    }
  });

  new MutationObserver(queueScan).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  for (const eventName of ["turbo:render", "pjax:end", "popstate"]) {
    addEventListener(eventName, queueScan);
  }
})();
