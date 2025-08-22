import requests
import json
from datetime import datetime, timedelta
import pytz
from icalendar import Calendar, Event, vText
import time
import os
import random

API_URL = "https://app.5eplay.com/api/tournament/session_list"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Referer": "https://event.5eplay.com/csgo/matches",
    "Origin": "https://event.5eplay.com",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
}

# 定义输出目录和文件名前缀
OUTPUT_DIR = "./release/csgo"
FILE_PREFIX = "csgo"

def test_api_connection():
    """测试API连接是否正常"""
    print("测试API连接...")
    test_params = {
        "game_status": 1,
        "game_type": 1,
        "page": 1,
        "limit": 1,
        "_": int(time.time() * 1000)  # 添加时间戳防缓存
    }
    
    try:
        response = requests.get(API_URL, params=test_params, headers=HEADERS, timeout=10)
        print(f"API响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            print("API连接成功!")
            try:
                data = response.json()
                print(f"API返回数据结构: {list(data.keys()) if isinstance(data, dict) else type(data)}")
                if 'data' in data and 'matches' in data['data']:
                    print(f"获取到 {len(data['data']['matches'])} 条测试数据")
                    return True
                else:
                    print("返回数据格式不符合预期:")
                    print(json.dumps(data, indent=2, ensure_ascii=False)[:500])
            except json.JSONDecodeError:
                print("返回内容不是有效JSON:")
                print(response.text[:500])
        else:
            print(f"API返回错误: {response.status_code}")
            print(f"响应内容: {response.text[:500]}...")
            
        return False
    except Exception as e:
        print(f"API连接测试失败: {str(e)}")
        return False

def fetch_all_matches():
    """从API获取所有赛事数据（包括已结束、进行中和未开始的比赛）"""
    all_matches = []
    
    # 尝试获取所有状态数据
    print("\n尝试获取比赛数据...")
    
    for attempt in range(1, 4):  # 最多尝试3次
        print(f"\n尝试 #{attempt}")
        
        for status in [0, 1, 2, 3, None]:  # None表示不指定状态
            params = {
                "game_type": 1,  # CSGO
                "page": 1,
                "limit": 40,
                "_": int(time.time() * 1000)  # 时间戳防止缓存
            }
            
            # 添加状态参数（如果指定）
            if status is not None:
                params["game_status"] = status
                status_label = str(status)
            else:
                status_label = "未指定"
            
            try:
                print(f"请求参数: status={status_label}, page=1, limit=40")
                response = requests.get(API_URL, params=params, headers=HEADERS, timeout=15)
                response.raise_for_status()
                
                data = response.json()
                
                # 检查返回数据结构
                if not isinstance(data, dict) or 'data' not in data:
                    print(f"返回数据格式异常，跳过状态 {status_label}")
                    if isinstance(data, dict):
                        print(f"返回内容: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}")
                    else:
                        print(f"返回类型: {type(data)}")
                    continue
                    
                if 'matches' not in data['data']:
                    print(f"状态 {status_label} 返回数据不包含比赛列表")
                    print(f"返回内容: {json.dumps(data['data'], indent=2, ensure_ascii=False)[:500]}")
                    continue
                    
                match_list = data['data']['matches']
                total = data['data'].get('total', 0) or len(match_list)
                
                if match_list:
                    print(f"状态 {status_label}: 获取到第1页 {len(match_list)} 场比赛 (总计: {total})")
                    
                    # 提取所有比赛的 mc_info 对象
                    for match_item in match_list:
                        if 'mc_info' in match_item:
                            all_matches.append(match_item['mc_info'])
                    
                    # 如果数据量充足，尝试获取后续页面
                    if total > len(match_list):
                        total_pages = (total + 39) // 40  # 向上取整
                        print(f"需要获取 {total_pages} 页数据...")
                        
                        for page in range(2, total_pages + 1):
                            page_params = params.copy()
                            page_params['page'] = page
                            
                            try:
                                page_response = requests.get(API_URL, params=page_params, headers=HEADERS, timeout=10)
                                page_response.raise_for_status()
                                page_data = page_response.json()
                                
                                if 'data' in page_data and 'matches' in page_data['data']:
                                    page_matches = page_data['data']['matches']
                                    for match_item in page_matches:
                                        if 'mc_info' in match_item:
                                            all_matches.append(match_item['mc_info'])
                                    print(f"状态 {status_label}: 第 {page} 页获取 {len(page_matches)} 场比赛")
                                else:
                                    print(f"状态 {status_label}: 第 {page} 页数据格式异常")
                                    print(json.dumps(page_data, indent=2, ensure_ascii=False)[:500] if page_data else "空响应")
                                
                                # 随机延迟防止请求过快
                                time.sleep(random.uniform(0.5, 1.5))
                            except Exception as e:
                                print(f"获取状态 {status_label} 第 {page} 页时出错: {str(e)}")
                                break
                else:
                    print(f"状态 {status_label} 未获取到比赛数据")
                
                # 随机延迟
                time.sleep(random.uniform(0.5, 1.0))
            except Exception as e:
                print(f"获取状态 {status_label} 数据时出错: {str(e)}")
        
        # 如果已获取数据则跳出重试循环
        if all_matches:
            print(f"成功获取 {len(all_matches)} 场比赛")
            return all_matches
    
    print("\n所有尝试均未获取到数据，请检查网络或API状态")
    return []

def process_matches(raw_matches):
    """处理原始比赛数据并添加状态信息"""
    processed = []
    
    if not raw_matches:
        return processed
    
    current_timestamp = int(time.time())
    
    for match in raw_matches:
        try:
            # 获取比赛时间戳
            timestamp = int(match.get("plan_ts", 0))
            if not timestamp:
                continue
                
            dt = datetime.fromtimestamp(timestamp, tz=pytz.utc)
            
            # 获取队伍名称
            team1_info = match.get("t1_info", {})
            team2_info = match.get("t2_info", {})
            team1 = team1_info.get("disp_name", "待定") or "待定"
            team2 = team2_info.get("disp_name", "待定") or "待定"
            
            # 获取赛事信息
            tournament_info = match.get("tournament_info", {})
            tournament = tournament_info.get("name", "未知赛事") or "未知赛事"
            
            # 根据比赛时间确定状态
            if timestamp > current_timestamp:
                status = "未开始"
                status_code = 1
            else:
                status = "已结束"
                status_code = 3
            
            # 添加比赛结果信息（如果有）
            score1 = match.get("t1_score", "") or ""
            score2 = match.get("t2_score", "") or ""
            result = f"{score1}-{score2}" if score1 != "" and score2 != "" else "无"
            
            # 赛制映射
            format_map = {
                "1": "BO1",
                "2": "BO2",
                "3": "BO3",
                "5": "BO5"
            }
            best_type = format_map.get(match.get("format", ""), match.get("format", ""))
            
            processed.append({
                "id": match.get("id", "") or "",
                "timestamp": timestamp,
                "datetime_utc": dt.isoformat(),
                "tournament": tournament,
                "team1": team1,
                "team2": team2,
                "best_type": best_type,
                "match_type": match.get("match_type", "") or "",
                "status": status,
                "result": result,
                "status_code": status_code,
                "tournament_id": match.get("tournament_id", "") or "",
                "game_type": match.get("game_type", "") or match.get("game_type_name", "") or "csgo",
                "map_info": match.get("map_info", "") or ""
            })
        except Exception as e:
            print(f"处理比赛数据出错: {str(e)}\n原始数据: {json.dumps(match, ensure_ascii=False)[:200]}")
    
    return processed

def save_to_json(data, filename):
    """保存数据到JSON文件"""
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"已保存JSON文件: {filename} (包含 {len(data)} 场比赛)")

