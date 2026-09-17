// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import type { ParsedSearchShortcut } from './spotlight-search';
import { buildShortcutGraphQLQuery, parseSearchShortcut, SEARCH_SHORTCUTS } from './spotlight-search';

/**
 * Parses a query that is expected to be a recognized shortcut, or throws.
 * @param query - The raw user search query.
 * @returns The parsed shortcut.
 */
function parseOrThrow(query: string): ParsedSearchShortcut {
  const parsed = parseSearchShortcut(query);
  if (!parsed) {
    throw new Error(`Expected a shortcut: ${query}`);
  }
  return parsed;
}

describe('parseSearchShortcut', () => {
  test('parses a colon separator', () => {
    expect(parseSearchShortcut('email:foo@bar.com')).toEqual({
      key: 'email',
      value: 'foo@bar.com',
      shortcut: SEARCH_SHORTCUTS.email,
    });
  });

  test('parses an equals separator', () => {
    expect(parseSearchShortcut('email=foo@bar.com')).toEqual({
      key: 'email',
      value: 'foo@bar.com',
      shortcut: SEARCH_SHORTCUTS.email,
    });
  });

  test('matches the keyword case-insensitively', () => {
    expect(parseSearchShortcut('EMAIL:foo@bar.com')).toEqual({
      key: 'email',
      value: 'foo@bar.com',
      shortcut: SEARCH_SHORTCUTS.email,
    });
  });

  test('trims surrounding whitespace', () => {
    expect(parseSearchShortcut('  email: foo@bar.com  ')?.value).toBe('foo@bar.com');
  });

  test('keeps separators inside the value', () => {
    expect(parseSearchShortcut('mrn:urn:oid:1.2.3')?.value).toBe('urn:oid:1.2.3');
  });

  test('maps mrn to the identifier search parameter', () => {
    expect(parseSearchShortcut('mrn:12345')?.shortcut.searchParam).toBe('identifier');
  });

  test('maps phone to the phone search parameter', () => {
    expect(parseSearchShortcut('phone:5551234567')?.shortcut.searchParam).toBe('phone');
  });

  test.each(['Jane Smith', 'Smith, Jane', '5551234567'])('returns undefined for plain text: %s', (query) => {
    expect(parseSearchShortcut(query)).toBeUndefined();
  });

  test('returns undefined for an unknown keyword', () => {
    expect(parseSearchShortcut('npi:1234567890')).toBeUndefined();
  });

  test('returns undefined for a URL', () => {
    expect(parseSearchShortcut('http://example.com')).toBeUndefined();
  });

  test('returns undefined for a pasted FHIR query', () => {
    expect(parseSearchShortcut('Patient?email=foo@bar.com')).toBeUndefined();
  });

  test('returns undefined when the value is missing', () => {
    expect(parseSearchShortcut('email:')).toBeUndefined();
  });

  test('returns undefined when the value is only whitespace', () => {
    expect(parseSearchShortcut('email:   ')).toBeUndefined();
  });

  test('returns undefined for an empty query', () => {
    expect(parseSearchShortcut('')).toBeUndefined();
  });

  test('returns undefined when the keyword does not start with a letter', () => {
    expect(parseSearchShortcut('=foo@bar.com')).toBeUndefined();
  });
});

describe('buildShortcutGraphQLQuery', () => {
  test('builds a PatientList query for the shortcut search parameter', () => {
    const parsed = parseOrThrow('email:foo@bar.com');
    expect(buildShortcutGraphQLQuery(parsed)).toBe(
      '{ ShortcutResults: PatientList(email: "foo@bar.com", _count: 5) { resourceType id identifier { system value } name { given family } birthDate photo { url contentType } } }'
    );
  });

  test('escapes the value', () => {
    const parsed = parseOrThrow('name:Jane "JJ" Smith');
    expect(buildShortcutGraphQLQuery(parsed)).toContain('name: "Jane \\"JJ\\" Smith"');
  });

  test('uses the identifier search parameter for mrn', () => {
    const parsed = parseOrThrow('mrn:12345');
    expect(buildShortcutGraphQLQuery(parsed)).toContain('PatientList(identifier: "12345", _count: 5)');
  });
});
