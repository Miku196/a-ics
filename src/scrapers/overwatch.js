// 守望先锋 OWCS — ow.blizzard.cn（Camoufox 渲染 + 降级缓存）
import { BaseScraper } from '../lib/scraper.js';
import { generateICS, toDateArray, uid } from '../lib/ics.js';

const URL = 'https://ow.blizzard.cn/owcs/#/schedule';
const CFX = 'http://localhost:9377';

function parseSnapshot(text) {
  if (!text) return [];
  const events = [], year = new Date().getFullYear();

  // 从 snapshot 提取赛程所在行
  let sched = '';
  for (const line of text.split('\n')) {
    if (/\d{2}月\d{2}日/.test(line) && /(VS|vs|\d+\s*:\s*\d+)/.test(line)) {
      sched = line.replace(/^- text:\s*"?/, '').replace(/"$/, '').trim();
      break;
    }
  }
  if (!sched) return [];

  // 按日期分段: "06月06日 ... 06月07日 ..."
  for (const seg of sched.split(/(?=\d{2}月\d{2}日)/)) {
    const dm = seg.match(/^(\d{2})月(\d{2})日\s*/);
    if (!dm) continue;
    const dateStr = `${year}-${dm[1]}-${dm[2]}`;
    let ctx = seg.slice(dm[0].length).trim();
    if (ctx.endsWith('关注我们')) ctx = ctx.slice(0, -4).trim();

    // 按 "2026-Round HH:MM" 模式分割每个比赛
    for (const raw of ctx.split(/(?=\d{4}-[^\s]+\s+\d{2}:\d{2})/)) {
      const m = raw.match(/^(已结束|进行中)?\s*(\d{4}-[^\s]+)\s+(\d{2}):(\d{2})\s+(.+)$/);
      if (!m) continue;
      const [, statusPfx, stage, hh, mm, teams] = m;
      const sd = new Date(year, +dm[1] - 1, +dm[2], +hh, +mm); // UTC+8 当地时间
      const ed = new Date(sd.getTime() + 2 * 60 * 60 * 1000);

      let status = statusPfx === '已结束' ? '已结束' : statusPfx === '进行中' ? '进行中' : '未开始';
      let t1 = '', t2 = '', score = '';

      // 比分格式: "TeamA 2 : 3 TeamB"
      const scM = teams.match(/^(.+?)\s+(\d+)\s*:\s*(\d+)\s+(.+)$/);
      if (scM) {
        t1 = scM[1]; t2 = scM[4]; score = `${scM[2]}-${scM[3]}`;
      } else {
        const vsM = teams.match(/^(.+?)\s+(?:VS|vs)\s+(.+)/);
        if (vsM) { t1 = vsM[1]; t2 = vsM[2]; }
      }
      if (!t1 || !t2) continue;

      // 清理队名多余空格
      t1 = t1.trim(); t2 = t2.replace(/\s*关注我们\s*/, '').trim();

      events.push({
        id: `owcs_${dateStr}_${hh}${mm}_${t1}_${t2}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
        startTimestamp: sd.getTime() / 1000, startDate: sd, endDate: ed,
        duration: 2, tournament: 'OWCS 2026', team1: t1, team2: t2,
        format: '', status, statusCode: '',
        grade: '', roundName: stage || '', stageDesc: '',
        score, title: `OWCS: ${t1} vs ${t2}`,
      });
    }
  }
  return events;
}

export class OverwatchScraper extends BaseScraper {
  constructor() { super('overwatch', './release/overwatch'); }

  async scrape() {
    // 检查 Camoufox
    try { await fetch(`${CFX}/health`); } catch {
      console.log('  Camoufox 离线，使用缓存模式');
      return { events: [], metadata: { source: 'cache' } };
    }

    let tabId = null;
    try {
      const tr = await fetch(`${CFX}/tabs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'pi', sessionKey: 'owcs', url: URL }),
        signal: AbortSignal.timeout(35000),
      });
      tabId = (await tr.json()).tabId;
      if (!tabId) throw new Error('tab create failed');

      await sleep(3000);
      const sr = await fetch(`${CFX}/tabs/${tabId}/snapshot?userId=pi`);
      const events = parseSnapshot((await sr.json()).snapshot || '');
      console.log(`  OWCS 解析到 ${events.length} 场比赛`);
      return { events, metadata: { source: 'ow.blizzard.cn', scrapedAt: new Date().toISOString() } };
    } catch (err) {
      console.error(`  OWCS 错误: ${err.message}`);
      return { events: [], metadata: {} };
    } finally {
      if (tabId) fetch(`${CFX}/tabs/${tabId}?userId=pi`, { method: 'DELETE' }).catch(() => {});
    }
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
        description: [`赛事: ${ev.tournament}`, `对阵: ${ev.team1} vs ${ev.team2}`, ev.roundName ? `阶段: ${ev.roundName}` : '', `数据来源: ow.blizzard.cn`].filter(Boolean).join('\n'),
        location: 'Online', categories: ['SPORTS', 'ESPORTS', 'OVERWATCH'],
        uid: uid(`owcs_${ev.id}`), status: 'CONFIRMED',
      };
    });
    generateICS({ title: '守望先锋 OWCS 赛事日历', events: icsEvents, outPath: `${this.outDir}/overwatch.ics` });
    console.log(`  跳过 ${data.events.length - upcoming.length} 场非"未开始"的比赛`);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
export default OverwatchScraper;
