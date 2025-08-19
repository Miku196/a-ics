<<<<<<< HEAD
# 赛车赛事日历生成器

本项目自动从WRC和F1官网抓取赛事日历并生成ICS格式的日历文件。

## 功能特性

### WRC赛事
- 自动从WRC官网获取最新赛事安排
- 解析赛事信息包括：
  - 轮次编号
  - 国家/地区旗帜emoji
  - 赛事名称
  - 比赛日期
- 自动处理跨年度赛事
- 生成标准ICS日历文件

### F1赛事
- 自动从F1官网获取赛季赛程
- 解析赛事信息包括：
  - 大奖赛名称
  - 举办国家/地区
  - 比赛日期
  - 赛道信息
- 支持多时区转换
- 生成标准ICS日历文件

## 使用方法

1. 安装依赖：
```bash
pip install -r requirements.txt
```

2. 运行脚本：
```bash
# WRC赛事
python src/wrc/wrc.py

# F1赛事
python src/f1/f1.py
```

3. 生成的文件位于：
- WRC赛事：
  - `release/wrc/wrc_page.html` - 原始网页备份
  - `release/wrc/wrc_data.json` - 解析后的赛事数据
  - `release/wrc/wrc_calendar.ics` - 生成的日历文件
- F1赛事：
  - `release/f1/races.json` - 解析后的赛事数据
  - `release/f1/races.ics` - 生成的日历文件

## 配置文件
项目根目录下的`config.yml`包含以下配置：
- 数据源URL
- 输出目录
- 输出文件名

## 数据字段说明

### WRC赛事
- round: 赛事轮次
- flag: 国家/地区旗帜emoji
- name: 赛事名称
- start_date: 开始日期(ISO格式)
- end_date: 结束日期(ISO格式)
- date_str: 原始日期字符串
- full_name: 完整赛事名称(含旗帜emoji)

### F1赛事
- round: 赛事轮次
- name: 大奖赛名称
- circuit: 赛道名称
- country: 举办国家
- start_date: 开始日期
- end_date: 结束日期
- sessions: 各阶段时间(练习赛、排位赛、正赛)

## 订阅日历

您可以通过以下链接订阅赛事日历：
- [WRC赛事日历](https://[YOUR_GITHUB_USERNAME].github.io/[REPO_NAME]/release/wrc/wrc_calendar.ics)
- [F1赛事日历](https://[YOUR_GITHUB_USERNAME].github.io/[REPO_NAME]/release/f1/races.ics)

## 注意事项

- 需要网络连接访问WRC和F1官网
- 每年赛季初可能需要更新选择器以适配网站改版
- 配置文件中的URL变更需同步更新代码中的解析逻辑
- 订阅链接需要启用GitHub Pages功能
=======
# sport_schedule
用来订阅体育赛事的
>>>>>>> 80550a40c14f8097cb0ac6f0d0f0a98ff08511df
