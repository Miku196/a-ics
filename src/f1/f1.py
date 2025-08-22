#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import json
import os
import icalendar
from typing import List, Dict, Any

def parse_date_time(date_str, time_str):

    # 获取当前年份
    current_year = datetime.now().year
    
    # 将月份缩写转换为数字
    month_map = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
        'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    }
    
    # 解析日期
    day, month_abbr = date_str.split()
    month = month_map.get(month_abbr, '01')
    
    # 构造日期时间对象
    date_time_str = f"{current_year}-{month}-{day} {time_str}"
    dt = datetime.strptime(date_time_str, "%Y-%m-%d %H:%M")
    
    # 返回格式化的日期、时间和datetime对象
    return {
        'date': dt.strftime("%Y%m%d"),
        'time': dt.strftime("%H:%M"),
        'datetime': dt  # 返回完整的datetime对象供后续使用
    }

def generate_ics(races: List[Dict[str, Any]]) -> bytes:
    # 常量定义
    PROD_ID = '-//F1 Calendar//mxm.dk//'
    VERSION = '2.0'
    
    # 创建日历对象
    cal = icalendar.Calendar()
    cal.add('prodid', PROD_ID)
    cal.add('version', VERSION)
    cal.add('calscale', 'GREGORIAN')
    cal.add('method', 'PUBLISH')
    cal.add('x-wr-calname', 'F1赛事日历')
    cal.add('x-wr-timezone', 'Asia/Shanghai')
    
    # 处理每个比赛
    for race in races:
        try:
            # 验证必要字段
            if not all(key in race for key in ['race_name', 'session_name', 'date', 'time', 'datetime']):
                continue
                
            # 创建事件
            event = icalendar.Event()
            event.add('summary', f"F1 {race['race_name']} - {race['session_name']}")
            
            # 添加开始时间
            event.add('dtstart', race['datetime'])
            
            # 假设每个赛事持续2小时
            event_end = race['datetime'] + timedelta(hours=2)
            event.add('dtend', event_end)
            
            # 添加提前15分钟的提醒
            alarm = icalendar.Alarm()
            alarm.add('action', 'DISPLAY')
            alarm.add('description', f"F1 {race['race_name']} - {race['session_name']} 即将开始")
            alarm.add('trigger', timedelta(minutes=-15))  # 提前15分钟
            event.add_component(alarm)
            
            # 添加描述
            event.add('description', f"F1 {race['race_name']} - {race['session_name']}\n时间: {race['time']} (东八区)")
            
            # 添加位置
            event.add('location', race['race_name'])
            
            # 添加分类
            event.add('categories', 'SPORTS,MOTORSPORTS,F1')
            
            # 添加透明度
            event.add('transp', 'TRANSPARENT')
            
            # 添加唯一标识符
            event.add('uid', f"{race['race_name'].replace(' ', '_')}_{race['session_name'].replace(' ', '_')}_{race['date']}@f1calendar.com")
            
            # 添加事件到日历
            cal.add_component(event)
        except (ValueError, KeyError) as e:
            # 记录错误但继续处理其他比赛
            print(f"Error processing race {race.get('race_name', 'unknown')}: {e}")
            continue
    
    return cal.to_ical()

def main():
    # 发送HTTP请求获取网页内容
    url = 'https://f1calendar.com/zh'
    response = requests.get(url)
    response.encoding = 'utf-8'  # 设置编码为UTF-8以正确显示中文

    # 使用BeautifulSoup解析HTML
    soup = BeautifulSoup(response.text, 'html.parser')

    # 找到id为"events-table"的表格
    table = soup.find('table', {'id': 'events-table'})

    # 存储所有比赛信息的列表
    races = []

    # 遍历表格中的所有tbody元素（每个tbody代表一个大奖赛）
    for tbody in table.find_all('tbody'):
        # 获取大奖赛名称（从第一行的th元素）
        race_name = tbody.find('th').text.strip()
        
        # 获取该大奖赛的所有行
        rows = tbody.find_all('tr')
        
        # 跳过第一行（因为它只包含大奖赛名称和日期的概览）
        # 从第二行开始处理每个赛事阶段
        for row in rows[1:]:
            # 获取所有单元格
            cells = row.find_all('td')
            
            # 确保有足够的单元格
            if len(cells) >= 3:
                # 获取赛事阶段名称
                session_name = cells[1].text.strip()
                
                # 获取日期
                session_date = cells[2].text.strip()
                
                # 获取时间
                time_div = cells[3].find('div')
                session_time = time_div.text.strip() if time_div else ""
                
                # 解析日期和时间（已经是东八区时间）
                if session_date and session_time:
                    parsed_time = parse_date_time(session_date, session_time)
                    formatted_date = parsed_time['date']
                    formatted_time = parsed_time['time']
                    event_datetime = parsed_time['datetime']
                else:
                    formatted_date = ""
                    formatted_time = ""
                    event_datetime = None
                
                # 将比赛信息添加到列表中
                races.append({
                    'race_name': race_name,
                    'session_name': session_name,
                    'date': formatted_date,
                    'time': formatted_time,
                    'datetime': event_datetime
                })

    # 打印所有比赛信息
    for race in races:
        print(f"{race['race_name']} {race['session_name']}\t{race['date']}")

    # 创建输出目录
    os.makedirs('./release/f1', exist_ok=True)

    # 将比赛信息保存为JSON文件
    with open('./release/f1/f1.json', 'w', encoding='utf-8') as f:
        # 创建一个可序列化的副本，将datetime对象转换为字符串
        serializable_races = []
        for race in races:
            race_copy = race.copy()
            if 'datetime' in race_copy and race_copy['datetime'] is not None:
                race_copy['datetime'] = race_copy['datetime'].isoformat()
            serializable_races.append(race_copy)
        
        json.dump(serializable_races, f, ensure_ascii=False, indent=4)

    # 将比赛信息保存为ICS文件
    with open('./release/f1/f1.ics', 'wb') as f:
        f.write(generate_ics(races))


if __name__ == '__main__':
    main()
