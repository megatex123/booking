import uuid
import os
import aiofiles
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from middleware.auth import get_current_user

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
MAX_SIZE = 100 * 1024 * 1024  # 100 MB

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "video/mp4", "video/quicktime", "video/webm", "video/x-msvideo",
}

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/")
async def upload_file(file: UploadFile = File(...), user=Depends(get_current_user)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"File type {file.content_type} not allowed")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 100 MB)")

    ext = os.path.splitext(file.filename or "")[1] or ".bin"
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)

    async with aiofiles.open(path, "wb") as f:
        await f.write(content)

    return {"url": f"/uploads/{filename}", "filename": filename, "content_type": file.content_type}
