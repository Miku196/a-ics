# a-ics — 赛事日历 ICS 生成器 v2

自动抓取赛事日历并生成 **ICS 格式** 订阅文件。Node.js 重写，支持 GitHub Actions 自动更新 + GitHub Pages 托管。

## 支持的赛事

| 类型 | 赛事 | 数据源 | 状态 |
|------|------|--------|------|
| 🏎️ 赛车 | WRC 世界拉力锦标赛 | wrc.com → Wikipedia 降级 | ⚠️ wrc.com 有 CDN 拦截 |
| 🏎️ 赛车 | F1 一级方程式 | f1calendar.com | ✅ |
| 🎮 电竞 | CS:GO | 5EPlay API | ✅ |
| 🎮 电竞 | Dota 2 | 5EPlay API | ✅ |
| 🎮 电竞 | 英雄联盟 (LoL) | lolesports.com API | ✅ |
| 🎮 电竞 | Valorant (无畏契约) | 5EPlay API | ✅ |
| 🏆 足球 | 2026 美加墨世界杯 | ESPN API | ✅ |
| 🎮 电竞 | 守望先锋 | Liquipedia | ⚠️ 数据源不稳定 |

## 订阅日历

部署到 GitHub Pages 后使用以下链接（替换 `<用户名>`）：

```
https://<用户名>.github.io/a-ics/release/f1/f1.ics
https://<用户名>.github.io/a-ics/release/csgo/csgo.ics
https://<用户名>.github.io/a-ics/release/dota2/dota2.ics
https://<用户名>.github.io/a-ics/release/lol/lol.ics
https://<用户名>.github.io/a-ics/release/valorant/valorant.ics
https://<用户名>.github.io/a-ics/release/overwatch/overwatch.ics
https://<用户名>.github.io/a-ics/release/wrc/wrc.ics
```

## 部署步骤

1. **Fork** 本项目
2. Settings → Pages → Source: `gh-pages` 分支（由 Actions 自动部署）
3. Actions 每 2 小时自动更新

## 本地运行

```bash
npm install           # 安装依赖
npm start             # 运行所有爬虫
npm run f1            # 仅 F1
npm run csgo          # 仅 CS:GO
npm run dota2         # 仅 Dota 2
npm run lol           # 仅 LoL
npm run wrc           # 仅 WRC
node src/index.js valorant    # 仅 Valorant
node src/index.js overwatch   # 仅 Overwatch
```

## 容错

- 数据源失效 → 自动降级到备用源
- 全源失效 → 使用上次成功抓取的缓存
- 单个赛事失败不影响其他赛事
- `continue-on-error` 确保 CI 不中断

## 项目结构

```
src/
  lib/           # 公共库
    fetch.js     # HTTP 封装（重试 + 超时 + UA）
    ics.js       # ICS 日历生成（基于 ics 库）
    logger.js    # 带时间戳的日志
    scraper.js   # 爬虫基类（缓存 + 降级）
  scrapers/      # 各赛事爬虫
    wrc.js       # WRC (wrc.com → Wikipedia)
    f1.js        # F1 (f1calendar.com)
    fiveeplay.js # 5EPlay 通用 (CS:GO / Dota2 / Valorant)
    lol.js       # LoL (lolesports.com API)
    overwatch.js # Overwatch (Liquipedia)
  index.js       # CLI 入口
release/         # 生成的 ICS + JSON 缓存
```

## License

MIT
