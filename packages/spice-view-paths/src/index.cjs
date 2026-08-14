(function initializeSpiceViewPaths(globalScope) {
  "use strict";

  const ROLE_ANNOTATIONS = Object.freeze([
    ["Application", "project"],
    ["Controller", "web"],
    ["Service", "application"],
    ["Repository", "persistence"],
    ["Configuration", "configuration"],
    ["ConfigurationProperties", "configuration"],
    ["Listener", "events"],
    ["Topic", "events"],
  ]);

  function map(canonicalPath, source = "", projectName = "") {
    const canonical = normalizePath(canonicalPath);
    if (!canonical) {
      return null;
    }
    if (isGenerated(canonical, source)) {
      const relative = canonical.includes("internal/spicegen/")
        ? canonical.slice(canonical.indexOf("internal/spicegen/") + 18)
        : canonical.replace(/^build\/generated\/spice\//, "");
      return result(
        canonical,
        `build/generated/spice/${relative}`,
        "Generated Sources",
        "generated",
        true,
        null,
      );
    }
    if (canonical.startsWith("src/main/resources/")) {
      return result(canonical, canonical, "Resources", "resource", false, null);
    }
    if (canonical.startsWith("src/test/resources/")) {
      return result(
        canonical,
        canonical,
        "Test Resources",
        "resource",
        false,
        null,
      );
    }
    if (!canonical.endsWith(".go")) {
      return null;
    }

    const test = canonical.endsWith("_test.go");
    const directory = canonical.includes("/")
      ? canonical.slice(0, canonical.lastIndexOf("/"))
      : "";
    const segments = directory ? directory.split("/") : [];
    let feature = "";
    let packageGroup = "";
    let command = "";
    if (segments[0] === "cmd") {
      command = segments[1] ?? projectName;
    } else {
      const visible = ["internal", "pkg"].includes(segments[0])
        ? segments.slice(1)
        : segments;
      feature = portableFeature(visible[0] ?? "") ? visible[0] : "";
      packageGroup = feature ? visible.slice(1).join("/") : "";
    }

    const primary = primarySymbol(canonical, source, test);
    const application = hasAnnotation(source, "Application");
    const roleSource = primary
      ? primaryDeclarationComments(source, primary)
      : source;
    const role =
      command || application
        ? "project"
        : inferRole(roleSource, primary, canonical);
    if (!role) {
      return null;
    }
    const root = test ? "src/test/go" : "src/main/go";
    const filename = viewFilename(
      canonical,
      primary,
      role,
      command || projectName,
      test,
      application,
    );
    const viewDirectory =
      role === "project"
        ? root
        : [root, feature, packageGroup, role].filter(Boolean).join("/");
    const sourceCanonical = test
      ? canonical.replace(/_test\.go$/, ".go")
      : null;
    return result(
      canonical,
      `${viewDirectory}/${filename}`,
      test ? "Tests" : "Source",
      role,
      false,
      sourceCanonical,
    );
  }

  function result(
    canonicalPath,
    viewPath,
    category,
    role,
    readOnly,
    sourceCanonicalPath,
  ) {
    return Object.freeze({
      canonicalPath,
      viewPath,
      category,
      role,
      readOnly,
      sourceCanonicalPath,
    });
  }

  function normalizePath(value) {
    if (typeof value !== "string" || value.trim() !== value) {
      return "";
    }
    const normalized = value.replaceAll("\\", "/").replace(/^\.\//, "");
    if (
      !normalized ||
      normalized.startsWith("/") ||
      normalized.endsWith("/") ||
      normalized.includes("//") ||
      normalized
        .split("/")
        .some((segment) => !segment || segment === "." || segment === "..")
    ) {
      return "";
    }
    return normalized;
  }

  function isGenerated(canonical, source) {
    return (
      canonical.startsWith("internal/spicegen/") ||
      canonical.includes("/internal/spicegen/") ||
      canonical.startsWith("build/generated/spice/") ||
      (source.slice(0, 2048).includes("Code generated") &&
        source.slice(0, 2048).includes("DO NOT EDIT"))
    );
  }

  function primarySymbol(canonical, source, test) {
    const names = [
      ...source.matchAll(/^\s*type\s+([A-Z][A-Za-z0-9_]*)\b/gm),
    ].map((match) => match[1]);
    const base = canonical
      .slice(canonical.lastIndexOf("/") + 1)
      .replace(/_test\.go$/, "")
      .replace(/\.go$/, "");
    const wanted = upperCamel(base);
    const exact = names.find(
      (name) => name.toLowerCase() === wanted.toLowerCase(),
    );
    if (exact) {
      return exact;
    }
    if (names.length === 1) {
      return names[0];
    }
    if (test) {
      const testName = source.match(
        /^\s*func\s+Test([A-Z][A-Za-z0-9_]*)(?:_|\()/m,
      )?.[1];
      if (testName) {
        return `${testName.split("_")[0]}Test`;
      }
    }
    return "";
  }

  function inferRole(source, primary, canonical) {
    const roles = new Set();
    for (const [annotation, role] of ROLE_ANNOTATIONS) {
      if (hasAnnotation(source, annotation)) {
        roles.add(role);
      }
    }
    if (roles.size === 1) {
      return [...roles][0];
    }
    if (roles.size > 1) {
      return "";
    }
    const identity = `${primary} ${canonical
      .slice(canonical.lastIndexOf("/") + 1)
      .replace(/_test\.go$/, "")
      .replace(/\.go$/, "")}`
      .toLowerCase()
      .replaceAll("_", "")
      .replace(/test\b/g, "");
    for (const [suffixes, role] of [
      [["controller"], "web"],
      [["configuration", "config"], "configuration"],
      [
        [
          "repository",
          "database",
          "connector",
          "connection",
          "driver",
          "transaction",
          "loader",
          "rows",
          "sql",
        ],
        "persistence",
      ],
      [["service", "server"], "application"],
      [["listener", "topic"], "events"],
    ]) {
      if (suffixes.some((suffix) => identity.endsWith(suffix))) {
        return role;
      }
    }
    return hasAnnotation(source, "Bean") ? "configuration" : "domain";
  }

  function primaryDeclarationComments(source, primary) {
    const lines = source.split(/\r\n|\n|\r/);
    const declaration = new RegExp(
      `^\\s*type\\s+${escapeRegularExpression(primary)}\\b`,
    );
    const index = lines.findIndex((line) => declaration.test(line));
    if (index < 0) {
      return source;
    }
    const comments = [];
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (!/^\s*\/\//.test(lines[cursor])) {
        break;
      }
      comments.unshift(lines[cursor]);
    }
    return comments.join("\n");
  }

  function escapeRegularExpression(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function hasAnnotation(source, name) {
    const pattern = new RegExp(`^\\s*//\\s+@${name}(?:\\s|\\(|$)`, "m");
    return pattern.test(source);
  }

  function viewFilename(
    canonical,
    primary,
    role,
    projectName,
    test,
    application,
  ) {
    const base = canonical
      .slice(canonical.lastIndexOf("/") + 1)
      .replace(/_test\.go$/, "")
      .replace(/\.go$/, "");
    if (role === "project" && application && !primary) {
      return `${upperCamel(projectName || "application")}Application.go`;
    }
    if (primary) {
      return `${primary}.go`;
    }
    return `${upperCamel(base)}${test ? "Test" : ""}.go`;
  }

  function portableFeature(value) {
    return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value);
  }

  function upperCamel(value) {
    return value
      .split(/[_-]+/)
      .filter(Boolean)
      .map((segment) => segment[0].toUpperCase() + segment.slice(1))
      .join("");
  }

  const api = Object.freeze({ map });
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  globalScope.SpiceViewPaths = api;
})(typeof globalThis === "undefined" ? this : globalThis);
