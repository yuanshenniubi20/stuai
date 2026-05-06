# STUAI 拓灵AI智能刷课

全自动刷课工具，支持拓灵AI平台(tuolingai.seentao.com)的文档/视频/测验/作业任务的自动完成。

## 目录结构

```
stuai-release/
├── stuai.user.js                  # Tampermonkey 油猴脚本（核心）
├── ocs_ai_answerer_advanced.py    # AI 答题服务（Flask后端）
├── custom_models.json             # 自定义模型配置（可选）
├── env.template                   # 环境变量模板
├── requirements.txt               # Python 依赖
└── README.md                      # 本文档
```

## 新用户安装步骤

### 第一步：安装浏览器插件

在你的浏览器中安装 **Tampermonkey**（油猴）扩展：

- **Chrome**: https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo
- **Edge**: https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd
- **Firefox**: https://addons.mozilla.org/firefox/addon/tampermonkey/

### 第二步：安装刷课脚本

1. 打开 Tampermonkey 图标 → 点击 **"管理面板"**
2. 在管理面板中点击 **"+"** 新建脚本
3. 用记事本打开 `stuai.user.js`，**全选复制**
4. 粘贴到 Tampermonkey 编辑器，点击 **文件 → 保存**

### 第三步：安装 Python（如未安装）

访问 https://www.python.org/downloads/ 下载安装 Python 3.10+。

安装时**勾选 "Add Python to PATH"**。

### 第四步：安装 AI 服务依赖

打开**命令提示符或 PowerShell**，进入本目录：

```powershell
cd stuai-release 的路径
pip install -r requirements.txt
```

### 第五步：申请 AI API 密钥

注册 DeepSeek 账号并获取 API 密钥：

1. 打开 https://platform.deepseek.com/api_keys
2. 注册/登录账号
3. 点击 **"创建 API Key"**，复制生成的密钥（格式为 `sk-xxxxxxxx`）
4. 新用户通常有免费额度

### 第六步：配置 API 密钥

将 `env.template` 复制一份，重命名为 `.env`：

```powershell
copy env.template .env
```

用记事本打开 `.env` 文件，填写你的 API 密钥：

```ini
DEEPSEEK_API_KEY=sk-你的密钥粘贴在这里
```

其他配置保持默认即可。

### 第七步：启动 AI 服务

```powershell
python ocs_ai_answerer_advanced.py
```

看到 `Running on http://0.0.0.0:5000` 表示启动成功。**不要关闭这个窗口**，让它一直在后台运行。

### 第八步：开始使用

1. 打开浏览器，访问 https://tuolingai.seentao.com 并登录
2. 页面右下角会出现 **"拓灵AI刷课"** 面板
3. 状态显示 **"AI已连接"**（绿色）表示 AI 服务正常
4. 点击 **"开始自动刷课"** 启动全自动模式

---

## 面板功能说明

| 按钮 | 功能 |
|------|------|
| **AI答题当前页** | 对当前页面的测验题目进行 AI 作答（手动触发） |
| **开始/停止自动刷课** | 全自动模式：导航→答题→视频→文档→下一个任务 |
| **开始/停止视频托管** | 仅播放长视频（2倍速+自动续播），不执行任务 |
| **检测AI服务** | 检测 AI 后端是否在线 |
| **重置进度记录** | 清除已完成的课程/项目记忆 |

### 自动刷课工作流程

1. 从学生工作台 → 进入课程列表
2. 选择未完成的课程 → 展开所有章节
3. 跳过已完成项目、仅剩作业的项目
4. 进入未完成项目 → 自动处理：
   - **文档**：自动点击"完成学习"
   - **视频**：2倍速播放，自动续播弹窗，进度100%后提交
   - **测验**：AI答题（单选/多选/判断），自动提交
   - **作业**：自动跳过
5. 当前项目完成 → 下一个项目 → 当前课程完成 → 下一个课程

### 视频托管模式

- 仅播放视频，**不**自动导航、**不**完成任务
- 2倍速播放 + 自动续播弹窗
- 适合需要长时间观看视频的场景

---

## 面板内置配置

- **AI接口地址**：默认 `http://localhost:5000/api/answer`，如果 AI 服务在另一台电脑运行，改为 `http://那台电脑的IP:5000/api/answer`
- **视频2倍速**：勾选后视频自动2倍速

---

## 常见问题

| 问题 | 解决方法 |
|------|---------|
| 显示"AI未连接" | 检查 Python 窗口是否运行，端口5000是否被占用 |
| 脚本反复进入同一项目 | 点"停止自动刷课" → "重置进度记录" → 重新开始 |
| 多选题无法选择 | 确保安装最新版脚本 |
| AI答题不准确 | 降低 `.env` 中 `TEMPERATURE` 值（如 0.0） |
| 视频播放后不提交 | 服务器可能要求完整观看时长，无法纯靠进度判断 |
| 课程列表页卡住不动 | 停止→重置→重新开始 |

## 后台运行（可选）

让 AI 服务在关闭终端后继续运行：

```powershell
# Windows PowerShell 后台运行
Start-Process python -ArgumentList "ocs_ai_answerer_advanced.py" -WindowStyle Hidden
```
