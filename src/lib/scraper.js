// 基础爬虫类 — 缓存、容错
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { log } from './logger.js';

export class BaseScraper {
  /**
   * @param {string} name     赛事名称 (wrc/f1/csgo/dota2)
   * @param {string} outDir   输出目录
   */
  constructor(name, outDir) {
    this.name = name;
    this.outDir = outDir;
    this.cacheFile = `${outDir}/${name}.json`;
  }

  /** 子类必须实现：返回 { events, metadata } */
  async scrape() {
    throw new Error('Not implemented');
  }

  /** 读取上次成功抓取的数据作为兜底 */
  loadCache() {
    try {
      if (existsSync(this.cacheFile)) {
        const raw = readFileSync(this.cacheFile, 'utf-8');
        const data = JSON.parse(raw);
        if (data.events && data.events.length) {
          return data;
        }
      }
    } catch (_) { /* ignore */ }
    return null;
  }

  /** 保存抓取结果到本地缓存 */
  saveCache(data) {
    try {
      mkdirSync(dirname(this.cacheFile), { recursive: true });
      writeFileSync(this.cacheFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      log('warn', `缓存写入失败 [${this.name}]: ${e.message}`);
    }
  }

  /** 主流程：抓取 or 降级缓存 */
  async run() {
    log('info', `[${this.name.toUpperCase()}] 开始抓取...`);
    try {
      const data = await this.scrape();
      if (data && data.events && data.events.length > 0) {
        this.saveCache(data);
        log('ok', `[${this.name.toUpperCase()}] 成功获取 ${data.events.length} 条`);
        return { ...data, fromCache: false };
      }
      log('warn', `[${this.name.toUpperCase()}] 抓取结果为空，尝试使用缓存`);
    } catch (err) {
      log('error', `[${this.name.toUpperCase()}] 抓取失败: ${err.message}`);
    }

    // 降级：使用缓存
    const cached = this.loadCache();
    if (cached) {
      log('warn', `[${this.name.toUpperCase()}] 降级使用缓存数据 (${cached.events.length} 条)`);
      return { ...cached, fromCache: true, stale: true };
    }

    log('error', `[${this.name.toUpperCase()}] 无可用数据（抓取失败且无缓存）`);
    return { events: [], fromCache: false, failed: true };
  }
}

export default { BaseScraper };
