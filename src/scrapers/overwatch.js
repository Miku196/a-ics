// 守望先锋 OWCS — 三源：Camoufox 实时 + 小黑盒历史 + 缓存
import { BaseScraper } from '../lib/scraper.js';
import { fetchJSON } from '../lib/fetch.js';
import { generateICS, toDateArray, uid } from '../lib/ics.js';

const CFX = 'http://localhost:9377';
const OWCS_URL = 'https://ow.blizzard.cn/owcs/#/schedule';

// 小黑盒 OWCS API（固定凭证，返回全量历史数据）
const XHH_API = 'https://api.xiaoheihe.cn/game/match/schedule';
const XHH_PARAMS = new URLSearchParams({
  app: 'heybox', heybox_id: '', os_type: 'web',
  x_app: 'heybox', x_client_type: 'weboutapp', x_os_type: 'Windows',
  x_client_version: '', version: '999.0.4',
  hkey: '12WTS77', _time: '1780817650',
  nonce: '643090C152385BEEB065D366317E097B',
  appid: '900000012',
});

// ====== Camoufox snapshot 解析 ======
function parseSnapshot(text) {
  if (!text) return [];
  const events = [], year = new Date().getFullYear();
  let sched = '';
  for (const line of text.split('\n')) {
    if (/\d{2}月\d{2}日/.test(line) && /(VS|vs|\d+\s*:\s*\d+)/.test(line)) {
      sched = line.replace(/^- text:\s*"?/, '').replace(/"$/, '').trim();
      break;
    }
  }
  if (!sched) return [];
  for (const seg of sched.split(/(?=\d{2}月\d{2}日)/)) {
    const dm = seg.match(/^(\d{2})月(\d{2})日\s*/);
    if (!dm) continue;
    const dateStr = `${year}-${dm[1]}-${dm[2]}`;
    let ctx = seg.slice(dm[0].length).trim().replace(/关注我们$/, '').trim();
    for (const raw of ctx.split(/(?=\d{4}-[^\s]+\s+\d{2}:\d{2})/)) {
      const m = raw.match(/^(已结束|进行中)?\s*(\d{4}-\S+)\s+(\d{2}):(\d{2})\s+(.+)$/);
      if (!m) continue;
      const [, pf, stage, hh, mm, teams] = m;
      const sd = new Date(year, +dm[1] - 1, +dm[2], +hh, +mm);
      const ed = new Date(sd.getTime() + 2 * 3600000);
      let status = pf === '已结束' ? '已结束' : pf === '进行中' ? '进行中' : '未开始';
      let t1 = '', t2 = '', score = '';
      const scM = teams.match(/^(.+?)\s+(\d+)\s*:\s*(\d+)\s+(.+)$/);
      if (scM) { t1 = scM[1]; t2 = scM[4]; score = `${scM[2]}-${scM[3]}`; }
      else { const vsM = teams.match(/^(.+?)\s+(?:VS|vs)\s+(.+)/); if (vsM) { t1 = vsM[1]; t2 = vsM[2]; } }
      if (!t1 || !t2) continue;
      t1 = t1.trim(); t2 = t2.replace(/\s*关注我们\s*/, '').trim();
      events.push(_makeEvent(`cfx_${dateStr}_${hh}${mm}`, sd, ed, t1, t2, stage, status, score, 'ow.blizzard.cn'));
    }
  }
  return events;
}

// ====== 小黑盒 API 解析 ======
function parseXiaoheihe(data) {
  const events = [];
  const leagues = data?.result?.matches || [];
  for (const league of leagues) {
    const sortDate = new Date(league.sort * 1000);
    const y = sortDate.getFullYear(), m = sortDate.getMonth(), d = sortDate.getDate();
    const tourney = league.league_name || 'OWCS';

    for (const match of (league.matches || [])) {
      const [hh, mm] = (match.start_time || '00:00').split(':').map(Number);
      const sd = new Date(y, m, d, hh || 0, mm || 0);
      const ed = new Date(sd.getTime() + 2 * 3600000);
      const score = `${match.team1_score || 0}-${match.team2_score || 0}`;
      const hasScore = match.team1_score > 0 || match.team2_score > 0;
      const status = hasScore ? '已结束' : '未开始';

      events.push(_makeEvent(
        `xhh_${match.match_id}`,
        sd, ed,
        match.team1_name, match.team2_name,
        tourney, status, score,
        '小黑盒'
      ));
    }
  }
  return events;
}

