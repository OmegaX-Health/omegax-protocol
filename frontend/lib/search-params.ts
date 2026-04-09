// SPDX-License-Identifier: AGPL-3.0-or-later

export type RouteSearchParams = Record<string, string | string[] | undefined>;

export function firstSearchParamValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function toURLSearchParams(searchParams: RouteSearchParams | null | undefined): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) params.append(key, item);
      }
      continue;
    }

    if (value) params.set(key, value);
  }

  return params;
}
