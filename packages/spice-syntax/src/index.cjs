(function initializeSpiceSyntax(root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.SpiceSyntax = api;
  }
})(
  typeof globalThis === "undefined" ? this : globalThis,
  function createSpiceSyntax() {
    "use strict";

    const PREFIX = "// @";
    const NAMED_IMPORT_DIRECTIVE =
      /^\/\/ @import\s+\{([^}]+)}\s+from\s+"([^"]+)"\s*$/;
    const NAMESPACE_IMPORT_DIRECTIVE =
      /^\/\/ @import\s+\*\s+as\s+([A-Za-z_][A-Za-z0-9_]*)\s+from\s+"([^"]+)"\s*$/;
    const IMPORT_BINDING =
      /^\s*([A-Za-z_][A-Za-z0-9_]*)(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?\s*$/;

    const TokenKind = Object.freeze({
      PREFIX: "PREFIX",
      SIGIL: "SIGIL",
      NAMESPACE: "NAMESPACE",
      ANNOTATION: "ANNOTATION",
      PARAMETER: "PARAMETER",
      IMPORT_SYMBOL: "IMPORT_SYMBOL",
      IMPORT_ALIAS: "IMPORT_ALIAS",
      TYPE_REFERENCE: "TYPE_REFERENCE",
      STRING: "STRING",
      NUMBER: "NUMBER",
      BOOLEAN: "BOOLEAN",
      IDENTIFIER: "IDENTIFIER",
      KEYWORD: "KEYWORD",
      OPERATOR: "OPERATOR",
    });

    function parseAnnotation(comment) {
      if (!comment.startsWith(PREFIX)) {
        return null;
      }
      const nameStart = PREFIX.length;
      if (
        nameStart >= comment.length ||
        !isIdentifierStart(comment[nameStart])
      ) {
        return null;
      }
      let offset = nameStart;
      let segmentStart = true;
      while (offset < comment.length) {
        const value = comment[offset];
        if (value === ".") {
          if (segmentStart) {
            return null;
          }
          segmentStart = true;
          offset += 1;
          continue;
        }
        if (
          !isIdentifierCharacter(value) ||
          (segmentStart && !isIdentifierStart(value))
        ) {
          break;
        }
        segmentStart = false;
        offset += 1;
      }
      if (segmentStart || !isValidSuffix(comment, offset)) {
        return null;
      }
      return Object.freeze({
        name: comment.slice(nameStart, offset),
        prefixRange: Object.freeze([0, PREFIX.length - 1]),
        referenceRange: Object.freeze([PREFIX.length - 1, offset]),
      });
    }

    function highlightTokens(comment) {
      const parsed = parseAnnotation(comment);
      if (!parsed) {
        return highlightImportDirective(comment);
      }
      const tokens = [];
      addToken(tokens, TokenKind.PREFIX, ...parsed.prefixRange);
      addAnnotationNameTokens(tokens, comment, parsed.referenceRange);
      let offset = parsed.referenceRange[1];
      while (offset < comment.length) {
        const value = comment[offset];
        if (/\s/.test(value)) {
          offset += 1;
          continue;
        }
        if (value === '"') {
          const end = quotedEnd(comment, offset);
          addToken(tokens, TokenKind.STRING, offset, end);
          offset = end;
          continue;
        }
        if (isNumberStart(comment, offset)) {
          let end = offset + 1;
          while (end < comment.length && isDigit(comment[end])) {
            end += 1;
          }
          addToken(tokens, TokenKind.NUMBER, offset, end);
          offset = end;
          continue;
        }
        if (isIdentifierStart(value)) {
          let end = offset + 1;
          while (end < comment.length && isIdentifierCharacter(comment[end])) {
            end += 1;
          }
          let next = end;
          while (next < comment.length && /\s/.test(comment[next])) {
            next += 1;
          }
          if (next < comment.length && comment[next] === ".") {
            offset = addQualifiedTypeTokens(tokens, comment, offset, end);
            continue;
          }
          const identifier = comment.slice(offset, end);
          let kind = TokenKind.IDENTIFIER;
          if (next < comment.length && comment[next] === "=") {
            kind = TokenKind.PARAMETER;
          } else if (["true", "false", "nil"].includes(identifier)) {
            kind = TokenKind.BOOLEAN;
          } else if (isUppercase(identifier[0])) {
            kind = TokenKind.TYPE_REFERENCE;
          }
          addToken(tokens, kind, offset, end);
          offset = end;
          continue;
        }
        if ("()[]=,{}*:".includes(value)) {
          addToken(tokens, TokenKind.OPERATOR, offset, offset + 1);
        }
        offset += 1;
      }
      return Object.freeze(tokens);
    }

    function parseImportDirective(comment) {
      const named = NAMED_IMPORT_DIRECTIVE.exec(comment);
      if (named) {
        const bindings = [];
        const source = named[1];
        const sourceStart = comment.indexOf("{") + 1;
        let bindingStart = 0;
        while (bindingStart <= source.length) {
          const separator = source.indexOf(",", bindingStart);
          const bindingEnd = separator < 0 ? source.length : separator;
          const raw = source.slice(bindingStart, bindingEnd);
          const binding = IMPORT_BINDING.exec(raw);
          if (!binding) {
            return null;
          }
          const importedOffset = raw.indexOf(binding[1]);
          const importedStart = sourceStart + bindingStart + importedOffset;
          const importedRange = [
            importedStart,
            importedStart + binding[1].length,
          ];
          let localName = binding[1];
          let localRange = importedRange;
          if (binding[2]) {
            localName = binding[2];
            const aliasOffset = raw.lastIndexOf(binding[2]);
            const aliasStart = sourceStart + bindingStart + aliasOffset;
            localRange = [aliasStart, aliasStart + binding[2].length];
          }
          bindings.push(
            Object.freeze({
              importedName: binding[1],
              importedRange: Object.freeze(importedRange),
              localName,
              localRange: Object.freeze(localRange),
              namespace: false,
            }),
          );
          if (separator < 0) {
            break;
          }
          bindingStart = separator + 1;
        }
        const packageStart = comment.lastIndexOf(named[2]);
        return Object.freeze({
          packagePath: named[2],
          packageRange: Object.freeze([
            packageStart,
            packageStart + named[2].length,
          ]),
          bindings: Object.freeze(bindings),
        });
      }

      const namespace = NAMESPACE_IMPORT_DIRECTIVE.exec(comment);
      if (!namespace) {
        return null;
      }
      const namespaceStart = comment.indexOf(
        namespace[1],
        comment.indexOf(" as ", PREFIX.length) + " as ".length,
      );
      const packageStart = comment.lastIndexOf(namespace[2]);
      return Object.freeze({
        packagePath: namespace[2],
        packageRange: Object.freeze([
          packageStart,
          packageStart + namespace[2].length,
        ]),
        bindings: Object.freeze([
          Object.freeze({
            importedName: "",
            importedRange: Object.freeze([0, 0]),
            localName: namespace[1],
            localRange: Object.freeze([
              namespaceStart,
              namespaceStart + namespace[1].length,
            ]),
            namespace: true,
          }),
        ]),
      });
    }

    function concealmentRange(comment) {
      if (comment === PREFIX) {
        return Object.freeze([0, PREFIX.length - 1]);
      }
      const parsed = parseAnnotation(comment);
      if (parsed) {
        return parsed.prefixRange;
      }
      if (parseImportDirective(comment)) {
        return Object.freeze([0, PREFIX.length - 1]);
      }
      return null;
    }

    function skipIndent(source, start) {
      let offset = start;
      while (
        offset < source.length &&
        (source[offset] === " " || source[offset] === "\t")
      ) {
        offset += 1;
      }
      return offset;
    }

    function displayLineOffset(source) {
      if (typeof source !== "string") {
        return -1;
      }
      const afterIndent = skipIndent(source, 0);
      if (
        afterIndent < source.length &&
        (source[afterIndent] === "+" || source[afterIndent] === "-")
      ) {
        const afterMarker = skipIndent(source, afterIndent + 1);
        if (highlightTokens(source.slice(afterMarker)).length > 0) {
          return afterMarker;
        }
      }
      return highlightTokens(source.slice(afterIndent)).length > 0
        ? afterIndent
        : -1;
    }

    function shiftRange(range, offset) {
      return Object.freeze([range[0] + offset, range[1] + offset]);
    }

    function highlightDisplayLine(source) {
      const offset = displayLineOffset(source);
      if (offset < 0) {
        return Object.freeze([]);
      }
      return Object.freeze(
        highlightTokens(source.slice(offset)).map((token) =>
          Object.freeze({
            kind: token.kind,
            start: token.start + offset,
            end: token.end + offset,
          }),
        ),
      );
    }

    function concealmentRangeForDisplayLine(source) {
      const offset = displayLineOffset(source);
      if (offset < 0) {
        return null;
      }
      const range = concealmentRange(source.slice(offset));
      return range ? shiftRange(range, offset) : null;
    }

    function addAnnotationNameTokens(tokens, comment, range) {
      const sigil = range[0];
      addToken(tokens, TokenKind.SIGIL, sigil, sigil + 1);
      let nameStart = sigil + 1;
      const separator = comment.lastIndexOf(".", range[1] - 1);
      if (separator >= nameStart) {
        addToken(tokens, TokenKind.NAMESPACE, nameStart, separator);
        addToken(tokens, TokenKind.OPERATOR, separator, separator + 1);
        nameStart = separator + 1;
      }
      addToken(tokens, TokenKind.ANNOTATION, nameStart, range[1]);
    }

    function highlightImportDirective(comment) {
      const parsed = parseImportDirective(comment);
      if (!parsed) {
        return Object.freeze([]);
      }
      const tokens = [];
      addToken(tokens, TokenKind.PREFIX, 0, PREFIX.length - 1);
      const sigil = PREFIX.length - 1;
      addToken(tokens, TokenKind.SIGIL, sigil, sigil + 1);
      const importStart = sigil + 1;
      const importEnd = importStart + "import".length;
      addToken(tokens, TokenKind.KEYWORD, importStart, importEnd);
      const semanticRanges = new Map();
      for (const binding of parsed.bindings) {
        if (binding.namespace) {
          semanticRanges.set(binding.localRange[0], {
            kind: TokenKind.NAMESPACE,
            end: binding.localRange[1],
          });
          continue;
        }
        semanticRanges.set(binding.importedRange[0], {
          kind: TokenKind.IMPORT_SYMBOL,
          end: binding.importedRange[1],
        });
        if (binding.localRange[0] !== binding.importedRange[0]) {
          semanticRanges.set(binding.localRange[0], {
            kind: TokenKind.IMPORT_ALIAS,
            end: binding.localRange[1],
          });
        }
      }
      let offset = importEnd;
      while (offset < comment.length) {
        const semantic = semanticRanges.get(offset);
        if (semantic) {
          addToken(tokens, semantic.kind, offset, semantic.end);
          offset = semantic.end;
          continue;
        }
        const value = comment[offset];
        if (/\s/.test(value)) {
          offset += 1;
          continue;
        }
        if (value === '"') {
          const end = quotedEnd(comment, offset);
          addToken(tokens, TokenKind.STRING, offset, end);
          offset = end;
          continue;
        }
        if (isIdentifierStart(value)) {
          let end = offset + 1;
          while (end < comment.length && isIdentifierCharacter(comment[end])) {
            end += 1;
          }
          const identifier = comment.slice(offset, end);
          let kind = TokenKind.IMPORT_SYMBOL;
          if (identifier === "as" || identifier === "from") {
            kind = TokenKind.KEYWORD;
          }
          addToken(tokens, kind, offset, end);
          offset = end;
          continue;
        }
        if ("{}*,".includes(value)) {
          addToken(tokens, TokenKind.OPERATOR, offset, offset + 1);
        }
        offset += 1;
      }
      return Object.freeze(tokens);
    }

    function addQualifiedTypeTokens(tokens, comment, start, firstEnd) {
      let segmentStart = start;
      let segmentEnd = firstEnd;
      while (segmentEnd < comment.length && comment[segmentEnd] === ".") {
        addToken(tokens, TokenKind.NAMESPACE, segmentStart, segmentEnd);
        addToken(tokens, TokenKind.OPERATOR, segmentEnd, segmentEnd + 1);
        segmentStart = segmentEnd + 1;
        if (
          segmentStart >= comment.length ||
          !isIdentifierStart(comment[segmentStart])
        ) {
          return segmentStart;
        }
        segmentEnd = segmentStart + 1;
        while (
          segmentEnd < comment.length &&
          isIdentifierCharacter(comment[segmentEnd])
        ) {
          segmentEnd += 1;
        }
      }
      addToken(tokens, TokenKind.TYPE_REFERENCE, segmentStart, segmentEnd);
      return segmentEnd;
    }

    function quotedEnd(comment, start) {
      let escaped = false;
      for (let offset = start + 1; offset < comment.length; offset += 1) {
        const value = comment[offset];
        if (value === '"' && !escaped) {
          return offset + 1;
        }
        escaped = value === "\\" && !escaped;
      }
      return comment.length;
    }

    function addToken(tokens, kind, start, end) {
      tokens.push(Object.freeze({ kind, start, end }));
    }

    function isValidSuffix(comment, offset) {
      if (offset === comment.length || comment[offset] === "(") {
        return true;
      }
      for (let index = offset; index < comment.length; index += 1) {
        const value = comment[index];
        if (value !== " " && value !== "\t" && value !== "\r") {
          return value === "(";
        }
      }
      return true;
    }

    function isNumberStart(comment, offset) {
      const value = comment[offset];
      return (
        isDigit(value) ||
        (value === "-" &&
          offset + 1 < comment.length &&
          isDigit(comment[offset + 1]))
      );
    }

    function isIdentifierStart(value) {
      return Boolean(value && /[A-Za-z_]/.test(value));
    }

    function isIdentifierCharacter(value) {
      return Boolean(value && /[A-Za-z0-9_]/.test(value));
    }

    function isDigit(value) {
      return Boolean(value && /[0-9]/.test(value));
    }

    function isUppercase(value) {
      return Boolean(value && value >= "A" && value <= "Z");
    }

    return Object.freeze({
      PREFIX,
      TokenKind,
      parseAnnotation,
      parseImportDirective,
      highlightTokens,
      concealmentRange,
      highlightDisplayLine,
      concealmentRangeForDisplayLine,
    });
  },
);
