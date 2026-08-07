import syntax from "./src/index.cjs";

export const {
  PREFIX,
  TokenKind,
  parseAnnotation,
  parseImportDirective,
  highlightTokens,
  concealmentRange,
} = syntax;

export default syntax;
