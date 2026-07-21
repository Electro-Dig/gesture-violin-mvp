import assert from "node:assert/strict";
import test from "node:test";

import { VIOLIN_SAMPLE_MANIFEST, type ViolinSampleAsset } from "../audio/generated/violinSampleManifest";
import { loadViolinSamples, type SampleFetchResponse } from "../audio/violinSampleLoader";

const fakeBuffer = { duration: 7.5 } as AudioBuffer;

test("loads and decodes the complete manifest before returning buffers", async () => {
  const fetched: string[] = [];
  const decoded: number[] = [];
  const buffers = await loadViolinSamples(
    VIOLIN_SAMPLE_MANIFEST,
    async (url) => {
      fetched.push(url);
      return response(true, 200);
    },
    async (bytes) => {
      decoded.push(bytes.byteLength);
      return fakeBuffer;
    },
  );

  assert.equal(buffers.size, 12);
  assert.equal(fetched.length, 12);
  assert.equal(decoded.length, 12);
  VIOLIN_SAMPLE_MANIFEST.forEach((asset) => assert.equal(buffers.get(asset.id), fakeBuffer));
});

test("reports the concrete asset id for HTTP and decode failures", async () => {
  const failingUrl = VIOLIN_SAMPLE_MANIFEST[3]!.url;
  const failingId = VIOLIN_SAMPLE_MANIFEST[3]!.id;
  await assert.rejects(
    loadViolinSamples(
      VIOLIN_SAMPLE_MANIFEST,
      async (url) => response(url !== failingUrl, url === failingUrl ? 503 : 200),
      async () => fakeBuffer,
    ),
    new RegExp(`${failingId}.*HTTP 503`),
  );

  await assert.rejects(
    loadViolinSamples(
      VIOLIN_SAMPLE_MANIFEST,
      async () => response(true, 200),
      async () => {
        throw new Error("unsupported audio");
      },
    ),
    /c4-p.*unsupported audio/,
  );
});

test("rejects duplicate or incomplete manifests before fetching", async () => {
  let fetches = 0;
  const fetchAsset = async (): Promise<SampleFetchResponse> => {
    fetches += 1;
    return response(true, 200);
  };
  const duplicate = [...VIOLIN_SAMPLE_MANIFEST.slice(0, -1), VIOLIN_SAMPLE_MANIFEST[0]!] as ViolinSampleAsset[];

  await assert.rejects(loadViolinSamples(duplicate, fetchAsset, async () => fakeBuffer), /duplicate/i);
  await assert.rejects(
    loadViolinSamples(VIOLIN_SAMPLE_MANIFEST.slice(0, -1), fetchAsset, async () => fakeBuffer),
    /12.*11/,
  );
  assert.equal(fetches, 0);
});

function response(ok: boolean, status: number): SampleFetchResponse {
  return {
    ok,
    status,
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  };
}
