# STUAI 拓灵AI智能刷课

> ⚠️ **免责声明**  
> 本项目仅供个人学习与自动化技术研究使用，**禁止用于其他用途**。  
> 作者不保证程序稳定性、完整性或可用性，且**不提供任何形式的技术支持、售后或定制服务**。  
>  
> **法律合规提醒**  
> - 根据《生成式人工智能服务管理暂行办法》，请勿向中国地区公众提供未备案的生成式人工智能服务  
> - 用户使用本项目所产生的一切后果（包括但不限于账号封禁、课程成绩作废、学业处分、法律责任）均由用户本人独立承担，作者与贡献者不承担任何连带责任  
> - 本工具对 AI 生成内容的准确性、合法性、适用性不作任何明示或默示保证，所有答题结果仅供参考  
> - 本工具不绕过、不破解、不修改目标网站的任何安全机制或付费逻辑  
>  
> **数据与隐私**  
> - 所有组件均在用户本地计算机运行，不上传、不收集、不存储任何用户个人信息  
> - 脚本通过 Tampermonkey 的 `GM_setValue` 在用户浏览器本地存储刷课进度，可随时清空  
> - 唯一的网络请求为 AI 答题时调用用户自行配置的 DeepSeek/豆包 API 接口  
>  
> **开源声明**  
> - 本项目以 GNU General Public License v3.0 发布，允许自由使用、修改、Fork、分发  
> - 本项目 **永久非商业化、不收费、不盈利**，不接受捐赠，不提供付费服务  
> - 如需引用或二次开发请标注原作者仓库 [ocs-ai](https://github.com/xiaojiuwo233/ocs-ai)  
>  
> 由于测试样本有限（单一课程结构，少量账号），仅能保证在样本上稳定运行，程序可能无法适配不同的平台定制版本。  
> 遇到问题请在 [GitHub Issue](https://github.com/xiaojiuwo233/ocs-ai/issues) 提交，**附上完整的控制台（f12）日志**，否则无法处理。

---

## 项目功能

1.提供一键托管完成处作业外所有任务的自动学习和完成

2.单独的依赖于ai智能回答的随堂测验任务学习

3.单独的自动维持视频播放便于学习的功能

## 下载地址[Release](https://github.com/yuanshenniubi20/stuai/releases/tag/v3.9)


## 目录结构

```
stuai-release/
├── stuai.user.js                  # Tampermonkey 油猴脚本（核心自动化逻辑）
├── ocs_ai_answerer_advanced.py    # AI 答题服务（基于 Flask 的本地HTTP服务）
├── custom_models.json             # 自定义模型配置（可选组件）
├── env.template                   # 环境变量模板（复制为 .env 后填入API密钥）
├── requirements.txt               # Python 依赖清单
└── README.md                      # 项目说明文档
```

---

## 系统要求

| 组件 | 最低版本 |
|------|---------|
| Windows / macOS / Linux | 任意 |
| Tampermonkey | v4.0+ |
| Chrome / Edge / Firefox | 最新稳定版 |
| Python | 3.10+ |
| DeepSeek 账号 | 已注册并获取 API Key |

---

## 推荐 API 提供商

| 提供商 | 说明 |
|--------|------|
| **[DeepSeek](https://platform.deepseek.com)** | 推荐使用，测试稳定，中文答题准确率高，成本低 |
| [豆包](https://console.volcengine.com/ark) | 支持多模态（图片题目），需额外配置 |

> DeepSeek API 为**按量付费服务**（约 ¥1/百万 token）。  
> 本项目不提供 API 密钥，请自行前往 DeepSeek 开放平台注册获取。
> 参考参考项目，可自行配置其它api

---

## 安装步骤（请善用ai工具）

### 一、安装 Tampermonkey

- Chrome: https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo
- Edge: https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd
- Firefox: https://addons.mozilla.org/firefox/addon/tampermonkey/

### 二、安装刷课脚本

1. Tampermonkey 图标 → 管理面板 → 点击 **"+"** 新建
2. 用记事本打开 `stuai.user.js`，全选 → 粘贴到编辑器
3. 文件 → 保存

### 三、安装 Python 依赖

```powershell
cd stuai-release
pip install -r requirements.txt
```

### 四、获取 DeepSeek API Key

打开 https://platform.deepseek.com/api_keys → 注册 → 创建 API Key → 复制 `sk-` 开头的密钥。

### 五、配置并启动 AI 服务

```powershell
copy env.template .env          # 复制配置模板
notepad .env                    # 编辑：填入 DEEPSEEK_API_KEY=sk-你的密钥
python ocs_ai_answerer_advanced.py
```

看到 `Running on http://0.0.0.0:5000` 即成功。

### 六、开始使用

访问 https://tuolingai.seentao.com 登录 → 右下角出现面板 → 状态变绿 "AI已连接" → 点击按钮使用。

---

## 功能说明

### 面板一览

| 按钮 | 作用 |
|------|------|
| `AI答题当前页` | 手动触发当前页面的测验AI作答（支持单选/多选/判断） |
| `开始/停止自动刷课` | 全自动模式：课程导航 → 任务识别 → 答题/视频/文档 → 切换任务 |
| `开始/停止视频托管` | 仅长视频播放（2倍速+自动续播弹窗），不执行导航和任务 |
| `检测AI服务` | 测试 AI 后端连通性 |
| `重置进度记录` | 清除本地存储的所有课程/项目完成记录 |

### 自动刷课逻辑

```
Dashboard → 课程列表 → 进入课程 → 展开章节
    ↓
遍历所有项目卡片
    ├── 任务完成度满 → 跳过
    ├── 仅剩作业 → 跳过并记录
    └── 有未完成非作业任务 → 进入
         ↓
    进入项目 → 遍历任务卡片
         ├── 已完成 → 跳过
         ├── 作业 → 跳过
         ├── 文档 → 点击"完成学习"
         ├── 视频 → 2倍速播放+弹窗续播→进度100%→点击完成任务
         └── 测验 → AI作答→提交
              ↓
         返回项目页 → 下一个任务 → 项目完成 → 下一个项目
              ↓
         课程完成 → 返回课程列表 → 下一个课程
```

### 视频托管模式

独立于自动刷课的纯视频播放模式：
- 2倍速加速
- 自动处理"继续学习"弹窗（3分钟不活动提醒）
- 不导航、不点击完成任务、不记录进度
- 与自动刷课互斥

---

## 已知限制

1. **视频完成判定**：部分课程服务器校验实际观看时长，纯进度100%不足以触发完成，需自然等待视频播完
2. **页面结构差异**：不同院校的平台可能有定制 DOM 结构，脚本可能无法完全适配
3. **验证码登录**：OCR 识别不稳定，建议首次手动登录并勾选"记住密码"
4. **并发限制**：脚本设计为单标签页运行，请勿在同一浏览器多开
5. **网络要求**：AI 答题需要畅通的 DeepSeek API 连接，如遇网络问题答题会跳过

---

## 常见问题

| 现象 | 原因 | 操作 |
|------|------|------|
| 状态显示"AI未连接" | Python 服务未启动或端口冲突 | 检查终端、换端口 |
| 反复进入同一项目 | 历史记录key匹配失败 | 点"重置进度记录"→重启自动刷课 |
| 多选题不选中 | 旧版脚本的checkbox双重点击bug | 更新到最新版脚本 |
| AI答题不准确 | Temperature过高或API异常 | `.env`中`TEMPERATURE=0` 降低随机性 |
| 课程列表页卡住 | DOM选择器未命中课程卡片 | 点"重置"→重跑，如仍卡住提Issue |
| 登录页反复跳转 | Cookie/Token过期 | 手动重新登录 |

提交 Issue 时请附上：**操作步骤、控制台完整日志（F12→Console→截图）、页面URL**。

---

## 技术架构

```
浏览器                                    本地终端
┌─────────────────────┐    HTTP POST    ┌──────────────────┐
│  Tampermonkey 脚本  │ ──────────────→ │  Flask AI 服务   │
│  (stuai.user.js)    │ ←────────────── │  :5000/api/answer│
│                     │   JSON 答案      └────────┬─────────┘
│  - DOM操作          │                          │ OpenAI SDK
│  - 页面导航         │                   ┌──────┴─────────┐
│  - 视频控制         │                   │  DeepSeek API  │
│  - GM_setValue存储  │                   │  api.deepseek  │
└─────────────────────┘                   └────────────────┘
```

---

## 相关项目

AI 答题服务基于 [ocs-ai](https://github.com/xiaojiuwo233/ocs-ai)

---

## 联系方式： gptfree20261230@outlook.com

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| v3.9 | 2026-05 | 视频托管独立模式、UI精简、项目记忆基于body text+sessionStorage |
| v3.8 | 2026-05 | 修复课程级ID重复、courselist卡片容器选择器 |
| v3.7 | 2026-05 | SPA同URL页面类型识别、sessionStorage提取项目/课程ID |
| v3.5 | 2026-05 | makeVisitedKey/双向包含匹配、beforeunload持久化 |
| v3.3 | 2026-05 | 初始稳定版，完成视频/文档/测验/作业（跳过）四大任务类型 |

---

## 许可证

[GNU General Public License v3.0](LICENSE)


