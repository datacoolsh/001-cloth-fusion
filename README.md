# 001-cloth-fusion — 虚拟试衣间 Demo

基于 AI 背景去除 + IDM-VTON 扩散模型的虚拟试衣展示系统。

## 功能流程

```
上传全身照 → rembg AI 去除背景 → 选择服装搭配 → IDM-VTON 生成照片级试穿效果
```

- **AI 背景去除**：rembg（U²-Net）模型，本地推理
- **AI 试穿**：IDM-VTON via Replicate，照片级扩散模型生成
- **8 件服装样本**：来自 VITON-HD 数据集的真实服装照片
- **支持链式试穿**：先合成上装，再将结果作为人物图输入合成下装

## 启动

```bash
# 1. 复制并填写环境变量
cp .env.example .env
# 编辑 .env，填入 REPLICATE_API_TOKEN

# 2. 安装依赖并启动
uv sync
uv run uvicorn app.main:app --reload --port 8010
```

打开浏览器访问 http://localhost:8010

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `REPLICATE_API_TOKEN` | 是 | Replicate 账户 API Token，从 https://replicate.com/account/api-tokens 获取 |
| `IDMVTON_VERSION` | 否 | IDM-VTON 模型 version hash，默认使用内置稳定版本 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.12 + FastAPI |
| AI 背景去除 | rembg（U²-Net），本地推理 |
| AI 试穿 | IDM-VTON（Replicate API） |
| 前端 | 原生 HTML5 / CSS3 / JavaScript |
| 依赖管理 | uv |

## 项目结构

```
001-cloth-fusion/
├── app/
│   ├── main.py              # FastAPI 应用入口，加载 .env
│   └── routers/
│       ├── image.py         # /api/remove-bg、/api/clothes 接口
│       └── tryon.py         # /api/tryon 接口（IDM-VTON via Replicate）
├── static/
│   ├── index.html           # 4 步骤单页应用
│   ├── css/style.css        # 深色时尚主题样式
│   ├── js/app.js            # 步骤流程 + AI 试穿逻辑
│   └── clothes/             # 8 件 VITON-HD 服装照片
├── .env.example             # 环境变量模板
└── pyproject.toml
```
