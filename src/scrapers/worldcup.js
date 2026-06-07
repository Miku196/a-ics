// 2026 美加墨世界杯 — ESPN API (主源) + 小黑盒 (备用，需 Cookie)
import { fetchJSON } from '../lib/fetch.js';
import { BaseScraper } from '../lib/scraper.js';
import { generateICS, toDateArray, uid } from '../lib/ics.js';

const ESPN_API = 'https://site.web.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

// 小黑盒赛事中心 API（需 Cookie 认证，仅作备用参考）
// const XHH_API = 'https://api.xiaoheihe.cn/heybox/match_center/home';
// const XHH_HEADERS = { Cookie: '...' }; // 需要从浏览器获取

export class WorldCupScraper extends BaseScraper {
  constructor() {
    super('worldcup', './release/worldcup');
  }

  async scrape() {
    const events = [];

    // 主源：ESPN API
    try {
      const data = await fetchJSON(
        `${ESPN_API}?limit=200&dates=20260601-20260731`,
        {},
        { retries: 2, timeout: 15_000 }
      );

      for (const ev of (data?.events || [])) {
        const parsed = this.parseESPNEvent(ev);
        if (parsed) events.push(parsed);
      }
    } catch (err) {
      console.error(`  ESPN API 失败: ${err.message}`);
    }

    // 备用源：小黑盒（当前需登录态，预留接口）
    if (!events.length) {
      try {
        const xhhEvents = await this._scrapeXiaoheihe();
        events.push(...xhhEvents);
      } catch (err) {
        console.log(`  小黑盒不可用 (需登录 Cookie): ${err.message}`);
      }
    }

    events.sort((a, b) => a.startTimestamp - b.startTimestamp);

    return {
      events,
      metadata: {
        source: 'ESPN API',
        scrapedAt: new Date().toISOString(),
        tournament: '2026 FIFA World Cup',
      }
    };
  }

  /** 预留：小黑盒抓取（需设置 XHH_COOKIE 环境变量） */
  async _scrapeXiaoheihe() {
    const cookie = process.env.XHH_COOKIE;
    if (!cookie) throw new Error('未设置 XHH_COOKIE');

    const data = await fetchJSON(
      'https://api.xiaoheihe.cn/heybox/match_center/home',
      { headers: { Cookie: cookie, Referer: 'https://web.xiaoheihe.cn/' } },
      { retries: 1, timeout: 15_000 }
    );

    const events = [];
    // TODO: 解析小黑盒 match list 数据结构（需登录后确认字段）
    return events;
  }

  parseESPNEvent(ev) {
    try {
      const startDate = new Date(ev.date);
      if (isNaN(startDate.getTime())) return null;

      const comp = ev.competitions?.[0];
      if (!comp) return null;

      const teams = comp.competitors || [];
      const home = teams.find(t => t.homeAway === 'home')?.team?.displayName || '待定';
      const away = teams.find(t => t.homeAway === 'away')?.team?.displayName || '待定';

      const venue = comp.venue?.fullName || '';
      const status = ev.status?.type?.name || '';
      const statusCN = status === 'STATUS_SCHEDULED' ? '未开始'
                     : status === 'STATUS_IN_PROGRESS' ? '进行中'
                     : status === 'STATUS_FINAL' ? '已结束'
                     : '未开始';

      const duration = 2.5;
      const endDate = new Date(startDate.getTime() + duration * 60 * 60 * 1000);

      const groupInfo = ev.group?.name || '';
      const roundInfo = ev.round?.displayName || '';

      const title = `🏆 ${home} vs ${away}${groupInfo ? ` (${groupInfo})` : ''}`;

      return {
        id: ev.id || `wc_${startDate.getTime()}`,
        startTimestamp: startDate.getTime() / 1000,
        startDate,
        endDate,
        duration,
        tournament: '2026 FIFA World Cup',
        team1: home,
        team2: away,
        format: '',
        status: statusCN,
        statusCode: status,
        grade: '',
        roundName: roundInfo || groupInfo || '',
        stageDesc: venue || '',
        score: comp.competitors?.map(c => c.score?.displayValue || '0').join('-') || '',
        title,
        venue,
        group: groupInfo,
      };
    } catch {
      return null;
    }
  }

  generateICS(data) {
    const upcoming = data.events.filter(e => e.status === '未开始');
    const skipped = data.events.length - upcoming.length;

    const icsEvents = upcoming.map(ev => ({
      title: ev.title,
      start: toDateArray(ev.startDate),
      end: toDateArray(ev.endDate),
      description: [
        `🏆 2026 美加墨世界杯`,
        `对阵: ${ev.team1} vs ${ev.team2}`,
        ev.venue ? `场馆: ${ev.venue}` : '',
        ev.group ? `小组: ${ev.group}` : '',
        ev.roundName ? `阶段: ${ev.roundName}` : '',
        ev.score ? `比分: ${ev.score}` : '',
        `数据来源: ESPN`,
      ].filter(Boolean).join('\n'),
      location: ev.venue || 'USA / Canada / Mexico',
      url: 'https://www.espn.com/soccer/scoreboard/_/league/fifa.world',
      categories: ['SPORTS', 'SOCCER', 'WORLD_CUP'],
      uid: uid(`wc_${ev.id}`),
      status: 'CONFIRMED',
      alarms: [{
        action: 'display',
        trigger: { minutes: 30, before: true },
        description: `世界杯: ${ev.team1} vs ${ev.team2} 即将开始`,
      }],
    }));

    generateICS({
      title: '2026 世界杯 赛事日历',
      events: icsEvents,
      outPath: `${this.outDir}/worldcup.ics`
    });

    console.log(`  跳过 ${skipped} 场非"未开始"的比赛`);
  }
}

export default WorldCupScraper;
