// F1 一级方程式 — 从 f1calendar.com 抓取赛程
import { load } from 'cheerio';
import { fetchText } from '../lib/fetch.js';
import { BaseScraper } from '../lib/scraper.js';
import { generateICS, toDateArray, uid } from '../lib/ics.js';

const URL = 'https://f1calendar.com/zh';
const MONTH_MAP = { '1月':1,'2月':2,'3月':3,'4月':4,'5月':5,'6月':6,
                    '7月':7,'8月':8,'9月':9,'10月':10,'11月':11,'12月':12,
                    Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,
                    Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };

export class F1Scraper extends BaseScraper {
  constructor() { super('f1', './release/f1'); }

  async scrape() {
    const html = await fetchText(URL);
    const $ = load(html);
    const year = new Date().getFullYear();

    const events = [];
    const table = $('#events-table');
    if (!table.length) {
      // 尝试其他选择器
      const altTable = $('table').first();
      if (!altTable.length) return { events, metadata: {} };
    }

    const tbodies = (table.length ? table : $('table').first()).find('tbody');

    tbodies.each((_, tbody) => {
      const rows = $(tbody).find('tr');
      if (!rows.length) return;

      // 第一行是大奖赛名称
      const raceNameRaw = $(rows[0]).find('th').text().trim();
      // 清理名称：去掉"即将开始"、"已结束"等后缀
      const raceName = raceNameRaw
        .replace(/即将开始|已结束|进行中|比赛结束|已取消/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      // 从第二行开始解析各个 session
      for (let i = 1; i < rows.length; i++) {
        const cells = $(rows[i]).find('td');
        if (cells.length < 4) continue;

        const sessionName = $(cells[1]).text().trim();
        const dateStr = $(cells[2]).text().trim();
        const timeStr = $(cells[3]).find('div').first().text().trim();

        if (!dateStr || !timeStr) continue;

        // 解析日期 "14 Mar" 或 "3月14日"
        let month, day;
        const cnMatch = dateStr.match(/(\d{1,2})月(\d{1,2})日/);
        if (cnMatch) {
          month = +cnMatch[1];
          day = +cnMatch[2];
        } else {
          const enMatch = dateStr.match(/(\d{1,2})\s+(\w{3,})/i);
          if (!enMatch) continue;
          day = +enMatch[1];
          month = MONTH_MAP[enMatch[2]] || 1;
        }

        // 解析时间 "09:30"
        const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
        if (!timeMatch) continue;
        const hh = +timeMatch[1];
        const mm = +timeMatch[2];

        // 构造 Date（使用东八区，即 UTC+8）
        const startDate = new Date(Date.UTC(year, month - 1, day, hh - 8, mm));
        const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // +2h

        events.push({
          raceName,
          sessionName,
          startDate,
          endDate,
          title: `F1 ${raceName} — ${sessionName}`,
        });
      }
    });

    return {
      events,
      metadata: { source: URL, year, scrapedAt: new Date().toISOString() }
    };
  }

  generateICS(data) {
    const now = Date.now() - 3600000;
    const upcoming = data.events.filter(ev => ev.startDate.getTime() > now);

    const icsEvents = upcoming.map(ev => ({
      title: ev.title,
      start: toDateArray(ev.startDate),
      end: toDateArray(ev.endDate),
      description: `F1 ${ev.raceName} — ${ev.sessionName}`,
      location: ev.raceName,
      url: URL,
      categories: ['SPORTS', 'MOTORSPORTS', 'F1'],
      uid: uid(`f1_${ev.raceName}_${ev.sessionName}`),
      status: 'CONFIRMED',
      alarms: [{
        action: 'display',
        trigger: { minutes: 15, before: true },
        description: `F1 ${ev.raceName} — ${ev.sessionName} 即将开始`,
      }],
    }));

    generateICS({
      title: 'F1 赛事日历',
      events: icsEvents,
      outPath: `${this.outDir}/f1.ics`
    });

    console.log(`  跳过 ${data.events.length - upcoming.length} 场已过期的赛事`);
  }
}

export default F1Scraper;
