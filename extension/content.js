(function initializeSpiceForGitHub() {
  "use strict";

  const { SpiceSyntax, SpiceSettings } = globalThis;
  const RENDERED_ATTRIBUTE = "data-spice-rendered";
  const BADGE_CLASS = "spice-file-badge";
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

  function createBadge(annotationCount) {
    const badge = document.createElement("span");
    badge.className = BADGE_CLASS;
    badge.title = `Spice file · ${annotationCount} ${
      annotationCount === 1 ? "annotation" : "annotations"
    }`;
    badge.setAttribute("aria-label", badge.title);

    const logo = document.createElement("img");
    logo.src = chrome.runtime.getURL("assets/logo-16.png");
    logo.width = 16;
    logo.height = 16;
    logo.alt = "";
    badge.append(logo, document.createTextNode("Spice file"));
    return badge;
  }

  function findBlobBadgeHost() {
    const direct = document.querySelector(
      '[data-testid="blob-header-content"], [data-testid="blob-header"] .file-info, .file-header .file-info',
    );
    if (direct) {
      return direct;
    }

    const heading = document.querySelector(
      'h2[data-testid="screen-reader-heading"]',
    );
    if (!heading) {
      return null;
    }
    let container = heading.parentElement;
    for (let depth = 0; container && depth < 3; depth += 1) {
      const visibleChild = [...container.children].find(
        (child) => child !== heading && !child.matches("h1,h2,h3"),
      );
      if (visibleChild) {
        return visibleChild;
      }
      container = container.parentElement;
    }
    return heading.parentElement;
  }

  function updateBadge(host, annotationCount) {
    if (!host) {
      return;
    }
    const existing = host.querySelector(`:scope > .${BADGE_CLASS}`);
    if (annotationCount === 0) {
      existing?.remove();
      return;
    }
    if (existing) {
      existing.title = `Spice file · ${annotationCount} ${
        annotationCount === 1 ? "annotation" : "annotations"
      }`;
      existing.setAttribute("aria-label", existing.title);
      return;
    }
    host.append(createBadge(annotationCount));
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

  function findDiffBadgeHost(container) {
    return container.querySelector(
      '.file-info, [data-testid="file-header-content"], [data-testid="file-header"]',
    );
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
        const host = findDiffBadgeHost(container);
        if (!isGoPath(pathForDiffContainer(container))) {
          updateBadge(host, 0);
          continue;
        }
        updateBadge(host, renderLines(container));
      }
    }
  }

  function applySettings(nextSettings) {
    settings = SpiceSettings.normalizeSettings(nextSettings);
    const root = document.documentElement;
    root.classList.toggle("spice-conceal-prefix", settings.concealPrefix);
    root.classList.toggle("spice-custom-theme", settings.theme === "custom");
    for (const [key, value] of Object.entries(settings.colors)) {
      root.style.setProperty(`--spice-custom-${key}`, value);
    }
  }

  function scan() {
    scanQueued = false;
    if (currentBlobIsGo()) {
      updateBadge(findBlobBadgeHost(), renderLines(document));
    } else {
      for (const badge of document.querySelectorAll(`.${BADGE_CLASS}`)) {
        if (!badge.closest(FILE_CONTAINER_SELECTORS.join(","))) {
          badge.remove();
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
