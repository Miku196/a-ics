// HTTP 请求封装：重试 + 超时 + 浏览器 UA
import { log } from './logger.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/**
 * 带重试的 fetch
 * @param {string} url
 * @param {RequestInit} [opts]
 * @param {{ retries?: number, timeout?: number }} [options]
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, opts = {}, { retries = 3, timeout = 20_000 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const mergedOpts = {
        ...opts,
        headers: {
          'User-Agent': UA,
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          ...(opts.headers || {}),
        },
        signal: controller.signal,
      };

      const resp = await fetch(url, mergedOpts);
      clearTimeout(timer);
      if (!resp.ok && i < retries) {
        log('warn', `HTTP ${resp.status} 重试 ${i + 1}/${retries}: ${url}`);
        await sleep(2000 * (i + 1));
        continue;
      }
      return resp;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (i < retries) {
        log('warn', `请求失败 重试 ${i + 1}/${retries}: ${err.message}`);
        await sleep(2000 * (i + 1));
      }
    }
  }
  throw lastErr || new Error(`fetch failed: ${url}`);
}

export async function fetchJSON(url, opts = {}, options) {
  const resp = await fetchWithRetry(url, opts, options);
  return resp.json();
}

export async function fetchText(url, opts = {}, options) {
  const resp = await fetchWithRetry(url, opts, options);
  return resp.text();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export default { fetchWithRetry, fetchJSON, fetchText };
