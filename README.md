# a-ics — 赛事日历 ICS 生成器 v2

自动抓取赛事日历并生成 **ICS 格式** 订阅文件。Node.js 重写，9 个数据源，支持 GitHub Actions 自动更新。

## 支持的赛事（9 个）

| # | 赛事 | 数据源 | 状态 |
|---|------|--------|------|
| 🏎️ | WRC 世界拉力锦标赛 | wrc.com → Wikipedia 降级 | ✅ |
| 🏎️ | F1 一级方程式 | f1calendar.com | ✅ |
| 🎮 | CS:GO | 5EPlay API | ✅ |
| 🎮 | Dota 2 | 5EPlay API | ✅ |
| 🎮 | 英雄联盟 (LoL) | lolesports.com API | ✅ |
| 🎮 | Valorant（无畏契约） | 5EPlay API | ✅ |
| 🎮 | OWCS 守望先锋冠军系列赛 | ow.blizzard.cn（Camoufox 渲染） | ✅ |
| 🏆 | 2026 美加墨世界杯 | ESPN API | ✅ |
| 🏀 | NBA | ESPN API | ✅ |

## 订阅日历

将以下链接添加到你的日历应用（iOS 日历、Google Calendar、Outlook 等）：

| 赛事 | 原始链接 | 加速链接（国内） |
|------|----------|------------------|
| WRC | [ICS](https://Miku196.github.io/a-ics/release/wrc/wrc.ics) | [加速](https://gh-proxy.com/https://Miku196.github.io/a-ics/release/wrc/wrc.ics) |
| F1 | [ICS](https://Miku196.github.io/a-ics/release/f1/f1.ics) | [加速](https://gh-proxy.com/https://Miku196.github.io/a-ics/release/f1/f1.ics) |
| CS:GO | [ICS](https://Miku196.github.io/a-ics/release/csgo/csgo.ics) | [加速](https://gh-proxy.com/https://Miku196.github.io/a-ics/release/csgo/csgo.ics) |
| Dota 2 | [ICS](https://Miku196.github.io/a-ics/release/dota2/dota2.ics) | [加速](https://gh-proxy.com/https://Miku196.github.io/a-ics/release/dota2/dota2.ics) |
| LoL | [ICS](https://Miku196.github.io/a-ics/release/lol/lol.ics) | [加速](https://gh-proxy.com/https://Miku196.github.io/a-ics/release/lol/lol.ics) |
| Valorant | [ICS](https://Miku196.github.io/a-ics/release/valorant/valorant.ics) | [加速](https://gh-proxy.com/https://Miku196.github.io/a-ics/release/valorant/valorant.ics) |
| OWCS | [ICS](https://Miku196.github.io/a-ics/release/overwatch/overwatch.ics) | [加速](https://gh-proxy.com/https://Miku196.github.io/a-ics/release/overwatch/overwatch.ics) |
| 世界杯 | [ICS](https://Miku196.github.io/a-ics/release/worldcup/worldcup.ics) | [加速](https://gh-proxy.com/https://Miku196.github.io/a-ics/release/worldcup/worldcup.ics) |
| NBA | [ICS](https://Miku196.github.io/a-ics/release/nba/nba.ics) | [加速](https://gh-proxy.com/https://Miku196.github.io/a-ics/release/nba/nba.ics) |

## 部署步骤

1. **Fork** 本项目到你的 GitHub 账号
2. Settings → Pages → Source: `main` 分支，目录选 `/release`
3. Fork 后将上方订阅链接中的 `Miku196` 替换为你的用户名即可
4. GitHub Actions 每 2 小时自动更新

> 💡 **加速说明**：GitHub Pages 在国内访问可能较慢，加速链接通过 `gh-proxy.com` 代理，加载更快。

## 本地运行

```bash
npm install
npm start              # 运行所有
npm run wrc            # 单赛事
npm run f1
npm run csgo
npm run dota2
npm run lol
npm run valorant
npm run overwatch
npm run worldcup
node src/index.js nba  # NBA
```

## 容错机制

- 数据源失效 → 自动降级到备用源
- 全源失效 → 使用上次缓存
- 单赛事失败不影响其他
- CI 中 `continue-on-error` 不中断流水线

## 项目结构

```
src/
  lib/            公共库
    fetch.js      HTTP 封装（重试/超时/UA）
    ics.js        ICS 日历生成（ics 库）
    logger.js     带时间戳日志
    scraper.js    爬虫基类（缓存/降级）
  scrapers/       9 个爬虫
    wrc.js        WRC (cheerio)
    f1.js         F1 (cheerio)
    fiveeplay.js  5EPlay 通用 (CS:GO/Dota2/Valorant)
    lol.js        LoL (lolesports.com API)
    overwatch.js  OWCS (Camoufox 渲染)
    worldcup.js   世界杯 (ESPN API)
    nba.js        NBA (ESPN API)
  index.js        CLI 入口
release/          ICS + JSON 缓存
```

## License

MIT
