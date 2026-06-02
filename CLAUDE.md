# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

线上占卜工具。技术栈：Flask + SQLite + Flask-SocketIO。公开免费使用。

## 开发命令

```bash
# 环境搭建
python3 -m venv venv
venv/bin/pip install -r requirements.txt

# 启动开发服务器（端口 9529）
venv/bin/python run.py

# 代码检查（如已安装 ruff）
venv/bin/ruff check --fix app/
venv/bin/ruff format app/
```

## 架构

### 前端页面

- `/` — 原始静态占卜页面（`index.html`），纯日语，用户直接操作
- `/d/<path_token>` — 工作区占卜页面，支持后台远程控制，基于 `index.html` 派生
- `/manager` — 管理后台 SPA，支持日语/简体中文

### 后端

- Flask + SQLAlchemy (SQLite) + Flask-SocketIO (gevent)
- `app/` 包含所有后端代码
- `app/routes/api.py` — REST API（工作区CRUD、占卜发起、记录查询）
- `app/routes/manager.py` — 管理后台页面路由
- `app/routes/workspace.py` — 工作区占卜页面路由
- `app/socket_events.py` — Socket.IO 事件处理（实时推送占卜指令）
- `app/divination.py` — 占卜判词/消息的 Python 移植
- `app/models.py` — Workspace 和 DivinationRecord 数据模型

### 数据库

SQLite，存放在 `instance/uranai.db`，两张表：
- `workspaces` — 工作区（access_code, path_token, alias）
- `divination_records` — 占卜记录（mode, names, score, verdict, message 等）

### 关键约束

- **不修改** `index.html`、`script.js`、`zodiac.js`、`style.css` — 原始占卜页面保持不变
- `workspace-client.js` 是叠加层，通过全局函数与 `script.js` 交互
- `build.sh` 管理静态资源的内容哈希版本号
- access_code 永远不会暴露给占卜页面，只有 path_token 出现在 URL 中

## 配置

复制 `.env.example` 到 `.env`。关键变量：
- `PORT` — 开发服务器端口（默认：9529）
- `SECRET_KEY` — Flask session 签名密钥
