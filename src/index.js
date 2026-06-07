// 主入口 — 统一调度所有爬虫（8 个赛事源）
import { log } from './lib/logger.js';
import { WRCScraper } from './scrapers/wrc.js';
import { F1Scraper } from './scrapers/f1.js';
import { FiveEPlayScraper } from './scrapers/fiveeplay.js';
import { LoLScraper } from './scrapers/lol.js';
import { OverwatchScraper } from './scrapers/overwatch.js';
import { NBAScraper } from './scrapers/nba.js';
import { WorldCupScraper } from './scrapers/worldcup.js';

/**
 * 爬虫注册表
 * 字段 primary / fallback（主源失败时自动降级）
 */
const REGISTRY = {
  wrc:       { primary: WRCScraper },
  f1:        { primary: F1Scraper },
  csgo:      { primary: () => new FiveEPlayScraper('csgo') },
  dota2:     { primary: () => new FiveEPlayScraper('dota2') },
  lol:       { primary: LoLScraper },
  valorant:  { primary: () => new FiveEPlayScraper('valorant') },
  overwatch: { primary: OverwatchScraper },
  worldcup:  { primary: WorldCupScraper },
  nba:       { primary: NBAScraper },
};

const HELP_MSG = `
用法: node src/index.js [赛事]

可选参数（不传则跑全部）:
  wrc  f1  csgo  dota2  lol  valorant  overwatch  worldcup
`.trim();

async function runOne(key) {
  const entry = REGISTRY[key];
  if (!entry) {
    log('error', `未知赛事: ${key}`);
    console.log(HELP_MSG);
    return { ok: false };
  }

  const scraper = _instantiate(entry.primary);
  console.log('');
  const data = await scraper.run();

  // 主源失败 → 尝试降级
  if ((data.failed || !data.events.length) && entry.fallback) {
    log('warn', `[${key.toUpperCase()}] 主源无数据，切换备用源...`);
    const fallback = _instantiate(entry.fallback);
    const fbData = await fallback.run();

    if (!fbData.failed && fbData.events.length) {
      fallback.generateICS(fbData);
      _printSummary(key, fbData);
      return { ok: true };
    }
  }

  if (data.failed) {
    log('error', `[${key.toUpperCase()}] 所有数据源均失败，未生成 ICS`);
    return { ok: false };
  }

  scraper.generateICS(data);
  _printSummary(key, data);
  return { ok: true };
}

async function runAll() {
  console.log('═'.repeat(50));
  console.log('  a-ics — 赛事日历 ICS 生成器 v2');
  console.log('  WRC · F1 · CS:GO · Dota2 · LoL · Valorant · OW · WorldCup · NBA');
  console.log('═'.repeat(50));

  let ok = 0, fail = 0;
  for (const key of Object.keys(REGISTRY)) {
    const result = await runOne(key);
    result.ok ? ok++ : fail++;
  }

  console.log('');
  console.log('═'.repeat(50));
  log('info', `完成: ${ok} 成功, ${fail} 失败`);
  if (fail) process.exitCode = 1;
}

// ===== helpers =====

function _instantiate(ctor) {
  try { return new ctor(); } catch {}
  return ctor();
}

function _printSummary(key, data) {
  const preview = data.events.slice(0, 3);
  for (const ev of preview) {
    const label = ev.title || ev.race || '';
    const d = ev.startDate || (ev.startTimestamp ? new Date(ev.startTimestamp * 1000) : null);
    const ds = d ? d.toISOString().slice(0, 10) : '???';
    console.log(`    ${ds}  ${label}`);
  }
  if (data.events.length > 3) console.log(`    ... 共 ${data.events.length} 条`);
  if (data.stale) console.log(`    ⚠️ 缓存数据（数据源可能失效）`);
}

// ===== CLI =====
const arg = process.argv[2];
if (arg && REGISTRY[arg]) {
  runOne(arg);
} else if (arg) {
  console.error(`未知参数: ${arg}`);
  console.log(HELP_MSG);
  process.exit(1);
} else {
  runAll();
}