function _makeEvent(id, sd, ed, t1, t2, stage, status, score, source) {
  return {
    id, startTimestamp: sd.getTime() / 1000, startDate: sd, endDate: ed,
    duration: 2, tournament: 'OWCS 2026', team1: t1, team2: t2,
    format: '', status, statusCode: '',
    grade: '', roundName: stage || '', stageDesc: '',
    score, title: `OWCS: ${t1} vs ${t2}`,
  };
}

// ====== 爬虫主体 ======
export class OverwatchScraper extends BaseScraper {
  constructor() { super('overwatch', './release/overwatch'); }

  async scrape() {
    let events = [];

    // 1) Camoufox 实时赛程
    try { await fetch(`${CFX}/health`); } catch {
      console.log('  Camoufox 离线，尝试小黑盒 API');
    }
    if (await this._camAvailable()) {
      const cfxEvents = await this._scrapeCamoufox();
      if (cfxEvents.length) {
        events = cfxEvents;
        console.log(`  Camoufox: ${events.length} 场`);
      }
    }

    // 2) 小黑盒历史数据（补充）
    try {
      const xhhEvents = await this._scrapeXiaoheihe();
      if (xhhEvents.length) {
        // 合并去重：以 match_id 为准
        const existing = new Set(events.map(e => e.id));
        for (const ev of xhhEvents) {
          if (!existing.has(ev.id)) {
            events.push(ev);
            existing.add(ev.id);
          }
        }
        console.log(`  小黑盒: ${xhhEvents.length} 场 (合并后总计 ${events.length})`);
      }
    } catch (err) {
      console.log(`  小黑盒 API 不可用: ${err.message}`);
    }

    events.sort((a, b) => a.startTimestamp - b.startTimestamp);
    return { events, metadata: { source: 'ow.blizzard.cn + 小黑盒', scrapedAt: new Date().toISOString() } };
  }

  async _camAvailable() {
    try { await fetch(`${CFX}/health`); return true; } catch { return false; }
  }

  async _scrapeCamoufox() {
    let tabId = null;
    try {
      const tr = await fetch(`${CFX}/tabs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'pi', sessionKey: 'owcs', url: OWCS_URL }),
        signal: AbortSignal.timeout(35000),
      });
      tabId = (await tr.json()).tabId;
      if (!tabId) return [];
      await sleep(3000);
      const sr = await fetch(`${CFX}/tabs/${tabId}/snapshot?userId=pi`);
      return parseSnapshot((await sr.json()).snapshot || '');
    } catch (err) {
      console.log(`  Camoufox 抓取失败: ${err.message}`);
      return [];
    } finally {
      if (tabId) fetch(`${CFX}/tabs/${tabId}?userId=pi`, { method: 'DELETE' }).catch(() => {});
    }
  }

  async _scrapeXiaoheihe() {
    const data = await fetchJSON(`${XHH_API}?${XHH_PARAMS}`, {}, { retries: 1, timeout: 12_000 });
    return parseXiaoheihe(data);
  }

  generateICS(data) {
    const upcoming = data.events.filter(e => {
      const d = e.startDate instanceof Date ? e.startDate : new Date(e.startDate);
      return e.status === '未开始' && d.getTime() > Date.now() - 3600000;
    });
    const icsEvents = upcoming.map(ev => {
      const sd = ev.startDate instanceof Date ? ev.startDate : new Date(ev.startDate);
      const ed = ev.endDate instanceof Date ? ev.endDate : new Date(ev.endDate || sd.getTime() + 2 * 3600000);
      return {
        title: ev.title, start: toDateArray(sd), end: toDateArray(ed),
        description: [`赛事: ${ev.tournament}`, `对阵: ${ev.team1} vs ${ev.team2}`, ev.score ? `比分: ${ev.score}` : '', ev.roundName ? `阶段: ${ev.roundName}` : ''].filter(Boolean).join('\n'),
        location: 'Online', categories: ['SPORTS', 'ESPORTS', 'OVERWATCH'],
        uid: uid(`owcs_${ev.id}`), status: 'CONFIRMED',
      };
    });
    generateICS({ title: '守望先锋 OWCS 赛事日历', events: icsEvents, outPath: `${this.outDir}/overwatch.ics` });
    console.log(`  跳过 ${data.events.length - upcoming.length} 场已结束/过去的比赛`);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
export default OverwatchScraper;
