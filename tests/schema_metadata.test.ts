// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import test from 'node:test';

import schemaMetadataModule from '../frontend/lib/schema-metadata.ts';

const { parseSchemaOutcomes, fetchSchemaMetadata } =
  schemaMetadataModule as unknown as typeof import('../frontend/lib/schema-metadata.ts');

test('parseSchemaOutcomes accepts canonical metadata and normalizes hashes', () => {
  const metadata = {
    specVersion: 'omegax.schema.v2',
    outcomes: [
      {
        id: ' pass ',
        label: ' Pass ',
        description: '  Meets threshold  ',
        valueHashHex: `0x${'ab'.repeat(32)}`,
        metricId: 'steps_avg_7d',
        metricWindow: '7d',
        comparator: '>=',
        threshold: 7000,
        unit: 'steps/day',
        severity: 'secondary',
        tags: [' activity ', 'daily'],
        evidence: {
          minSamples: 4,
          minDaysCovered: 4,
          minQuality: 'ok',
          requiredProofMetricIds: ['data_completeness_14d'],
        },
      },
      {
        id: 'fail',
        label: 'Fail',
      },
    ],
    outcomeTemplates: [
      {
        id: 'steps_threshold',
        label: 'Steps threshold',
        kind: 'metric_threshold',
        metricId: 'steps_avg_7d',
        metricWindow: '7d',
        unit: 'steps/day',
        comparators: ['>='],
        thresholdPolicy: {
          suggested: [5000, 7000, 10000],
          min: 0,
          max: null,
          step: 1,
          decimals: 0,
        },
      },
    ],
  };

  const parsed = parseSchemaOutcomes(metadata);
  assert.equal(parsed.warnings.length, 0);
  assert.equal(parsed.outcomes.length, 2);
  assert.equal(parsed.outcomeTemplates.length, 1);
  assert.deepEqual(parsed.outcomes[0], {
    id: 'pass',
    label: 'Pass',
    description: 'Meets threshold',
    valueHashHex: 'ab'.repeat(32),
    metricId: 'steps_avg_7d',
    metricWindow: '7d',
    comparator: '>=',
    threshold: 7000,
    unit: 'steps/day',
    severity: 'secondary',
    tags: ['activity', 'daily'],
    evidence: {
      minSamples: 4,
      minDaysCovered: 4,
      minQuality: 'ok',
      requiredProofMetricIds: ['data_completeness_14d'],
    },
  });
  assert.deepEqual(parsed.outcomes[1], {
    id: 'fail',
    label: 'Fail',
  });
  assert.deepEqual(parsed.outcomeTemplates[0], {
    id: 'steps_threshold',
    label: 'Steps threshold',
    kind: 'metric_threshold',
    metricId: 'steps_avg_7d',
    metricWindow: '7d',
    unit: 'steps/day',
    comparators: ['>='],
    thresholdPolicy: {
      suggested: [5000, 7000, 10000],
      min: 0,
      max: null,
      step: 1,
      decimals: 0,
    },
  });
});

test('parseSchemaOutcomes accepts numeric schema version guard', () => {
  const parsed = parseSchemaOutcomes({
    specVersion: 1,
    outcomes: [{ id: 'ok', label: 'Okay' }],
  });

  assert.equal(parsed.warnings.length, 0);
  assert.equal(parsed.outcomes.length, 1);
  assert.equal(parsed.outcomeTemplates.length, 0);
  assert.equal(parsed.outcomes[0]?.id, 'ok');
});

test('parseSchemaOutcomes rejects unsupported versions and malformed outcome values safely', () => {
  const parsed = parseSchemaOutcomes({
    specVersion: 'omegax.schema.v0',
    outcomes: [
      { id: 'dup', label: 'First' },
      { id: 'dup', label: 'Second' },
      { id: 'bad', label: 'Bad', valueHashHex: 'not-hex' },
      { id: '', label: 'Missing ID' },
    ],
  });

  assert.equal(parsed.outcomes.length, 2);
  assert.equal(parsed.outcomeTemplates.length, 0);
  assert.equal(parsed.outcomes[0]?.id, 'dup');
  assert.equal(parsed.outcomes[1]?.id, 'bad');
  assert.ok(parsed.warnings.some((warning) => warning.includes('Unsupported schema metadata version')));
  assert.ok(parsed.warnings.some((warning) => warning.includes('invalid valueHashHex')));
});

