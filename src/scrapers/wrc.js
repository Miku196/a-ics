// WRC 世界拉力锦标赛 — wrc.com / Wikipedia 双源
import { load } from 'cheerio';
import { fetchText } from '../lib/fetch.js';
import { BaseScraper } from '../lib/scraper.js';
import { generateICS, uid } from '../lib/ics.js';

const MONTHS = { JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12,
  January:1,February:2,March:3,April:4,May:5,June:6,July:7,August:8,
  September:9,October:10,November:11,December:12 };

const YEAR = new Date().getFullYear();

// 主源 wrc.com（被 Akamai CDN 拦截，CI 环境可能可用）
const WRC_URL = `https://www.wrc.com/en/calendar?rb3TabId=upcoming`;
const WRC_URL_ALT = `https://www.wrc.com/en/calendar/listview`;
// 备用源 Wikipedia（多赛季降级）
const WIKI_URLS = [
  `https://en.wikipedia.org/wiki/${YEAR}_World_Rally_Championship`,
  `https://en.wikipedia.org/wiki/${YEAR - 1}_World_Rally_Championship`,
];

export class WRCScraper extends BaseScraper {
  constructor() { super('wrc', './release/wrc'); }

  async scrape() {
    // 先试 wrc.com（可能被 CDN 拦截）
    for (const url of [WRC_URL, WRC_URL_ALT]) {
      try {
        const html = await fetchText(url, {}, { retries: 1, timeout: 12_000 });
        const $ = load(html);
        let rows = $('[role="row"]').toArray();
        if (!rows.length) rows = $('.data-table__table > div[role]').toArray();

        if (rows.length > 2) {
          const events = this._parseWRCRows($, rows);
          if (events.length > 0) return { events, metadata: { source: url } };
        }
      } catch (err) {
        console.log(`  wrc.com 不可用 (${err.message})`);
      }
    }

    // 降级 Wikipedia（多赛季尝试）
    for (const wikiUrl of WIKI_URLS) {
      try {
        const html = await fetchText(wikiUrl, {}, { retries: 1, timeout: 15_000 });
        const $ = load(html);
        const result = this._parseWikipedia($);
        if (result.events.length > 0) return result;
      } catch (err) {
        console.log(`  Wikipedia 不可用 (${err.message})`);
      }
    }

    return { events: [], metadata: {} };
  }

  _parseWRCRows($, rows) {
    const events = [];
    for (let i = 0; i < rows.length; i += 3) {
      try {
        const round = $(rows[i]).text().trim();
        const rally = $(rows[i + 1]).text().trim();
        const dateRaw = $(rows[i + 2]).text().trim();
        if (!round || !rally || !dateRaw || /round|rally|date/i.test(round)) continue;

        const parsed = this._parseDate(dateRaw);
        if (!parsed) continue;

        events.push({
          title: rally.replace(/^[\u{1F1E6}-\u{1F1FF}\s]+/u, '').trim(),
          race: rally,
          startDate: parsed.start,
          endDate: parsed.end,
        });
      } catch { /* skip */ }
    }
    return events;
  }

  _parseWikipedia($) {
    const events = [];

    // 查找 "Calendar" / "日程" 表格（wikitable）
    $('table.wikitable').each((_, table) => {
      const rows = $(table).find('tr');
      rows.each((_, row) => {
        try {
          const cells = $(row).find('td,th');
          if (cells.length < 3) return;
          const text0 = $(cells[0]).text().trim();
          // 跳过表头行（纯数字轮次 1,2,3... 和表头文字）
          if (/^Round|Round$|轮次/i.test(text0) || !text0) return;

          const rally = $(cells[1] || cells[0]).text().trim();
          const dateCell = $(cells[2] || cells[1] || cells[0]).text().trim();

          const parsed = this._parseDate(dateCell);
          if (!parsed) return;

          events.push({
            title: rally.replace(/^[\u{1F1E6}-\u{1F1FF}\s]+/u, '').trim(),
            race: rally,
            startDate: parsed.start,
            endDate: parsed.end,
          });
        } catch { /* skip */ }
      });
    });

    return {
      events,
      metadata: { source: 'wikipedia.org', scrapedAt: new Date().toISOString() }
    };
  }

  _parseDate(text) {
    // 格式: "22 – 26 January 2026" or "22-26 Jan 2026" or "22 Jan 2026"
    const range = text.match(/(\d{1,2})\s*[-–—]\s*(\d{1,2})\s+(\w{3,})\s+(\d{4})/i);
    if (range) {
      const [, d1, d2, mon, y] = range;
      const month = MONTHS[mon.charAt(0).toUpperCase() + mon.slice(1).toLowerCase()];
      if (!month) return null;
      return {
        start: new Date(Date.UTC(+y, month - 1, +d1)),
        end: new Date(Date.UTC(+y, month - 1, +d2)),
      };
    }

    // 单日
    const single = text.match(/(\d{1,2})\s+(\w{3,})\s+(\d{4})/i);
    if (single) {
      const [, d, mon, y] = single;
      const month = MONTHS[mon.charAt(0).toUpperCase() + mon.slice(1).toLowerCase()];
      if (!month) return null;
      const date = new Date(Date.UTC(+y, month - 1, +d));
      return { start: date, end: date };
    }

    return null;
  }

  generateICS(data) {
    const now = Date.now() - 3600000;
    const upcoming = data.events.filter(ev => {
      const d = ev.startDate instanceof Date ? ev.startDate : new Date(ev.startDate);
      return d.getTime() > now;
    });

    const icsEvents = upcoming.map(ev => {
      const sd = ev.startDate instanceof Date ? ev.startDate : new Date(ev.startDate);
      const ed = ev.endDate instanceof Date ? ev.endDate : new Date(ev.endDate);
      const endDay = new Date(ed);
      endDay.setDate(endDay.getDate() + 1);

      return {
        title: `🏎️ ${ev.title}`,
        start: [sd.getFullYear(), sd.getMonth() + 1, sd.getDate()],
        end: [endDay.getFullYear(), endDay.getMonth() + 1, endDay.getDate()],
        description: `世界拉力锦标赛(WRC) — ${ev.race}`,
        location: ev.title.split(' ').slice(-1)[0] || ev.title,
        categories: ['SPORTS', 'MOTORSPORTS', 'RALLY'],
        uid: uid(`wrc_${ev.title}`),
        status: 'CONFIRMED',
      };
    });

    generateICS({
      title: 'WRC 赛事日历',
      events: icsEvents,
      outPath: `${this.outDir}/wrc.ics`
    });

    console.log(`  跳过 ${data.events.length - upcoming.length} 场已过期的赛事`);
  }
}

export default WRCScraper;
