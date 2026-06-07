// 5EPlay 通用爬虫 — CSGO / Dota2 / Valorant
// 注：LoL 和 Overwatch 5EPlay 不支持，使用独立数据源
import { fetchJSON } from '../lib/fetch.js';
import { BaseScraper } from '../lib/scraper.js';
import { generateICS, toDateArray, uid } from '../lib/ics.js';

const API = 'https://app.5eplay.com/api/tournament/session_list';
const HEADERS = {
  Referer: 'https://event.5eplay.com/',
  Origin: 'https://event.5eplay.com',
};

// 限制：每个状态最多取 5 页（200 场），避免超时
const MAX_PAGES = 5;
const PAGE_SIZE = 40;

// 已验证的 game_type 映射
export const GAME_CONFIG = {
  csgo:     { gameType: 1, label: 'CS:GO',                eventBase: 'https://event.5eplay.com/csgo/session/' },
  dota2:    { gameType: 2, label: 'Dota 2',               eventBase: 'https://event.5eplay.com/dota/session/' },
  valorant: { gameType: 5, label: 'Valorant (无畏契约)',    eventBase: 'https://event.5eplay.com/val/session/' },
};

const FORMAT_MAP  = { '1':'BO1','2':'BO2','3':'BO3','5':'BO5','7':'BO7' };
const GRADE_MAP   = { '1':'S级','2':'A级','3':'B级','4':'C级','5':'其他' };
const STATUS_MAP  = { '0':'未开始','1':'进行中','2':'已结束' };

export class FiveEPlayScraper extends BaseScraper {
  /**
   * @param {string} gameKey  csgo|dota2|valorant
   */
  constructor(gameKey) {
    super(gameKey, `./release/${gameKey}`);
    this.config = GAME_CONFIG[gameKey];
    if (!this.config) throw new Error(`Unknown 5EPlay game: ${gameKey}`);
  }

  async scrape() {
    const allMatches = [];

    for (const gameStatus of [1, 2]) {
      let page = 1;
      while (page <= MAX_PAGES) {
        try {
          const params = new URLSearchParams({
            game_type: String(this.config.gameType),
            grades: '',
            page: String(page),
            limit: String(PAGE_SIZE),
            game_status: String(gameStatus),
            _: String(Date.now()),
          });

          const data = await fetchJSON(`${API}?${params}`, { headers: HEADERS }, { retries: 2, timeout: 15_000 });
          if (!data?.success || !data?.data?.matches) break;

          const { matches, total } = data.data;
          if (!matches.length) break;

          for (const item of matches) {
            const parsed = this.parseMatch(item, gameStatus);
            if (parsed) allMatches.push(parsed);
          }

          if (total <= page * PAGE_SIZE) break;
          page++;
          await sleep(300 + Math.random() * 700);
        } catch (err) {
          console.error(`  5EPlay [${this.config.label}] p${page} 失败: ${err.message}`);
          break;
        }
      }
    }

    allMatches.sort((a, b) => a.startTimestamp - b.startTimestamp);

    return {
      events: allMatches,
      metadata: {
        source: '5EPlay API',
        scrapedAt: new Date().toISOString(),
        total: allMatches.length,
      }
    };
  }

  parseMatch(item, apiStatus) {
    try {
      const mc = item.mc_info || {};
      const state = item.state || {};
      const tt = item.tt_info || {};

      let ts = Number(mc.start_ts) || Number(mc.plan_ts) || 0;
      if (!ts) return null;

      const startDate = new Date(ts * 1000);
      const statusCode = String(state.status || '0');
      const now = Date.now() / 1000;

      let status = STATUS_MAP[statusCode] || '未知';
      if (status === '未开始' && ts < now - 3600) status = '已结束';
      if (status === '进行中' && ts > now + 3600) status = '未开始';
      if (status === '已结束' && ts > now) status = '未开始';

      const duration = this.estimateDuration(mc.format);
      const endDate = new Date(startDate.getTime() + duration * 60 * 60 * 1000);

      const team1 = mc.t1_info?.disp_name || '待定';
      const team2 = mc.t2_info?.disp_name || '待定';
      const tournament = tt.disp_name || '未知赛事';
      const format = FORMAT_MAP[mc.format] || mc.format || '';

      return {
        id: mc.id || '',
        startTimestamp: ts,
        startDate,
        endDate,
        duration,
        tournament,
        team1,
        team2,
        format,
        status,
        statusCode,
        apiStatus,
        grade: GRADE_MAP[mc.grade] || '',
        roundName: mc.round_name || '',
        stageDesc: mc.tt_stage_desc || '',
        score: `${state.t1_score || 0}-${state.t2_score || 0}`,
        title: `${tournament}: ${team1} vs ${team2}`,
      };
    } catch {
      return null;
    }
  }

  estimateDuration(format) {
    const map = { '1': 1.5, '2': 2, '3': 3, '5': 4.5, '7': 5 };
    return map[String(format)] || 2;
  }

  generateICS(data) {
    const upcoming = data.events.filter(e => e.status === '未开始');
    const skipped = data.events.length - upcoming.length;

    const icsEvents = upcoming.map(ev => ({
      title: ev.title,
      start: toDateArray(ev.startDate),
      end: toDateArray(ev.endDate),
      description: [
        `赛事: ${ev.tournament}`,
        `对阵: ${ev.team1} vs ${ev.team2}`,
        `赛制: ${ev.format}`,
        ev.roundName ? `轮次: ${ev.roundName}` : '',
        ev.stageDesc ? `阶段: ${ev.stageDesc}` : '',
        `等级: ${ev.grade}`,
        `预计时长: ${ev.duration}小时`,
        `数据来源: 5EPlay`,
      ].filter(Boolean).join('\n'),
      location: '5EPlay 赛事平台',
      url: `${this.config.eventBase}${ev.id}`,
      categories: ['SPORTS', 'ESPORTS', this.config.label],
      uid: uid(`${this.name}_${ev.id}`),
      status: 'CONFIRMED',
    }));

    generateICS({
      title: `${this.config.label} 赛事日历`,
      events: icsEvents,
      outPath: `${this.outDir}/${this.name}.ics`
    });

    console.log(`  跳过 ${skipped} 场非"未开始"状态的比赛`);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export default FiveEPlayScraper;
