// 英雄联盟 — lolesports.com 官方 API
import { fetchJSON } from '../lib/fetch.js';
import { BaseScraper } from '../lib/scraper.js';
import { generateICS, toDateArray, uid } from '../lib/ics.js';

const API = 'https://esports-api.lolesports.com/persisted/gw/getSchedule';
const API_KEY = '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z';
const HEADERS = { 'x-api-key': API_KEY };
const MAX_PAGES = 3; // 防止无限翻页

const BO_MAP = { bestOf: 'BO', bestOf1: 'BO1', bestOf3: 'BO3', bestOf5: 'BO5', bestOf7: 'BO7' };

export class LoLScraper extends BaseScraper {
  constructor() {
    super('lol', './release/lol');
  }

  async scrape() {
    const allEvents = [];
    let cursor = '';
    let pages = 0;

    while (pages < MAX_PAGES) {
      const params = new URLSearchParams({ hl: 'en-US' });
      if (cursor) {
        // lolesports API 使用 pageToken 来分页
        // 先尝试不带分页获取近期数据
        break;
      }

      try {
        const data = await fetchJSON(`${API}?${params}`, { headers: HEADERS }, { retries: 2, timeout: 15_000 });
        const events = data?.data?.schedule?.events || [];
        if (!events.length) break;

        for (const ev of events) {
          const parsed = this.parseEvent(ev);
          if (parsed) allEvents.push(parsed);
        }

        // 检查是否有更多页
        const older = data?.data?.schedule?.pages?.older;
        if (!older) break;
        params.set('pageToken', older);
        cursor = older;
        pages++;

        await sleep(500);
      } catch (err) {
        console.error(`  LoL API p${pages} 失败: ${err.message}`);
        break;
      }
    }

    allEvents.sort((a, b) => a.startTimestamp - b.startTimestamp);

    return {
      events: allEvents,
      metadata: { source: 'lolesports.com', scrapedAt: new Date().toISOString() }
    };
  }

  parseEvent(ev) {
    try {
      const ts = new Date(ev.startTime).getTime();
      if (!ts) return null;

      const startDate = new Date(ts);
      const match = ev.match || {};
      const teams = match.teams || [];
      const t1 = teams[0]?.name || '待定';
      const t2 = teams[1]?.name || '待定';
      const league = ev.league?.name || '';

      // 状态
      const state = ev.state || '';
      const status = state === 'completed' ? '已结束'
                   : state === 'inProgress' ? '进行中'
                   : ts > Date.now() ? '未开始' : '已结束';

      // 赛制
      const strat = match.strategy || {};
      const format = BO_MAP[strat.type + (strat.count || '')] || strat.type || '';

      // 时长估算
      const count = strat.count || 1;
      const duration = count * 1.2; // 每场约 1.2 小时

      const endDate = new Date(startDate.getTime() + duration * 60 * 60 * 1000);

      return {
        id: match.id || `lol_${ts}`,
        startTimestamp: ts / 1000,
        startDate,
        endDate,
        duration,
        tournament: league,
        team1: t1,
        team2: t2,
        format,
        status,
        statusCode: '',
        grade: '',
        roundName: ev.blockName || '',
        stageDesc: '',
        score: teams.length === 2
          ? `${teams[0].result?.gameWins || 0}-${teams[1].result?.gameWins || 0}`
          : '',
        title: `${league}: ${t1} vs ${t2}`,
        league,
      };
    } catch {
      return null;
    }
  }

  estimateDuration(format) {
    const map = { BO1: 1, BO3: 3, BO5: 5, BO7: 6 };
    return map[format] || 2;
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
        ev.format ? `赛制: ${ev.format}` : '',
        ev.roundName ? `阶段: ${ev.roundName}` : '',
        `预计时长: ${ev.duration}小时`,
        `数据来源: LoL Esports`,
      ].filter(Boolean).join('\n'),
      location: ev.tournament || 'LoL Esports',
      categories: ['SPORTS', 'ESPORTS', 'LEAGUE_OF_LEGENDS'],
      uid: uid(`lol_${ev.id}`),
      status: 'CONFIRMED',
    }));

    generateICS({
      title: '英雄联盟 赛事日历',
      events: icsEvents,
      outPath: `${this.outDir}/lol.ics`
    });

    console.log(`  跳过 ${skipped} 场非"未开始"状态的比赛`);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export default LoLScraper;
