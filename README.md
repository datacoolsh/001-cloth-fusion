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

## 视频介绍

> 演示视频展示了完整的虚拟试衣流程：上传人物照片 → AI 去除背景 → 选择服装 → 生成试穿效果。

- **演示视频**（Bilibili）：https://www.bilibili.com/video/BV1datacool001
- **项目主页**（GitHub）：https://github.com/datacool/lab-datacool-projects/tree/main/001-cloth-fusion

> 如视频链接暂未上线，可参考下方用户手册按步骤本地运行体验。

---

## 用户手册

### 第一步：注册并充值 Replicate 平台

本项目的 AI 试穿功能由 **Replicate**（https://replicate.com）提供，该平台按调用次数计费。
**必须先充值，API Key 才能正常调用付费模型。**

1. 访问 https://replicate.com，注册账号（支持 GitHub 一键登录）
2. 登录后点击右上角头像 → **Billing**（账单）
3. 选择 **Add credits**（添加积分），填写金额并完成支付（支持信用卡 / PayPal）
   - 建议初次充值 **$5 美元**，足够试用数十次 IDM-VTON 模型
4. 充值完成后，进入 https://replicate.com/account/api-tokens
5. 点击 **Create token**，为 Token 命名后复制生成的 Key（格式：`r8_xxxxxxxxxxxx`）

> **注意**：免费额度耗尽后，未充值的账号调用付费模型会返回 402 错误。请确保账户余额充足。

---

### 第二步：配置 API Key

在项目根目录下配置环境变量文件：

```bash
# 复制模板
cp .env.example .env
```

用文本编辑器打开 `.env`，将 Replicate API Token 填入：

```env
REPLICATE_API_TOKEN=r8_你的Token粘贴到这里
```

保存文件。`.env` 文件已被 `.gitignore` 排除，不会被提交到 Git 仓库。

---

### 第三步：安装依赖并启动

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8010
```

打开浏览器访问 http://localhost:8010

---

### 第四步：使用流程

| 步骤 | 操作说明 |
|------|----------|
| **① 上传人物照** | 点击上传区域，选择一张清晰的全身正面照片（支持 JPG / PNG） |
| **② AI 去背景** | 系统自动调用本地 rembg 模型抠除背景，无需 API 额度 |
| **③ 选择服装** | 从内置 8 件服装样本中选择上装或下装 |
| **④ 生成试穿** | 点击「开始试穿」，系统调用 Replicate IDM-VTON 模型生成效果图（约 30–60 秒） |
| **⑤ 链式试穿** | 可将试穿结果作为人物图，继续选择另一件服装进行叠加试穿 |

---

### 常见问题

**Q：调用试穿时提示 "Payment Required" 或 402 错误？**
> A：Replicate 账户余额不足，请登录 https://replicate.com → Billing → Add credits 充值后重试。

**Q：去背景速度很慢？**
> A：首次运行时 rembg 会自动下载 U²-Net 模型文件（约 170 MB），下载完成后后续调用会很快。

**Q：试穿效果图模糊或不自然？**
> A：建议使用光线均匀、正面站姿、背景简单的全身照，效果更佳。

---

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `REPLICATE_API_TOKEN` | 是 | Replicate 账户 API Token，从 https://replicate.com/account/api-tokens 获取；**需先充值才能调用付费模型** |
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
