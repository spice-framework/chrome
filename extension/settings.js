(function initializeSpiceSettings(root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.SpiceSettings = api;
  }
})(
  typeof globalThis === "undefined" ? this : globalThis,
  function createSettings() {
    "use strict";

    const STORAGE_KEY = "spiceSettings";
    const COLOR_DEFINITIONS = Object.freeze([
      Object.freeze({
        key: "prefix",
        label: "Comment prefix",
        value: "#8b949e",
      }),
      Object.freeze({
        key: "sigil",
        label: "Annotation sigil",
        value: "#8b949e",
      }),
      Object.freeze({
        key: "namespace",
        label: "Annotation namespace",
        value: "#d2a8ff",
      }),
      Object.freeze({
        key: "annotation",
        label: "Annotation name",
        value: "#ff7b72",
      }),
      Object.freeze({
        key: "parameter",
        label: "Argument name",
        value: "#ffa657",
      }),
      Object.freeze({
        key: "importSymbol",
        label: "Imported symbol",
        value: "#ff7b72",
      }),
      Object.freeze({
        key: "importAlias",
        label: "Import alias",
        value: "#d2a8ff",
      }),
      Object.freeze({
        key: "typeReference",
        label: "Type reference",
        value: "#d2a8ff",
      }),
      Object.freeze({ key: "string", label: "String value", value: "#a5d6ff" }),
      Object.freeze({ key: "number", label: "Number value", value: "#79c0ff" }),
      Object.freeze({
        key: "boolean",
        label: "Boolean value",
        value: "#79c0ff",
      }),
      Object.freeze({
        key: "identifier",
        label: "Identifier value",
        value: "#c9d1d9",
      }),
      Object.freeze({
        key: "keyword",
        label: "Directive keyword",
        value: "#ff7b72",
      }),
      Object.freeze({
        key: "operator",
        label: "Punctuation",
        value: "#8b949e",
      }),
      Object.freeze({
        key: "badgeAccent",
        label: "Badge accent",
        value: "#d9772b",
      }),
    ]);
    const DEFAULT_COLORS = Object.freeze(
      Object.fromEntries(
        COLOR_DEFINITIONS.map(({ key, value }) => [key, value]),
      ),
    );
    const DEFAULT_SETTINGS = Object.freeze({
      theme: "github",
      concealPrefix: true,
      colors: DEFAULT_COLORS,
    });

    function normalizeSettings(candidate) {
      const input = candidate && typeof candidate === "object" ? candidate : {};
      const colors = {};
      for (const definition of COLOR_DEFINITIONS) {
        const value = input.colors?.[definition.key];
        colors[definition.key] = isColor(value)
          ? value.toLowerCase()
          : definition.value;
      }
      return Object.freeze({
        theme: input.theme === "custom" ? "custom" : "github",
        concealPrefix: input.concealPrefix !== false,
        colors: Object.freeze(colors),
      });
    }

    function isColor(value) {
      return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
    }

    return Object.freeze({
      STORAGE_KEY,
      COLOR_DEFINITIONS,
      DEFAULT_SETTINGS,
      normalizeSettings,
      isColor,
    });
  },
);
