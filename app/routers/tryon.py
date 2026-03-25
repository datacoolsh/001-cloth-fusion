"""
虚拟试穿 AI 接口 — 调用 Replicate IDM-VTON 模型

IDM-VTON 论文：https://arxiv.org/abs/2403.05139
Replicate 模型页：https://replicate.com/cuuupid/idm-vton

流程：
  1. POST /api/tryon  → 创建 Replicate prediction
  2. 轮询 prediction 状态（最多 120s）
  3. 下载结果图 → 返回 base64

环境变量：
  REPLICATE_API_TOKEN  必填，Replicate 账户 API Token
  IDMVTON_VERSION      可选，默认使用最新稳定 version hash
"""
import asyncio
import base64
import os

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["tryon"])

# IDM-VTON 模型 version（可在 replicate.com/cuuupid/idm-vton 查到最新值）
_DEFAULT_VERSION = "906425dbca90663ff5427624839572cc56ea7d380343d13e2a4c4b09d3f0c30f"
IDMVTON_VERSION = os.getenv("IDMVTON_VERSION", _DEFAULT_VERSION)

POLL_INTERVAL = 3      # 秒
POLL_MAX      = 40     # 最多轮询次数（40 × 3s = 120s）

class TryOnRequest(BaseModel):
    person_b64:   str                    # rembg 处理后的透明 PNG base64
    garment_b64:  str                    # 服装平铺图 base64（JPG/PNG，建议白底）
    garment_desc: str  = "casual clothing"
    category:     str  = "upper_body"    # upper_body | lower_body | dresses


@router.get("/tryon/config")
async def tryon_config():
    """前端用于检查 AI 试穿是否已配置"""
    return {"configured": bool(os.getenv("REPLICATE_API_TOKEN"))}


@router.post("/tryon")
async def virtual_tryon(req: TryOnRequest):
    """
    调用 IDM-VTON 生成试穿效果图。

    参数：
        person_b64   - 用户去背景后的全身照 (base64 PNG)
        garment_b64  - 服装平铺图 (base64，建议白底)
        garment_desc - 服装文字描述，帮助模型理解面料/款式
        category     - upper_body / lower_body / dresses

    返回：
        {"success": true, "image": "<base64 PNG>"}
    """
    token = os.getenv("REPLICATE_API_TOKEN", "")
    print("Replicate API Token:", token)
    if not token:
        raise HTTPException(
            status_code=400,
            detail="未配置 REPLICATE_API_TOKEN，请在 .env 文件中设置后重启服务",
        )

    auth = {"Authorization": f"Token {token}"}

    async with httpx.AsyncClient(timeout=180.0) as client:

        # ── Step 1: 创建预测任务 ─────────────────────────────
        create = await client.post(
            "https://api.replicate.com/v1/predictions",
            headers={**auth, "Content-Type": "application/json"},
            json={
                "version": IDMVTON_VERSION,
                "input": {
                    "human_img":       f"data:image/png;base64,{req.person_b64}",
                    "garm_img":        f"data:image/png;base64,{req.garment_b64}",
                    "garment_des":     req.garment_desc,
                    "category":        req.category,
                    "is_checked":      True,
                    "is_checked_crop": False,
                    "denoise_steps":   30,
                    "seed":            42,
                },
            },
        )

        if create.status_code not in (200, 201):
            raise HTTPException(
                status_code=502,
                detail=f"Replicate API 返回错误 {create.status_code}: {create.text[:300]}",
            )

        pred = create.json()
        pred_id = pred["id"]

        # ── Step 2: 轮询结果 ─────────────────────────────────
        for attempt in range(POLL_MAX):
            await asyncio.sleep(POLL_INTERVAL)

            poll = await client.get(
                f"https://api.replicate.com/v1/predictions/{pred_id}",
                headers=auth,
            )
            data = poll.json()
            status = data.get("status")

            if status == "succeeded":
                output = data.get("output")
                if not output:
                    raise HTTPException(500, "AI 返回结果为空")

                result_url = output[0] if isinstance(output, list) else output

                # ── Step 3: 下载结果图 ───────────────────────
                img_resp = await client.get(result_url, timeout=60.0)
                b64 = base64.b64encode(img_resp.content).decode()
                return {"success": True, "image": b64}

            if status in ("failed", "canceled"):
                err = data.get("error") or data.get("logs") or "未知原因"
                raise HTTPException(500, f"AI 生成失败（{status}）：{err}")

            # 仍在处理中，继续等待

        raise HTTPException(504, f"AI 处理超时（>{POLL_MAX * POLL_INTERVAL}s），请稍后重试")
