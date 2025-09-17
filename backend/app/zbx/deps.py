from fastapi import Depends, HTTPException
from ..config import settings
from .client import ZbxClient

def get_zbx_client() -> ZbxClient:
    if not settings.zbx_base_url or not settings.zbx_token:
        raise HTTPException(500, "Zabbix base URL/token not configured")
    return ZbxClient(str(settings.zbx_base_url), settings.zbx_token)
