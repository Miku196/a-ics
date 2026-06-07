// ICS 日历生成 — 基于 ics 库封装
import { createEvents } from 'ics';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * 生成并保存 ICS 文件
 * @param {{ title: string, events: Array<ICSInputEvent>, outPath: string }} param
 */
export function generateICS({ title, events, outPath }) {
  if (!events.length) {
    console.log(`  跳过 ${title}: 无有效事件`);
    return;
  }

  const { error, value } = createEvents(events);
  if (error) {
    console.error(`  ICS 生成失败 [${title}]:`, error);
    return;
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, value, 'utf-8');
  console.log(`  已生成 ${outPath} (${events.length} 个事件)`);
}

/**
 * 将 Date 对象转为 ICS 日期数组 [yyyy, mm, dd, hh, mm]
 */
export function toDateArray(d) {
  return [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()];
}

/**
 * 生成唯一 UID
 */
export function uid(str) {
  const base = str.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
  return `${base}_${Date.now()}@a-ics`;
}

export default { generateICS, toDateArray, uid };