def save_to_ics(matches, filename):
    """生成ICS日历文件（仅包含未开始和进行中的比赛）"""
    if not matches:
        print("没有比赛数据可生成ICS文件")
        return
    
    cal = Calendar()
    cal.add('prodid', '-//5EPlay CS:GO 赛事日历//')
    cal.add('version', '2.0')
    cal.add('X-WR-CALNAME', 'CS:GO 赛事日程')
    
    event_count = 0
    skipped_count = 0
    
    for match in matches:
        # 只导出未开始的比赛（已结束的比赛不包含在日历中）
        if match.get('status_code', 0) != 1:
            skipped_count += 1
            continue
            
        try:
            event = Event()
            dt = datetime.fromisoformat(match['datetime_utc'])
            event.add('dtstart', dt)
            
            # 设置事件结束时间（根据比赛类型估计）
            best_type = match.get('best_type', '')
            if "BO3" in best_type or "BO5" in best_type:
                duration = 3
            else:
                duration = 2
            event.add('dtend', dt + timedelta(hours=duration))
            
            # 创建事件标题和描述
            title = f"{match['tournament']}: {match['team1']} vs {match['team2']}"
            description = (
                f"比赛ID: {match['id']}\n"
                f"赛制: {match['best_type']}\n"
                f"状态: {match['status']}\n"
                f"预计时长: {duration}小时\n"
                f"数据来源: 5EPlay"
            )
            
            event.add('summary', title)
            event.add('description', description)
            event.add('location', vText('5EPlay 赛事平台'))
            event.add('url', f"https://event.5eplay.com/csgo/session/{match['id']}")
            
            # 添加唯一标识符避免重复
            event['uid'] = f"{match['id']}@5eplay.com"
            
            # 设置事件状态为未开始
            event.add('status', 'TENTATIVE')
            
            cal.add_component(event)
            event_count += 1
        except Exception as e:
            print(f"创建事件出错: {str(e)}\n比赛数据: {json.dumps(match, ensure_ascii=False)[:200]}")
    
    if event_count == 0:
        print("没有即将开始的比赛可生成ICS文件")
        return
    
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, 'wb') as f:
        f.write(cal.to_ical())
    
    print(f"已保存ICS文件: {filename} (包含 {event_count} 场未开始的比赛, 跳过 {skipped_count} 场已结束的比赛)")

def main():
    print("="*50)
    print("5EPlay CS:GO 赛事数据爬取工具")
    print("="*50)
    
    # 确保输出目录存在
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 测试API连接
    if not test_api_connection():
        print("\nAPI连接失败，请检查网络或网站状态")
        return
    
    # 获取并处理数据
    print("\n开始获取所有CS:GO赛事数据...")
    raw_matches = fetch_all_matches()
    
    if not raw_matches:
        print("\n未能获取任何赛事数据，请检查API接口或网站更新")
        return
    
    processed_matches = process_matches(raw_matches)
    
    if not processed_matches:
        print("\n成功获取原始数据但处理失败，请检查数据结构")
        return
    
    # 按时间排序（最新的在前面）
    processed_matches.sort(key=lambda x: x['timestamp'], reverse=True)
    
    # 保存为JSON
    json_file = os.path.join(OUTPUT_DIR, f"{FILE_PREFIX}.json")
    save_to_json(processed_matches, json_file)
    
    # 保存为ICS
    ics_file = os.path.join(OUTPUT_DIR, f"{FILE_PREFIX}.ics")
    save_to_ics(processed_matches, ics_file)
    
    print("\n数据爬取完成！所有文件保存在: " + os.path.abspath(OUTPUT_DIR))

if __name__ == '__main__':
    main()