test('parseSchemaOutcomes returns warnings when outcomes shape is missing', () => {
  const parsed = parseSchemaOutcomes({ specVersion: 'omegax.schema' });

  assert.equal(parsed.outcomes.length, 0);
  assert.equal(parsed.outcomeTemplates.length, 0);
  assert.ok(parsed.warnings.some((warning) => warning.includes('outcomes array')));
});

test('fetchSchemaMetadata returns structured error for non-JSON content types', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response('<html></html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })) as typeof fetch;

  try {
    const fetched = await fetchSchemaMetadata('https://example.com/schema.json');
    assert.equal(fetched.metadata, null);
    assert.equal(fetched.error?.code, 'non_json_content_type');
    assert.ok(fetched.error?.message.includes('non-JSON content type'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchSchemaMetadata accepts JSON payloads served with non-JSON content types', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        specVersion: 'omegax.schema',
        outcomes: [{ id: 'ok', label: 'Okay' }],
      }),
      {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      },
    )) as typeof fetch;

  try {
    const fetched = await fetchSchemaMetadata('https://example.com/schema.json');
    assert.equal(fetched.error, null);
    assert.equal(Array.isArray((fetched.metadata as any)?.outcomes), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchSchemaMetadata supports ipfs:// URIs via gateway rewrite', async () => {
  const originalGateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE;
  const originalFetch = globalThis.fetch;
  const seenUrls: string[] = [];

  process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE = 'https://example.gateway/ipfs';
  globalThis.fetch = (async (input) => {
    seenUrls.push(String(input));
    return new Response(
      JSON.stringify({
        specVersion: 'omegax.schema',
        outcomes: [{ id: 'ok', label: 'Okay' }],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    const fetched = await fetchSchemaMetadata('ipfs://QmCID123/metadata.json');
    assert.equal(fetched.error, null);
    assert.equal(Array.isArray((fetched.metadata as any)?.outcomes), true);
    assert.equal(seenUrls[0], 'https://example.gateway/ipfs/QmCID123/metadata.json');
  } finally {
    process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE = originalGateway;
    globalThis.fetch = originalFetch;
  }
});

test('fetchSchemaMetadata retries across configured gateways for ipfs http URL formats', async () => {
  const originalGateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE;
  const originalFetch = globalThis.fetch;
  const seenUrls: string[] = [];

  process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE = 'https://example.gateway/ipfs';
  globalThis.fetch = (async (input) => {
    const url = String(input);
    seenUrls.push(url);
    if (url.startsWith('https://ipfs.io/ipfs/')) {
      return new Response('unavailable', {
        status: 503,
        headers: { 'content-type': 'text/plain' },
      });
    }
    return new Response(
      JSON.stringify({
        specVersion: 'omegax.schema',
        outcomes: [{ id: 'ok', label: 'Okay' }],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    const fetched = await fetchSchemaMetadata('https://ipfs.io/ipfs/QmCID123/metadata.json');
    assert.equal(fetched.error, null);
    assert.equal(Array.isArray((fetched.metadata as any)?.outcomes), true);
    assert.equal(seenUrls[0], 'https://ipfs.io/ipfs/QmCID123/metadata.json');
    assert.ok(seenUrls.some((url) => url.startsWith('https://example.gateway/ipfs/QmCID123/metadata.json')));
  } finally {
    process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE = originalGateway;
    globalThis.fetch = originalFetch;
  }
});

test('fetchSchemaMetadata retries known schema mirror host for omegax schema URLs', async () => {
  const originalFetch = globalThis.fetch;
  const seenUrls: string[] = [];

  globalThis.fetch = (async (input) => {
    const url = String(input);
    seenUrls.push(url);
    if (url.startsWith('https://omegax.health/schemas/')) {
      return new Response('<html></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    return new Response(
      JSON.stringify({
        specVersion: 'omegax.schema',
        outcomes: [{ id: 'ok', label: 'Okay' }],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    const fetched = await fetchSchemaMetadata('https://omegax.health/schemas/health_outcomes.json');
    assert.equal(fetched.error, null);
    assert.equal(Array.isArray((fetched.metadata as any)?.outcomes), true);
    assert.equal(seenUrls[0], 'https://omegax.health/schemas/health_outcomes.json');
    assert.ok(seenUrls.some((url) => url.startsWith('https://protocol.omegax.health/schemas/health_outcomes.json')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchSchemaMetadata returns structured error for network failures', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('network down');
  }) as typeof fetch;

  try {
    const fetched = await fetchSchemaMetadata('https://example.com/schema.json');
    assert.equal(fetched.metadata, null);
    assert.equal(fetched.error?.code, 'fetch_failed');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
