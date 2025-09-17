import httpx
from typing import Any, Dict

class ZbxClient:
    def __init__(self, base_url: str, token: str):
        if base_url.endswith("/"):
            base_url = base_url[:-1]
        self._url = f"{base_url}/api_jsonrpc.php"
        self._token = token
        self._id = 0

    async def call(self, method: str, params: Dict[str, Any]) -> Any:
        self._id += 1
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "auth": self._token,
            "id": self._id,
        }
        async with httpx.AsyncClient(timeout=30) as s:
            r = await s.post(self._url, json=payload)
            r.raise_for_status()
            data = r.json()
        if "error" in data:
            err = data["error"]
            raise RuntimeError(f"Zabbix error {err.get('code')}: {err.get('message')} - {err.get('data')}")
        return data.get("result")
