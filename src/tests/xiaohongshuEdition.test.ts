import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

function source(path: string): string {
  return readFileSync(`${projectRoot}${path}`, "utf8");
}

test("the Xiaohongshu runtime excludes MediaPipe and camera UI", () => {
  const packageJson = JSON.parse(source("package.json")) as {
    dependencies?: Record<string, string>;
  };
  const app = source("src/app.ts");
  const appView = source("src/ui/appView.ts");

  assert.equal(packageJson.dependencies?.["@mediapipe/tasks-vision"], undefined);
  assert.doesNotMatch(app, /HandTracker|activateCamera|mode === "camera"/);
  assert.doesNotMatch(appView, /camera|摄像头|canon-in-d|卡农/i);
});

test("the Xiaohongshu build uses offline relative paths and a safe viewport", () => {
  const viteConfig = source("vite.config.ts");
  const index = source("index.html");

  assert.match(viteConfig, /base:\s*["']\.\/["']/);
  assert.match(viteConfig, /modulePreload:\s*false/);
  assert.match(index, /viewport-fit=cover/);
  assert.match(index, /src=["']\.\/src\/main\.ts["']/);
});
