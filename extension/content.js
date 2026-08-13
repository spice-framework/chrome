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
  const MARKDOWN_BLOCK_SELECTORS = [
    ".markdown-body pre",
    ".comment-body pre",
    ".js-comment-body pre",
    ".highlight-source-go pre",
    "div.highlight pre",
    '[data-testid="markdown-body"] pre',
    ".wiki-body pre",
  ];
  const EDITABLE_SURFACE_SELECTOR = [
    "textarea",
    "input",
    '[contenteditable="true"]',
    '[data-testid="read-only-cursor-text-area"]',
  ].join(",");
  let settings = SpiceSettings.DEFAULT_SETTINGS;
  let scanQueued = false;

  function isEditableSurface(node) {
    return Boolean(node.closest(EDITABLE_SURFACE_SELECTOR));
  }

  function uniqueElements(root, selectors) {
    const found = [];
    const seen = new Set();
    for (const element of root.querySelectorAll(selectors.join(","))) {
      if (
        seen.has(element) ||
        found.some((candidate) => candidate.contains(element))
      ) {
        continue;
      }
      seen.add(element);
      found.push(element);
    }
    return found;
  }

  function lineCandidates(root) {
    return uniqueElements(root, LINE_SELECTORS).filter(
      (line) => !isEditableSurface(line),
    );
  }

  function appendTokens(fragment, source, tokens) {
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
  }

  function renderLine(line) {
    const source = line.textContent ?? "";
    const tokens = SpiceSyntax.highlightDisplayLine(source);
    if (tokens.length === 0) {
      return false;
    }
    if (line.getAttribute(RENDERED_ATTRIBUTE) === source) {
      return true;
    }

    const fragment = document.createDocumentFragment();
    appendTokens(fragment, source, tokens);
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

  function markdownBlockCandidates(root) {
    return uniqueElements(root, MARKDOWN_BLOCK_SELECTORS).filter(
      (block) =>
        !isEditableSurface(block) &&
        !block.querySelector(LINE_SELECTORS.join(",")),
    );
  }

  function splitDisplayLines(source) {
    return source.split(/(?<=\r\n|\n|\r)/);
  }

  function appendDisplaySegment(fragment, segment) {
    const newline = segment.match(/(\r\n|\n|\r)$/)?.[0] ?? "";
    const line = newline ? segment.slice(0, -newline.length) : segment;
    const tokens = SpiceSyntax.highlightDisplayLine(line);
    if (tokens.length === 0) {
      fragment.append(segment);
      return 0;
    }
    appendTokens(fragment, line, tokens);
    if (newline) {
      fragment.append(newline);
    }
    return 1;
  }

  function renderCodeBlock(block) {
    const source = block.textContent ?? "";
    if (block.getAttribute(RENDERED_ATTRIBUTE) === source) {
      return block.querySelectorAll('[data-spice-token="PREFIX"]').length;
    }
    const fragment = document.createDocumentFragment();
    let spiceCount = 0;
    for (const segment of splitDisplayLines(source)) {
      spiceCount += appendDisplaySegment(fragment, segment);
    }
    if (spiceCount === 0) {
      return 0;
    }
    block.replaceChildren(fragment);
    block.setAttribute(RENDERED_ATTRIBUTE, source);
    return block.textContent === source ? spiceCount : 0;
  }

  function renderMarkdownBlocks(root) {
    let annotationCount = 0;
    for (const block of markdownBlockCandidates(root)) {
      annotationCount += renderCodeBlock(block);
    }
    return annotationCount;
  }

  function spiceDeclarationCount(root) {
    return root.querySelectorAll('[data-spice-token="PREFIX"]').length;
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

  function fileContainers() {
    const blobPlacement = findBlobIndicatorPlacement();
    return uniqueElements(document, FILE_CONTAINER_SELECTORS).filter(
      (container) => !blobPlacement || !container.contains(blobPlacement.host),
    );
  }

  function scanFileContainers() {
    for (const container of fileContainers()) {
      updateIndicator(
        container,
        findDiffIndicatorPlacement(container),
        spiceDeclarationCount(container),
      );
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
    renderLines(document);
    renderMarkdownBlocks(document);
    const containers = fileContainers();
    const blobPlacement = findBlobIndicatorPlacement();
    if (containers.length > 0) {
      for (const indicator of document.querySelectorAll(
        `.${INDICATOR_CLASS}`,
      )) {
        if (!indicator.closest(FILE_CONTAINER_SELECTORS.join(","))) {
          indicator.remove();
        }
      }
      scanFileContainers();
      return;
    }
    updateIndicator(document, blobPlacement, spiceDeclarationCount(document));
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
