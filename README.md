# 弦鸟 · 小红书离线版

这是 Gesture Violin 的小红书 Builder Hub 专用分支。它在浏览器中以程序化 3D 弦乐器和 Web Audio 合成音色提供两种体验：

- **曲目演奏**：仅保留公版旋律《欢乐颂》。音高自动推进，玩家在音符条抵达判定线时左右换弓。
- **自由演奏**：上下移动选择音高，左右拖动拉弓，移动速度控制力度和音色。

## 小红书版输入

在舞台内按住并拖动即可演奏，手机触控与桌面鼠标都使用 Pointer Events。访问 `?demo=1` 可运行自动演示，仅供开发验收。

小红书小工具规范禁止 WebAssembly、Worker、传感器和外部硬件连接。原项目的 MediaPipe 手势识别依赖 WebAssembly/Worker，因此本分支不包含摄像头识别；ToF、WebHID 与 Web Serial 也不在小红书容器内启用。

## 隐私与离线能力

- 产物完全本地运行，不发起网络请求。
- 不采集、上传或存储用户数据。
- 不包含摄像头、麦克风、定位或硬件权限请求。
- 3D 几何、材质和音色均由项目程序化生成，不含第三方录音或 Viola the Bird 资产。

《欢乐颂》旋律属于公版作品，本项目只使用自行录入的音高关系与原创简化伴奏。

## 开发与验证

```bash
pnpm install
pnpm test
pnpm build
pnpm preview
```

生产构建输出到 `dist/`。上传 ZIP 时，压缩包根目录必须直接包含 `index.html`，不能再套一层 `dist` 文件夹。

## 技术组成

- TypeScript + Vite
- Three.js 程序化 3D 弦乐器与舞台
- Web Audio API 实时合成
- Pointer Events 统一触控与鼠标输入
- Node test runner + tsx

## 已知限制

- 音色为程序化合成的“弦乐感”，不是真实采样级提琴音色。
- 《欢乐颂》是面向互动教学的短版编配，不是完整乐章。
- 自动演示模式可能因浏览器的自动播放策略而默认无声；正常模式在用户点击后启用声音。
