// 简易带时间戳日志
const PREFIX = {
  info:  '📅',
  ok:    '✅',
  warn:  '⚠️',
  error: '❌',
  fetch: '🌐',
};

function ts() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export function log(level, ...args) {
  const icon = PREFIX[level] || '';
  console.log(`[${ts()}] ${icon}`, ...args);
}

export default { log };
