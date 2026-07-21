import type { ViolinSampleAsset } from "./generated/violinSampleManifest";

export type SampleFetchResponse = {
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type FetchSampleAsset = (url: string) => Promise<SampleFetchResponse>;
export type DecodeSampleAsset = (bytes: ArrayBuffer) => Promise<AudioBuffer>;

export async function loadViolinSamples(
  assets: readonly ViolinSampleAsset[],
  fetchAsset: FetchSampleAsset,
  decodeAsset: DecodeSampleAsset,
): Promise<Map<string, AudioBuffer>> {
  validateManifest(assets);

  const loaded = await Promise.all(
    assets.map(async (asset): Promise<readonly [string, AudioBuffer]> => {
      try {
        const response = await fetchAsset(asset.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await decodeAsset(await response.arrayBuffer());
        return [asset.id, buffer] as const;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${asset.id}: ${message}`);
      }
    }),
  );

  return new Map(loaded);
}

function validateManifest(assets: readonly ViolinSampleAsset[]): void {
  if (assets.length !== 12) {
    throw new Error(`Expected 12 violin sample assets, received ${assets.length}`);
  }
  const ids = new Set<string>();
  const pairs = new Set<string>();
  for (const asset of assets) {
    const pair = `${asset.rootMidi}:${asset.dynamic}`;
    if (ids.has(asset.id) || pairs.has(pair)) {
      throw new Error(`Duplicate violin sample asset: ${asset.id}`);
    }
    ids.add(asset.id);
    pairs.add(pair);
  }
  if (pairs.size !== 12) throw new Error(`Expected 12 unique root/dynamic pairs, received ${pairs.size}`);
}
