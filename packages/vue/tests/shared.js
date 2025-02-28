// test-helpers.js
import {expect} from '@jest/globals';

/**
 * Creates a code block object with location information
 * @param {string} code - The source code
 * @returns {Object} Block object with content and location info
 */
export function makeBlock(code) {
  return {
    content: code,
    loc: {start: {offset: 0}, end: {offset: code.length}}
  };
}

function compareStrings(received, expected) {
  const minLength = Math.min(received.length, expected.length);
  let diffIndex = -1;

  // Find the index of the first difference.
  for (let i = 0; i < minLength; i++) {
    if (received[i] !== expected[i]) {
      diffIndex = i;
      break;
    }
  }

  // If no difference found in the overlapping part,
  // consider a difference at the end if the lengths differ.
  if (diffIndex === -1) {
    if (received.length !== expected.length) {
      diffIndex = minLength;
    } else {
      // Strings are identical.
      return null;
    }
  }

  const contextBefore = 10;
  const contextAfter = 10;

  // Calculate start and end indices, ensuring we don't go out-of-bounds.
  const start = Math.max(0, diffIndex - contextBefore);
  const end = diffIndex + contextAfter + 1; // +1 to include the differing character.

  const receivedContext = received.slice(start, end);
  const expectedContext = expected.slice(start, end);

  return {diffIndex, receivedContext, expectedContext};
}

/**
 * Custom Jest matcher for comparing code strings while ignoring whitespace differences
 */
export function setupCodeMatcher() {
  expect.extend({
    toMatchCode(received, expected) {
      const normalize = str => str.replace(/\s+/g, ' ').trim();
      const normalizedReceived = normalize(received);
      const normalizedExpected = normalize(expected);
      const pass = normalizedReceived === normalizedExpected;

      if (pass) {
        return {
          message: () =>
            `Expected code not to match:\n` +
            `Expected: ${this.utils.printExpected(normalizedExpected)}\n` +
            `Received: ${this.utils.printReceived(normalizedReceived)}`,
          pass: true
        };
      } else {
        const diff = compareStrings(normalizedReceived, normalizedExpected);
        return {
          message: () =>
            `Expected code to match:\n` +
            `Minor diff:\n` +
            `Expected: ${this.utils.printExpected(diff.expectedContext)}\n` +
            `Received: ${this.utils.printReceived(diff.receivedContext)}\n` +
            `\n` +
            `Full diff:\n` +
            `Expected: ${this.utils.printExpected(normalizedExpected)}\n` +
            `Received: ${this.utils.printReceived(normalizedReceived)}`,
          pass: false
        };
      }
    }
  });
}