#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json, re, requests
from datetime import datetime, timedelta, timezone
from pathlib import Path
from bs4 import BeautifulSoup

def convert_to_cst(date_str):
    """将日期字符串转换为东八区时间"""
    # 假设原始日期是UTC时间
    utc_date = datetime.strptime(date_str, "%Y-%m-%d")
    # 转换为东八区时间
    cst_date = utc_date.replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=8)))
    return cst_date

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
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:WRC赛事日历",
    "X-WR-TIMEZONE:Asia/Shanghai"
]
for ev in events:
    try:
        # 转换日期为东八区时间
        start_date_cst = convert_to_cst(ev["start_date"])
        end_date_cst = convert_to_cst(ev["end_date"])
        
        # 在ICS中，DTEND应该是事件的最后一天的下一天
        dtend_cst = end_date_cst + timedelta(days=1)
        
        # 创建事件UID（移除特殊字符）
        uid = ev['name'].replace(' ', '_').replace(':', '').replace(',', '') + f"@wrc.com"
        
        # 添加事件到ICS
        ics_lines.extend([
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTART;VALUE=DATE:{start_date_cst.strftime('%Y%m%d')}",
            f"DTEND;VALUE=DATE:{dtend_cst.strftime('%Y%m%d')}",
            f"SUMMARY:{ev['name']}",
            f"LOCATION:{ev['location']}",
            f"DESCRIPTION:世界拉力锦标赛(WRC)赛事: {ev['name']}\\n\\n开始时间: {start_date_cst.strftime('%Y-%m-%d')} (东八区)\\n结束时间: {end_date_cst.strftime('%Y-%m-%d')} (东八区)",
            "CATEGORIES:SPORTS,MOTORSPORTS,RALLY",
            "TRANSP:TRANSPARENT",  # 显示为忙碌状态
            "END:VEVENT"
        ])
    except Exception as e:
        print(f"处理事件 {ev.get('name', '未知')} 时出错: {e}")
        continue
ics_lines.append("END:VCALENDAR")
Path("./release/wrc/wrc.ics").write_bytes("\r\n".join(ics_lines).encode("utf-8"))

print(f"[成功] 已导出 {len(events)} 场赛事")
