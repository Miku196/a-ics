import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import json
import os
import icalendar
from typing import List, Dict, Any


def convert_to_eight_timezone(date_str, time_str):
    """
    将日期和时间转换为东八区时间
    原始时间似乎是伦敦时间（UTC+0或UTC+1，取决于夏令时）
    东八区是UTC+8
    """
    # 解析日期和时间
    # 假设日期格式是 "dd Mmm"（例如 "24 Oct"）
    # 时间格式是 "HH:MM"（例如 "19:30"）
    
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
    
    # 假设原始时间是UTC时间（伦敦时间在夏令时是UTC+1，冬令时是UTC+0）
    # 为了简化，我们统一按UTC+0处理，然后加上8小时得到东八区时间
    dt_utc = dt
    dt_eight = dt_utc + timedelta(hours=8)
    
    # 格式化为yyyymmdd
    return dt_eight.strftime("%Y%m%d")

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
            
            # 转换为东八区时间并格式化为yyyymmdd
            if session_date and session_time:
                formatted_date = convert_to_eight_timezone(session_date, session_time)
            else:
                formatted_date = ""
            
            # 将比赛信息添加到列表中
            races.append({
                'race_name': race_name,
                'session_name': session_name,
                'date': formatted_date,
                'time': session_time
            })

# 打印所有比赛信息
for race in races:
    print(f"{race['race_name']} {race['session_name']}\t{race['date']}")

# 将比赛信息保存为JSON文件
os.makedirs('./release/f1', exist_ok=True)
with open('./release/f1/races.json', 'w', encoding='utf-8') as f:
    json.dump(races, f, ensure_ascii=False, indent=4)



def generate_ics(races: List[Dict[str, Any]]) -> bytes:
    """生成ICS日历文件
    
    Args:
        races: 比赛信息列表，每个元素是一个包含比赛信息的字典
        
    Returns:
        bytes: ICS格式的日历数据
    """
    # 常量定义
    PROD_ID = '-//F1 Calendar//mxm.dk//'
    VERSION = '2.0'
    DATE_FORMAT = "%Y%m%d"
    
    # 创建日历对象
    cal = icalendar.Calendar()
    cal.add('prodid', PROD_ID)
    cal.add('version', VERSION)
    
    # 处理每个比赛
    for race in races:
        try:
            # 验证必要字段
            if not all(key in race for key in ['race_name', 'session_name', 'date', 'time']):
                continue
                
            # 创建事件
            event = icalendar.Event()
            event.add('summary', f"F1 {race['race_name']} - {race['session_name']}")
            
            # 解析日期
            event_date = datetime.strptime(race['date'], DATE_FORMAT).date()
            event.add('dtstart', event_date)
            
            # 添加描述
            event.add('description', f"Time: {race['time']}")
            
            # 添加事件到日历
            cal.add_component(event)
        except (ValueError, KeyError) as e:
            # 记录错误但继续处理其他比赛
            print(f"Error processing race {race.get('race_name', 'unknown')}: {e}")
            continue
    
    return cal.to_ical()

# 将比赛信息保存为ICS文件
with open('./release/f1/races.ics', 'wb') as f:
    f.write(generate_ics(races))

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
                
                # 转换为东八区时间并格式化为yyyymmdd
                if session_date and session_time:
                    formatted_date = convert_to_eight_timezone(session_date, session_time)
                else:
                    formatted_date = ""
                
                # 将比赛信息添加到列表中
                races.append({
                    'race_name': race_name,
                    'session_name': session_name,
                    'date': formatted_date,
                    'time': session_time
                })

    # 打印所有比赛信息
    for race in races:
        print(f"{race['race_name']} {race['session_name']}\t{race['date']}")

    # 将比赛信息保存为JSON文件
    os.makedirs('./release/f1', exist_ok=True)
    with open('./release/f1/races.json', 'w', encoding='utf-8') as f:
        json.dump(races, f, ensure_ascii=False, indent=4)

    # 将比赛信息保存为ICS文件
    with open('./release/f1/races.ics', 'wb') as f:
        f.write(generate_ics(races))

if __name__ == '__main__':
    main()
