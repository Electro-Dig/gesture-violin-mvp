# 弓弦 · Gesture Violin

一个完全在浏览器中运行的手势提琴 MVP。摄像头画面铺满舞台，程序化小提琴位于右侧；自由演奏用手掌上下选择音高、左右移动驱动琴弓，引导演奏则让音符沿环形节奏轨抵达左下命中点。

已部署版本：<https://gesture-violin-lab-664.netlify.app/>（可能落后于当前 `feature/gesture-violin-mvp` 分支）

## 交互方式

首页提供两种演奏体验：

- **曲目演奏**：从《欢乐颂》和《D 大调卡农》的开源 MIDI 教程节选中选曲。MIDI 保持基础音高准确，玩家只需在音符抵达左下命中点时改变左右拉弓方向。环形弧长表示音符时值，外圈刻度与底部进度轨显示小节、乐句和全曲进度。
- **自由演奏**：手掌上下在 8 个友好音符间选择音高，左右移动产生拉弓；横向速度同时控制音量、音色亮度、琴弦辉光和松香微粒。

页面提供三种输入模式：

1. **摄像头**：MediaPipe Hand Landmarker 在浏览器本地实时识别一只手。视频镜像并铺满背景，图像不上传、不录制。
2. **鼠标排练**：按住并拖动，走与摄像头相同的手势解释和音乐映射链路；摄像头不可用时也会进入这一显式降级路径。
3. **自动演示**：访问 `/?demo=1` 使用可复现的模拟手势，便于视觉验收；界面会明确标注它不是摄像头输入。

当前单手角色是“选择音高 + 驱动琴弓”。后续双手方案约定为：右手继续控制琴弓方向与力度，左手负责琴弦/音高选择，并用细小横向位移或指间距离表达颤音和强弱；在曲目演奏中，左手只叠加琴弦位置、颤音与表情，不覆盖 MIDI 给出的基础音高。跟踪输出已经保持数组结构，后续可把 `numHands` 从 1 扩到 2，而不改音乐和引擎接口。

## 技术组成与低延迟策略

- TypeScript + Vite
- Three.js 程序化原创小提琴、琴弓、琴弦和粒子
- MediaPipe Tasks Vision，本地托管 WASM 与手势模型
- Web Audio API 实时合成，不使用第三方录音采样
- `requestVideoFrameCallback` 驱动逐视频帧推理；同一媒体时间最多推理一次，不使用固定 28 Hz 轮询
- 手势模型优先使用 GPU delegate，创建失败时自动回退 CPU；界面诊断会显示实际 delegate、跟踪频率和推理耗时
- Node test runner + tsx 覆盖手势稳定、换弓响应、谱面导入和节奏轨模型

没有使用 Viola the Bird 的代码、模型、纹理或录音。本项目只借鉴“移动琴弓来演奏”的一般交互范式，三维几何与声音均由本项目程序化生成。

## 曲谱来源与再生成

两首教学谱来自 Mutopia：

- 《欢乐颂》：Public Domain
- 《D 大调卡农》：CC BY 3.0，界面选曲页持续显示署名与来源链接

原始 MIDI、精确来源、许可证、文件哈希和导入参数见 [`music-sources/README.md`](music-sources/README.md) 与 [`music-sources/manifest.json`](music-sources/manifest.json)。浏览器运行时代码只读取生成后的 TypeScript 旋律数组，不打包 `@tonejs/midi`。

修改清单或源 MIDI 后重新生成：

```bash
pnpm music:import
git diff -- src/music/generated
pnpm test
```

## 浏览器与权限

- 推荐桌面版近期 Chrome 或 Edge；摄像头需要用户授权。
- 公网摄像头访问需要 HTTPS，`localhost` 可用于本地开发。
- 浏览器要求用户点击后才能启动 Web Audio；自动演示默认无声，点击“启用声音”即可。
- 单目摄像头易受逆光、遮挡、运动模糊和低帧率影响；可随时切换鼠标排练。
- Safari 可运行主要 WebGL/Web Audio 内容，但本 MVP 的摄像头路径以 Chromium 为首要验收目标。

## 本地运行与验证

```bash
pnpm install
pnpm music:import
pnpm test
pnpm build
pnpm dev
```

生产构建本地预览：

```bash
pnpm build
pnpm preview
```

本轮浏览器与自动化验证记录见 [`docs/verification/2026-07-21-camera-stage-midi-latency.md`](docs/verification/2026-07-21-camera-stage-midi-latency.md)。

## 部署与回滚

当前 Netlify 站点为 `gesture-violin-lab-664`，站点 ID 为 `29931500-0653-4cc2-af3a-1370ebe20b13`。生产部署必须在本地验证通过并获得明确批准后执行：

```bash
pnpm build
npx netlify-cli deploy --prod --dir dist --site 29931500-0653-4cc2-af3a-1370ebe20b13
```

回滚时在 Netlify Deploys 中选择上一个已验证的生产部署并执行 Publish deploy；代码侧同时 `git revert` 对应变更，重新构建并验证，不覆盖或重写 Git 历史。

## 已知边界

- 当前是程序化合成的“弦乐感”音色，不是采样级真实小提琴；两首引导曲是教学节选，不是完整乐章。
- 当前仍按单手跟踪配置运行；双手职责已经定义，但尚未实现第二只手的身份稳定与遮挡处理。
- ToF、WebHID 或 Web Serial 尚未接入，但输入层已统一为标准化手帧，可在不改动音乐、三维和音频层的前提下新增适配器。
