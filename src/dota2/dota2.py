import requests
import json
from datetime import datetime, timedelta
import pytz
from icalendar import Calendar, Event, vText
import time
import os
import random

# Dota 2 赛事API
API_URL = "https://app.5eplay.com/api/tournament/session_list"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Referer": "https://event.5eplay.com/dota/matches",
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
OUTPUT_DIR = "./release/dota2"
FILE_PREFIX = "dota2"

def test_api_connection():
    """测试API连接是否正常"""
    print("测试API连接...")
    test_params = {
        "game_type": 2,  # Dota 2
        "grades": "",     # 所有等级
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
                if data.get('success') and 'data' in data and 'matches' in data['data']:
                    matches = data['data']['matches']
                    print(f"获取到 {len(matches)} 条测试数据")
                    return True
                else:
                    print("返回数据格式不符合预期:")
                    print(json.dumps(data, indent=2, ensure_ascii=False)[:500])
                    return False
            except json.JSONDecodeError:
                print("返回内容不是有效JSON:")
                print(response.text[:500])
                return False
        else:
            print(f"API返回错误: {response.status_code}")
            print(f"响应内容: {response.text[:500]}...")
            return False
    except Exception as e:
        print(f"API连接测试失败: {str(e)}")
        return False

def fetch_all_matches():
    """从API获取所有赛事数据（包括未开始和进行中的比赛）"""
    all_matches = []
    status_labels = {
        1: "未开始",
        2: "进行中"
    }
    
    print("\n开始获取所有Dota 2赛事数据...")
    
    for status in [1, 2]:  # 获取未开始和进行中的比赛
        print(f"\n获取状态: {status_labels[status]}")
        page = 1
        has_more = True
        
        while has_more:
            try:
                params = {
                    "game_type": 2,  # Dota 2
                    "grades": "",      # 所有等级
                    "page": page,
                    "limit": 40,
                    "game_status": status,
                    "_": int(time.time() * 1000)  # 时间戳防止缓存
                }
                
                print(f"第{page}页...")
                response = requests.get(API_URL, params=params, headers=HEADERS, timeout=15)
                response.raise_for_status()
                
                data = response.json()
                
                # 检查返回数据结构
                if not data.get('success') or not isinstance(data, dict) or 'data' not in data:
                    print(f"返回数据格式异常，跳过状态 {status_labels[status]} 第{page}页")
                    if isinstance(data, dict):
                        print(f"返回内容: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}")
                    else:
                        print(f"返回类型: {type(data)}")
                    break
                    
                match_data = data['data']
                if 'matches' not in match_data:
                    print(f"状态 {status_labels[status]} 第{page}页返回数据不包含比赛列表")
                    print(f"返回内容: {json.dumps(match_data, indent=2, ensure_ascii=False)[:500]}")
                    break
                    
                match_list = match_data['matches']
                total = match_data.get('total', 0)
                
                if not match_list:
                    print(f"状态 {status_labels[status]} 第{page}页没有比赛数据")
                    break
                
                print(f"获取到 {len(match_list)} 场比赛 (总计: {total})")
                
                # 提取所有比赛的完整数据
                for match_item in match_list:
                    # 创建合并后的比赛对象
                    merged_match = {}
                    
                    # 合并mc_info数据
                    if 'mc_info' in match_item:
                        mc_info = match_item['mc_info']
                        merged_match.update({
                            "id": mc_info.get("id", ""),
                            "plan_ts": int(mc_info.get("plan_ts", 0)),
                            "format": mc_info.get("format", ""),
                            "grade": mc_info.get("grade", ""),
                            "star": mc_info.get("star", ""),
                            "round_name": mc_info.get("round_name", ""),
                            "tt_stage_desc": mc_info.get("tt_stage_desc", ""),
                            "bo": mc_info.get("bo", ""),
                            "map_info": mc_info.get("map_info", ""),
                        })
                        
                        # 队伍信息
                        if 't1_info' in mc_info:
                            t1_info = mc_info['t1_info']
                            merged_match.update({
                                "team1_id": t1_info.get("id", ""),
                                "team1_name": t1_info.get("disp_name", "待定"),
                                "team1_logo": t1_info.get("logo", "")
                            })
                        
                        if 't2_info' in mc_info:
                            t2_info = mc_info['t2_info']
                            merged_match.update({
                                "team2_id": t2_info.get("id", ""),
                                "team2_name": t2_info.get("disp_name", "待定"),
                                "team2_logo": t2_info.get("logo", "")
                            })
                    
                    # 合并state数据
                    if 'state' in match_item:
                        state_info = match_item['state']
                        merged_match.update({
                            "status": state_info.get("status", ""),
                            "t1_score": state_info.get("t1_score", "0"),
                            "t2_score": state_info.get("t2_score", "0")
                        })
                    
                    # 合并赛事信息
                    if 'tt_info' in match_item:
                        tt_info = match_item['tt_info']
                        merged_match.update({
                            "tournament_id": tt_info.get("id", ""),
                            "tournament_name": tt_info.get("disp_name", "未知赛事"),
                            "tournament_logo": tt_info.get("logo", "")
                        })
                    
                    # 添加API原始状态
                    merged_match["api_status"] = status
                    all_matches.append(merged_match)
                
                # 检查是否还有更多页面
                if total <= page * 40:
                    has_more = False
                else:
                    page += 1
                
                # 随机延迟防止请求过快
                time.sleep(random.uniform(0.5, 1.5))
            
            except Exception as e:
                print(f"获取状态 {status_labels[status]} 第{page}页时出错: {str(e)}")
                break
    
    print(f"\n成功获取 {len(all_matches)} 场比赛")
    return all_matches

def process_matches(raw_matches):
    """处理原始比赛数据并添加状态信息"""
    processed = []
    
    if not raw_matches:
        return processed
    
    current_timestamp = int(time.time())
    
    for match in raw_matches:
        try:
            # 获取比赛时间戳
            timestamp = match.get("plan_ts", 0)
            if not timestamp:
                continue
                
            dt = datetime.fromtimestamp(timestamp, tz=pytz.utc)
            
            # 获取队伍名称
            team1 = match.get("team1_name", "待定") or "待定"
            team2 = match.get("team2_name", "待定") or "待定"
            
            # 获取赛事信息
            tournament = match.get("tournament_name", "未知赛事") or "未知赛事"
            
            # 状态处理逻辑
            status_code = match.get('status', '0')
            
            # 状态映射
            status_map = {
                '0': '未开始',
                '1': '进行中',
                '2': '已结束'
            }
            
            # 确定状态
            status = status_map.get(status_code, "未知")
            
            # 时间修正逻辑
            if status == "未开始" and timestamp < current_timestamp:
                status = "已结束"
            elif status == "进行中" and timestamp > current_timestamp + 3600:  # 1小时缓冲
                status = "未开始"
            elif status == "已结束" and timestamp > current_timestamp:
                status = "未开始"
            
            # 添加比赛结果信息
            score1 = match.get("t1_score", "0") or "0"
            score2 = match.get("t2_score", "0") or "0"
            result = f"{score1}-{score2}"
            
            # Dota 2 赛制映射
            format_map = {
                "1": "BO1",
                "2": "BO2",
                "3": "BO3",
                "5": "BO5"
            }
            best_type = format_map.get(match.get("format", ""), match.get("format", ""))
            
            # 游戏类型默认为Dota 2
            game_type = "Dota 2"
            
            # 赛事等级信息
            grade_map = {
                "1": "S级",
                "2": "A级",
                "3": "B级",
                "4": "C级",
                "5": "其他"
            }
            grade = grade_map.get(match.get("grade", ""), "")
            
            # 轮次信息
            round_name = match.get("round_name", "") or ""
            stage_desc = match.get("tt_stage_desc", "") or ""
            
            processed.append({
                "id": match.get("id", ""),
                "timestamp": timestamp,
                "datetime_utc": dt.isoformat(),
                "tournament": tournament,
                "team1": team1,
                "team2": team2,
                "best_type": best_type,
                "status": status,
                "result": result,
                "status_code": status_code,
                "api_status": match.get("api_status", ""),
                "tournament_id": match.get("tournament_id", ""),
                "game_type": game_type,
                "grade": grade,
                "star": match.get("star", ""),
                "bo": match.get("bo", ""),
                "map_info": match.get("map_info", ""),
                "round_name": round_name,
                "stage_desc": stage_desc,
                "team1_logo": match.get("team1_logo", ""),
                "team2_logo": match.get("team2_logo", ""),
                "tournament_logo": match.get("tournament_logo", "")
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
    """生成ICS日历文件（仅包含未开始的比赛）"""
    if not matches:
        print("没有比赛数据可生成ICS文件")
        return
    
    cal = Calendar()
    cal.add('prodid', '-//5EPlay Dota 2 赛事日历//')
    cal.add('version', '2.0')
    cal.add('X-WR-CALNAME', 'Dota 2 赛事日程')
    
    event_count = 0
    skipped_count = 0
    
    for match in matches:
        # 只导出未开始的比赛
        if match.get('status') != "未开始":
            skipped_count += 1
            continue
            
        try:
            event = Event()
            dt = datetime.fromisoformat(match['datetime_utc'])
            event.add('dtstart', dt)
            
            # 设置事件结束时间（根据比赛类型估计）
            best_type = match.get('best_type', '')
            if "BO3" in best_type or "BO5" in best_type:
                duration = 3  # BO3/BO5预计3小时
            else:
                duration = 2   # BO1/BO2预计2小时
            event.add('dtend', dt + timedelta(hours=duration))
            
            # 创建事件标题和描述
            title = f"{match['tournament']}: {match['team1']} vs {match['team2']}"
            
            # 添加轮次信息
            description = f"比赛ID: {match['id']}\n赛制: {match['best_type']}"
            if match.get('round_name'):
                description += f"\n轮次: {match['round_name']}"
            if match.get('stage_desc'):
                description += f"\n阶段: {match['stage_desc']}"
                
            description += (
                f"\n赛事等级: {match.get('grade', '未知')}"
                f"\n状态: {match['status']}"
                f"\n预计时长: {duration}小时"
                f"\n数据来源: 5EPlay"
            )
            
            event.add('summary', title)
            event.add('description', description)
            event.add('location', vText('5EPlay 赛事平台'))
            event_url = f"https://event.5eplay.com/dota/session/{match['id']}"
            event.add('url', event_url)
            
            # 添加唯一标识符避免重复
            event['uid'] = f"{match['id']}@5eplay.com"
            
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
    
    print(f"已保存ICS文件: {filename} (包含 {event_count} 场未开始的比赛, 跳过 {skipped_count} 场其他状态的比赛)")

def save_to_csv(matches, filename):
    """保存数据到CSV文件（包含所有比赛）"""
    if not matches:
        print("没有比赛数据可生成CSV文件")
        return False
    
    try:
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        with open(filename, 'w', encoding='utf-8-sig') as f:
            # 写入表头
            headers = [
                "ID", "开始时间(UTC)", "赛事名称", "队伍1", "队伍2", "赛制", "状态", 
                "结果", "状态码", "API状态", "赛事ID", "游戏类型", "赛事等级", 
                "赛事星级", "BO场次", "地图信息", "轮次名称", "阶段描述"
            ]
            f.write(','.join(headers) + '\n')
            
            for match in matches:
                # 准备数据并转义特殊字符
                fields = [
                    str(match.get('id', '')),
                    match.get('datetime_utc', ''),
                    match.get('tournament', '').replace(',', '，'),
                    match.get('team1', '').replace(',', '，'),
                    match.get('team2', '').replace(',', '，'),
                    match.get('best_type', ''),
                    match.get('status', ''),
                    match.get('result', ''),
                    str(match.get('status_code', '')),
                    str(match.get('api_status', '')),
                    str(match.get('tournament_id', '')),
                    str(match.get('game_type', '')),
                    str(match.get('grade', '')),
                    str(match.get('star', '')),
                    str(match.get('bo', '')),
                    match.get('map_info', '').replace(',', '，'),
                    match.get('round_name', '').replace(',', '，'),
                    match.get('stage_desc', '').replace(',', '，')
                ]
                f.write(','.join(f'"{field}"' for field in fields) + '\n')
        
        print(f"已保存CSV文件: {filename} (包含 {len(matches)} 场比赛)")
        return True
    except Exception as e:
        print(f"保存CSV文件时出错: {str(e)}")
        return False

def main():
    print("="*50)
    print("5EPlay Dota 2 赛事数据爬取工具")
    print("="*50)
    
    # 确保输出目录存在
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 测试API连接
    if not test_api_connection():
        print("\nAPI连接失败，请检查网络或网站状态")
        return
    
    # 获取并处理数据
    raw_matches = fetch_all_matches()
    
    if not raw_matches:
        print("\n未能获取任何赛事数据，请检查API接口或网站更新")
        return
    
    processed_matches = process_matches(raw_matches)
    
    if not processed_matches:
        print("\n成功获取原始数据但处理失败，请检查数据结构")
        return
    
    # 按时间排序（最近的比赛在前面）
    processed_matches.sort(key=lambda x: x['timestamp'])
    
    # 保存为JSON
    json_file = os.path.join(OUTPUT_DIR, f"{FILE_PREFIX}.json")
    save_to_json(processed_matches, json_file)
    
    # 保存为CSV
    csv_file = os.path.join(OUTPUT_DIR, f"{FILE_PREFIX}.csv")
    save_to_csv(processed_matches, csv_file)
    
    # 保存为ICS
    ics_file = os.path.join(OUTPUT_DIR, f"{FILE_PREFIX}.ics")
    save_to_ics(processed_matches, ics_file)
    
    print("\n数据爬取完成！所有文件保存在: " + os.path.abspath(OUTPUT_DIR))

if __name__ == '__main__':
    main()