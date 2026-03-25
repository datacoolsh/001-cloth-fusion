import io
import base64
import os
from pathlib import Path

from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image

router = APIRouter(prefix="/api", tags=["image"])

CLOTHES_DIR = Path(__file__).parent.parent.parent / "static" / "clothes"

SAMPLE_CLOTHES = [
    # 上装 — 来自 IDM-VTON / VITON-HD 示例数据集
    {"id": "top_01", "name": "格纹长袖衬衫",  "category": "top", "color": "#c8a89a", "file": "top_01.jpg", "ai_category": "upper_body"},
    {"id": "top_02", "name": "白色短袖上衣",  "category": "top", "color": "#f0eeec", "file": "top_02.jpg", "ai_category": "upper_body"},
    {"id": "top_03", "name": "条纹休闲衬衫",  "category": "top", "color": "#8ea8c8", "file": "top_03.jpg", "ai_category": "upper_body"},
    {"id": "top_04", "name": "黑色基础款上衣","category": "top", "color": "#2a2a2a", "file": "top_04.jpg", "ai_category": "upper_body"},
    {"id": "top_05", "name": "米色休闲上衣",  "category": "top", "color": "#b8a898", "file": "top_05.jpg", "ai_category": "upper_body"},
    {"id": "top_06", "name": "碎花衬衫",      "category": "top", "color": "#d4a8b8", "file": "top_06.jpg", "ai_category": "upper_body"},
    {"id": "top_07", "name": "深色休闲上衣",  "category": "top", "color": "#988878", "file": "top_07.jpg", "ai_category": "upper_body"},
    {"id": "top_08", "name": "浅色阔版上衣",  "category": "top", "color": "#c8c0b0", "file": "top_08.jpg", "ai_category": "upper_body"},
]


@router.post("/remove-bg")
async def remove_background(file: UploadFile = File(...)):
    """接收用户上传的照片，使用 rembg 去除背景，返回透明 PNG 的 base64 编码。"""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="请上传图片文件（JPG/PNG）")

    contents = await file.read()
    if len(contents) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片大小不能超过 15MB")

    try:
        from rembg import remove

        input_image = Image.open(io.BytesIO(contents)).convert("RGBA")

        # 限制最大分辨率，加速处理
        max_size = 1024
        if max(input_image.size) > max_size:
            input_image.thumbnail((max_size, max_size), Image.LANCZOS)

        # 转回 bytes 给 rembg
        buf_in = io.BytesIO()
        input_image.save(buf_in, format="PNG")
        buf_in.seek(0)

        output_bytes = remove(buf_in.read())
        output_image = Image.open(io.BytesIO(output_bytes)).convert("RGBA")

        # 编码为 base64
        buf_out = io.BytesIO()
        output_image.save(buf_out, format="PNG")
        b64 = base64.b64encode(buf_out.getvalue()).decode("utf-8")

        w, h = output_image.size
        return JSONResponse({
            "success": True,
            "image": b64,
            "width": w,
            "height": h,
        })

    except ImportError:
        raise HTTPException(status_code=500, detail="rembg 未安装，请运行 uv sync")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败：{str(e)}")


@router.get("/clothes")
async def get_clothes():
    """返回服装样本列表，包含图片文件的 base64 内容。"""
    items = []
    for item in SAMPLE_CLOTHES:
        img_path = CLOTHES_DIR / item["file"]
        img_b64 = None
        if img_path.exists():
            with open(img_path, "rb") as f:
                img_b64 = base64.b64encode(f.read()).decode("utf-8")

        # 判断 MIME 类型
        suffix = img_path.suffix.lower()
        mime = "image/jpeg" if suffix in (".jpg", ".jpeg") else "image/png"

        items.append({
            **item,
            "img_b64": img_b64,
            "mime": mime,
        })
    return JSONResponse({"items": items})
