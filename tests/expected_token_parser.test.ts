import { describe, it, expect } from 'vitest';
import { TmdParser, TMDParseError } from '../src/core/parser.js';

describe('Expected tokens on TMD parse syntax errors', () => {
  it('reports expected tokens when ::SCORE:: is missing', () => {
    expect.assertions(6);
    try {
      TmdParser.parseThrowing('not-a-score');
    } catch (error) {
      expect(error).toBeInstanceOf(TMDParseError);
      const err = error as TMDParseError;
      expect(err.text).toBe('not-a-score');
      expect(err.range.start.line).toBe(1);
      expect(err.range.start.column).toBe(1);
      expect(err.expectedTokens).toContain('::SCORE::');
      expect(err.message).toContain('expected ::SCORE::');
    }
  });

  it('reports expected token for malformed paragraph missing colon', () => {
    expect.assertions(5);
    try {
      TmdParser.parseThrowing('::SCORE::\nintro');
    } catch (error) {
      expect(error).toBeInstanceOf(TMDParseError);
      const err = error as TMDParseError;
      expect(err.text).toBe('intro');
      expect(err.range.start.line).toBe(2);
      expect(err.expectedTokens).toContain(':');
      expect(err.message).toContain('expected :');
    }
  });

  it('reports expected tokens for missing @ in paragraph header', () => {
    expect.assertions(4);
    try {
      TmdParser.parseThrowing('::SCORE::\nintro:Piano|0|{\n<4*>\n1 2 3 4\n}');
    } catch (error) {
      expect(error).toBeInstanceOf(TMDParseError);
      const err = error as TMDParseError;
      expect(err.expectedTokens).toContain('@');
      expect(err.message).toContain('expected @');
      expect(err.description).toContain('expected @');
    }
  });

  it('reports expected tokens for missing { in paragraph header', () => {
    expect.assertions(4);
    try {
      TmdParser.parseThrowing('::SCORE::\nintro:Piano@|0|\n<4*>\n1 2 3 4\n}');
    } catch (error) {
      expect(error).toBeInstanceOf(TMDParseError);
      const err = error as TMDParseError;
      expect(err.expectedTokens).toContain('{');
      expect(err.message).toContain('expected {');
      expect(err.description).toContain('expected {');
    }
  });

  it('reports expected tokens for missing < inside paragraph section', () => {
    expect.assertions(4);
    try {
      TmdParser.parseThrowing('::SCORE::\nintro:Piano@|0|{\n4*>\n1 2 3 4\n}');
    } catch (error) {
      expect(error).toBeInstanceOf(TMDParseError);
      const err = error as TMDParseError;
      expect(err.expectedTokens).toContain('<');
      expect(err.message).toContain('expected <');
      expect(err.description).toContain('expected <');
    }
  });
});
