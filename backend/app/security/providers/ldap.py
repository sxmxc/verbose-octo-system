from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional

from fastapi import HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from ldap3 import (  # type: ignore[import]
    ALL,
    AUTO_BIND_NO_TLS,
    SUBTREE,
    Connection,
    Server,
)
from ldap3.core.exceptions import LDAPBindError
from sqlalchemy.ext.asyncio import AsyncSession

from ...config import ActiveDirectoryAuthProvider as AdConfig
from ...config import LdapAuthProvider as LdapConfig
from .base import AuthProvider, AuthResult


def _entry_value(entry: Any, attr: str) -> Optional[Any]:
    if attr not in entry:
        return None
    value = entry[attr].value
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="ignore")
    return value


class _LdapBase(AuthProvider):
    def __init__(self, config: LdapConfig) -> None:
        super().__init__(config)
        self.config = config
    config_model = LdapConfig

    async def begin(self, request: Request) -> Dict[str, Any]:
        return {"type": "form"}

    def _make_server(self) -> Server:
        return Server(self.config.server_uri, get_info=ALL)

    def _bind_connection(self, server: Server, user: Optional[str], password: Optional[str]) -> Connection:
        try:
            conn = Connection(
                server,
                user=user,
                password=password.get_secret_value() if password else password,
                auto_bind=AUTO_BIND_NO_TLS,
                read_only=True,
            )
            if self.config.start_tls:
                conn.start_tls(read_server_info=True)
            if not conn.bind():
                raise LDAPBindError("Failed to bind to LDAP server")
            return conn
        except LDAPBindError as exc:  # pragma: no cover - connection errors
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="LDAP bind failed") from exc

    def _service_connection(self, server: Server) -> Connection:
        bind_dn = self.config.bind_dn
        bind_password = self.config.bind_password
        if not bind_dn:
            return Connection(server, auto_bind=True, read_only=True)
        return self._bind_connection(server, bind_dn, bind_password)

    def _find_entry(self, conn: Connection, username: str) -> Any:
        if self.config.user_dn_template:
            user_dn = self.config.user_dn_template.format(username=username)
            if not conn.search(user_dn, "(objectClass=*)", attributes=["*"]):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LDAP user not found")
            return conn.entries[0]
        search_base = self.config.user_search_base or ""
        search_filter_template = self.config.user_filter or "(uid={username})"
        search_filter = search_filter_template.format(username=username)
        if not conn.search(search_base, search_filter, search_scope=SUBTREE, attributes=["*"]):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LDAP user not found")
        return conn.entries[0]

    def _authenticate(self, server: Server, user_dn: str, password: str) -> None:
        try:
            with Connection(server, user=user_dn, password=password, auto_bind=True):
                return
        except LDAPBindError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid LDAP credentials") from exc

    def _collect_groups(self, conn: Connection, entry: Any) -> List[str]:
        groups: List[str] = []
        member_attr = self.config.group_member_attr
        values = _entry_value(entry, member_attr)
        if values:
            if isinstance(values, list):
                groups.extend(str(val) for val in values)
            else:
                groups.append(str(values))
        if self.config.group_search_base and self.config.group_filter:
            user_dn = entry.entry_dn
            filter_value = self.config.group_filter.format(user_dn=user_dn, username=_entry_value(entry, self.config.attributes.get("username", "uid")) or "")
            if conn.search(self.config.group_search_base, filter_value, search_scope=SUBTREE, attributes=["cn"]):
                for result in conn.entries:
                    groups.append(str(result.entry_dn))
        return groups

    def _map_roles(self, groups: Iterable[str]) -> List[str]:
        mapped: set[str] = set(self.default_roles)
        for group in groups:
            if group in self.config.role_mappings:
                mapped.update(self.config.role_mappings[group])
        return sorted(mapped)

    def _auth_flow(self, username: str, password: str) -> Dict[str, Any]:
        server = self._make_server()
        conn = self._service_connection(server)
        try:
            entry = self._find_entry(conn, username)
            user_dn = entry.entry_dn
            attributes = {
                key: _entry_value(entry, attr)
                for key, attr in self.config.attributes.items()
            }
            self._authenticate(server, user_dn, password)
            groups = self._collect_groups(conn, entry)
            return {
                "user_dn": user_dn,
                "attributes": attributes,
                "groups": groups,
            }
        finally:
            conn.unbind()

    async def complete(self, request: Request, session: AsyncSession) -> AuthResult:
        data = await request.json()
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""
        if not username or not password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing credentials")

        result = await run_in_threadpool(self._auth_flow, username, password)
        attributes = result["attributes"]
        display_name = attributes.get("display_name") or username
        roles = self._map_roles(result["groups"])
        return AuthResult(
            user_external_id=result["user_dn"],
            username=attributes.get("username") or username,
            email=attributes.get("email"),
            display_name=display_name,
            provider_name=self.name,
            attributes={"groups": result["groups"], "dn": result["user_dn"]},
            roles=roles,
        )



class LdapAuthProvider(_LdapBase):
    config: LdapConfig


class ActiveDirectoryAuthProvider(_LdapBase):
    config: AdConfig
    config_model = AdConfig

    def _default_domain_username(self, username: str) -> str:
        if self.config.default_domain and "@" not in username:
            return f"{username}@{self.config.default_domain}"
        return username

    def _authenticate(self, server: Server, user_dn: str, password: str) -> None:
        # Active Directory often requires UPN instead of DN
        upn_user = self._default_domain_username(user_dn)
        try:
            with Connection(server, user=upn_user, password=password, auto_bind=True):
                return
        except LDAPBindError:
            super()._authenticate(server, user_dn, password)
