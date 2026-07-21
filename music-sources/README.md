# MIDI 曲谱来源

本目录保存构建引导曲目所需的、已审核许可与哈希的 MIDI 原件。浏览器不会加载这些文件；`pnpm music:import` 仅在 Node.js 中解析它们，并生成稳定的 TypeScript 旋律数据。

## Beethoven — Ode to Joy

- 作曲：Ludwig van Beethoven
- 来源：[Mutopia Project, piece 528](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528)
- 许可：Public Domain
- 文件：`mutopia/Beethoven-Ode-to-Joy-Mutopia-PD.mid`
- SHA-256：`fb1604c08c865b275b464d74e5a7c526ff1a8acccdf9853cb92f0778daaed14b`
- 使用方式：取上声部轨道的最高活动声部，量化到八分音符边界，降七个半音，并截取 0–48 拍。

## Pachelbel — Canon in D

- 作曲：Johann Pachelbel
- 来源：[Mutopia Project, piece 1700](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1700)
- 许可：[Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/)
- 文件：`mutopia/Pachelbel-Canon-in-D-Mutopia-CC-BY-3.0.mid`
- SHA-256：`1358ba0799aeb727be0ef155fc9090ea55762a3b41f85d3dbb02918f4ac66515`
- 使用方式：选取开头的单声部小提琴线，量化到八分音符边界，并截取 0–80 拍。

### Canon 署名要求

再分发原 MIDI、生成旋律或其改编时，须保留 Johann Pachelbel、Mutopia Project 来源页和 CC BY 3.0 许可链接，并注明本项目做过量化、截取及教程化编排。应用内继续使用原有的实时合成伴奏，不声称该伴奏来自 Mutopia 原谱。

## 完整性

`music-sources/manifest.json` 是导入的唯一配置来源。导入器在解析前校验 SHA-256；任何文件变化都会使构建失败，避免未经审核的曲谱静默进入项目。
