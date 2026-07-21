import assert from "node:assert/strict";
import test from "node:test";

import { curlDownloadArguments } from "../../scripts/lib/violinSampleImporter";

test("curl fallback downloads one immutable source without shell interpolation", () => {
  assert.deepEqual(curlDownloadArguments("https://example.test/sample.wav", "cache/sample.wav"), [
    "-L",
    "--fail",
    "--silent",
    "--show-error",
    "--retry",
    "3",
    "--connect-timeout",
    "20",
    "https://example.test/sample.wav",
    "-o",
    "cache/sample.wav",
  ]);
});
