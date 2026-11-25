# DuckOps · 鸭鸭鸭行动 3D

[在线试玩](https://momoheal.github.io/duckops/)

DuckOps 是独立的 3D 浏览器游戏。使用 Three.js 的 45° 俯视镜头，在七张战区里搜刮物资、迎战首领并撤离。调试模式默认开启，可以直接选择所有战区。

## 操作

- 电脑：WASD 移动，鼠标瞄准，左键开火，E 搜索，Esc 暂停。
- 触屏：左摇杆移动，右摇杆瞄准和开火。

游戏需要支持 WebGL 2 的浏览器。仓库和排行保存在当前浏览器中，同一浏览器的本地预览和在线版使用各自的存档。

## 本地开发

使用 Node.js 24 和 npm。

```sh
npm ci
npm run dev
```

访问 [本地预览](http://localhost:5174/)。运行 `npm run typecheck` 检查类型，运行 `npm run build` 生成 `dist/`。推送到 `main` 后，GitHub Actions 会构建并部署 GitHub Pages。

## 许可证

项目采用 [MIT License](LICENSE)。随构建产物分发的依赖附带各自的许可证。
