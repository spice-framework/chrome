import syntax from "./src/index.cjs";

export const {
  PREFIX,
  TokenKind,
  parseAnnotation,
  parseImportDirective,
  highlightTokens,
  concealmentRange,
  highlightDisplayLine,
  concealmentRangeForDisplayLine,
} = syntax;

export default syntax;
