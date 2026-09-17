// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Search parameters that a nav search shortcut can target on a Patient.
 *
 * These are FHIR search parameter names (not element names): `email` and `phone` are
 * search parameters backed by `Patient.telecom`, and are accepted by both the FHIR search
 * API and the GraphQL `PatientList` field.
 */
export type PatientShortcutSearchParam = 'email' | 'phone' | 'identifier' | 'name' | 'birthdate' | 'address';

/**
 * A shortcut maps a short, human-friendly keyword typed into the nav search (Spotlight) to the
 * search parameter it should be applied to. For example, `email:foo@bar.com` becomes a search
 * on `Patient.email`, which is not reachable from the default name/identifier search.
 */
export interface SearchShortcut {
  /** The search parameter name understood by the FHIR search API and the GraphQL API. */
  readonly searchParam: PatientShortcutSearchParam;
  /** Short helper text describing what the shortcut does. */
  readonly description: string;
}

/**
 * The shortcuts recognized in the nav search.
 *
 * Keys are matched case-insensitively. Any keyword that is not listed here is ignored, so that
 * ordinary free-text searches keep working unchanged - including values that happen to contain
 * a `:` or `=` (such as URLs, or a pasted `Patient?email=x` query).
 */
export const SEARCH_SHORTCUTS: Record<string, SearchShortcut> = {
  email: { searchParam: 'email', description: 'Find a patient by email address' },
  phone: { searchParam: 'phone', description: 'Find a patient by phone number' },
  mrn: { searchParam: 'identifier', description: 'Find a patient by medical record number' },
  name: { searchParam: 'name', description: 'Find a patient by name' },
  birthdate: { searchParam: 'birthdate', description: 'Find a patient by birth date' },
  address: { searchParam: 'address', description: 'Find a patient by address' },
};

/** A parsed shortcut: the keyword the user typed, the value, and the shortcut it resolved to. */
export interface ParsedSearchShortcut {
  readonly key: string;
  readonly value: string;
  readonly shortcut: SearchShortcut;
}

/**
 * Matches `<keyword><separator><value>`, where the separator is either `:` (the command-palette
 * convention used by Gmail, Slack and Spotlight) or `=` (the query-string convention users may
 * bring over from FHIR URLs). Both are accepted so neither habit has to be unlearned.
 *
 * Only the first separator is significant, so values that themselves contain separators (for
 * example `mrn:urn:oid:1.2.3`) are preserved intact.
 */
const SHORTCUT_PATTERN = /^([a-zA-Z][a-zA-Z0-9_-]*)\s*[:=]\s*(\S.*)$/;

/**
 * Parses a nav search query into a shortcut, if it is one.
 *
 * Returns `undefined` for anything that is not a recognized shortcut - plain text, an unknown
 * keyword such as `http://example.com`, or a recognized keyword with no value (`email:`).
 * Callers should fall back to the existing name/identifier search in that case.
 * @param query - The raw text typed into the nav search.
 * @returns The parsed shortcut, or `undefined` if the query is not a recognized shortcut.
 */
export function parseSearchShortcut(query: string): ParsedSearchShortcut | undefined {
  const match = SHORTCUT_PATTERN.exec(query.trim());
  if (!match) {
    return undefined;
  }
  const key = match[1].toLowerCase();
  const shortcut = SEARCH_SHORTCUTS[key];
  if (!shortcut) {
    return undefined;
  }
  const value = match[2].trim();
  if (!value) {
    return undefined;
  }
  return { key, value, shortcut };
}

/**
 * Builds the GraphQL query for a parsed shortcut.
 *
 * The selection set intentionally matches the one used by the default search so that results
 * can be rendered by the same code path.
 * @param parsed - The parsed shortcut.
 * @returns A GraphQL query searching `PatientList` on the shortcut's search parameter.
 */
export function buildShortcutGraphQLQuery(parsed: ParsedSearchShortcut): string {
  const searchParam = parsed.shortcut.searchParam;
  const escaped = JSON.stringify(parsed.value);
  return `{
    ShortcutResults: PatientList(${searchParam}: ${escaped}, _count: 5) {
      resourceType
      id
      identifier { system value }
      name { given family }
      birthDate
      photo { url contentType }
    }
  }`.replaceAll(/\s+/g, ' ');
}
