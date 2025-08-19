#!/usr/bin/env python3
import json, re, requests
from datetime import datetime, timedelta
from pathlib import Path
from bs4 import BeautifulSoup

URL = "https://www.wrc.com/en/calendar/listview"
HTML = requests.get(URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=15).text
soup = BeautifulSoup(HTML, "lxml")

events = []
rows = soup.select(".data-table__table > div[role]")
# 每 3 个 div 为一行（ROUND | RALLY | DATE）
for row_idx in range(0, len(rows), 3):
    try:
        round_   = rows[row_idx].get_text(strip=True)
        rally    = rows[row_idx + 1].get_text(strip=True)
        date_raw = rows[row_idx + 2].get_text(strip=True)

        # 解析日期：22 - 26 JAN 2025
        m = re.match(r"(\d{1,2})\s*-\s*(\d{1,2})\s+(\w+)\s+(\d{4})", date_raw)
        if not m:
            continue
        day_start, day_end, month_str, year = m.groups()
        month = datetime.strptime(month_str, "%b").month
        start_date = f"{year}-{month:02d}-{int(day_start):02d}"
        end_date   = f"{year}-{month:02d}-{int(day_end):02d}"

        events.append({
            "name": rally,
            "location": rally.split(" ", 2)[-1],   # 去掉国旗前缀
            "start_date": start_date,
            "end_date": end_date
        })
    except Exception:
        continue

# --- 输出 JSON ---
Path("./release/wrc/wrc.json").write_text(
    json.dumps(events, ensure_ascii=False, indent=2), encoding="utf-8"
)

# --- 输出 ICS ---
ics_lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WRC 2025//EN",
    "CALSCALE:GREGORIAN"
]
for ev in events:
    dtend = datetime.strptime(ev["end_date"], "%Y-%m-%d") + timedelta(days=1)
    ics_lines.extend([
        "BEGIN:VEVENT",
        f"UID:{ev['name'].replace(' ','_')}@wrc.com",
        f"DTSTART;VALUE=DATE:{ev['start_date'].replace('-','')}",
        f"DTEND;VALUE=DATE:{dtend.strftime('%Y%m%d')}",
        f"SUMMARY:{ev['name']}",
        f"LOCATION:{ev['location']}",
        "END:VEVENT"
    ])
ics_lines.append("END:VCALENDAR")
Path("./release/wrc/wrc.ics").write_bytes("\r\n".join(ics_lines).encode("utf-8"))

print(f"✅ 已导出 {len(events)} 场赛事")