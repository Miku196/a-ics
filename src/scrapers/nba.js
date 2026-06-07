// NBA — ESPN API
import { fetchJSON } from '../lib/fetch.js';
import { BaseScraper } from '../lib/scraper.js';
import { generateICS, toDateArray, uid } from '../lib/ics.js';

const API = 'https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';

export class NBAScraper extends BaseScraper {
  constructor() { super('nba', './release/nba'); }

  async scrape() {
    const events = [];
    try {
      const data = await fetchJSON(`${API}?limit=300`, {}, { retries: 2, timeout: 15_000 });
      for (const ev of (data?.events || [])) {
        const parsed = this.parseEvent(ev);
        if (parsed) events.push(parsed);
      }
    } catch (err) {
      console.error(`  NBA API 失败: ${err.message}`);
    }
    events.sort((a, b) => a.startTimestamp - b.startTimestamp);
    return { events, metadata: { source: 'ESPN API', scrapedAt: new Date().toISOString() } };
  }

  parseEvent(ev) {
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
        : status === 'STATUS_FINAL' ? '已结束' : '未开始';
      const endDate = new Date(startDate.getTime() + 2.5 * 60 * 60 * 1000);
      const title = `🏀 ${away} @ ${home}`;
      const scores = teams.map(t => t.score?.displayValue || '0').join('-');
      return {
        id: ev.id || `nba_${startDate.getTime()}`,
        startTimestamp: startDate.getTime() / 1000, startDate, endDate,
        duration: 2.5, tournament: 'NBA', team1: home, team2: away,
        format: '', status: statusCN, statusCode: status,
        grade: '', roundName: ev.season?.type?.name || '', stageDesc: venue || '',
        score: scores, title, venue,
      };
    } catch { return null; }
  }

  generateICS(data) {
    const upcoming = data.events.filter(e => e.status === '未开始');
    const icsEvents = upcoming.map(ev => ({
      title: ev.title,
      start: toDateArray(ev.startDate),
      end: toDateArray(ev.endDate),
      description: [`🏀 NBA`, `对阵: ${ev.team2} @ ${ev.team1}`, ev.venue ? `场馆: ${ev.venue}` : '', ev.roundName ? `阶段: ${ev.roundName}` : '', `数据来源: ESPN`].filter(Boolean).join('\n'),
      location: ev.venue || 'NBA',
      categories: ['SPORTS', 'BASKETBALL', 'NBA'],
      uid: uid(`nba_${ev.id}`), status: 'CONFIRMED',
      alarms: [{ action: 'display', trigger: { minutes: 15, before: true }, description: `NBA: ${ev.team2} @ ${ev.team1} 即将开始` }],
    }));
    generateICS({ title: 'NBA 赛事日历', events: icsEvents, outPath: `${this.outDir}/nba.ics` });
    console.log(`  跳过 ${data.events.length - upcoming.length} 场非"未开始"的比赛`);
  }
}
export default NBAScraper;
