export function createRoomImpulseData(
  sampleRate: number,
  seconds: number,
  seed: number,
): [Float32Array, Float32Array] {
  const length = Math.max(1, Math.ceil(sampleRate * seconds));
  const random = xorshift32(seed);
  const createChannel = (): Float32Array => {
    const data = new Float32Array(length);
    for (let index = 0; index < length; index += 1) {
      const progress = index / length;
      const decay = (1 - progress) ** 2.8;
      data[index] = (random() * 2 - 1) * decay * 0.72;
    }
    return data;
  };
  return [createChannel(), createChannel()];
}

export function createRoomImpulseBuffer(
  context: BaseAudioContext,
  seconds = 0.42,
  seed = 0x51c0,
): AudioBuffer {
  const channels = createRoomImpulseData(context.sampleRate, seconds, seed);
  const buffer = context.createBuffer(2, channels[0].length, context.sampleRate);
  buffer.getChannelData(0).set(channels[0]);
  buffer.getChannelData(1).set(channels[1]);
  return buffer;
}

function xorshift32(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}
