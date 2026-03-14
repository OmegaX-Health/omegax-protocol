// SPDX-License-Identifier: AGPL-3.0-or-later

const FAVICON_SVG = `<svg width="162" height="116" viewBox="0 0 162 116" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="162" height="116" rx="28" fill="#08111A"/>
<circle cx="58" cy="58" r="24" stroke="#5DD4FF" stroke-width="10"/>
<path d="M92 34H126V44H102V52H122V62H102V72H126V82H92V34Z" fill="#DFF8FF"/>
<path d="M53 58L65 46" stroke="#DFF8FF" stroke-width="8" stroke-linecap="round"/>
<path d="M65 70L53 58" stroke="#DFF8FF" stroke-width="8" stroke-linecap="round"/>
</svg>
`;

const CACHE_CONTROL = "public, max-age=31536000, immutable";

export function GET(): Response {
  return new Response(FAVICON_SVG, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": CACHE_CONTROL,
    },
  });
}

export function HEAD(): Response {
  return new Response(null, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": CACHE_CONTROL,
    },
  });
}
