from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List


@dataclass(frozen=True)
class AuditEventDefinition:
    name: str
    category: str
    description: str
    severity: str = "info"


AUDIT_EVENT_DEFINITIONS: Dict[str, AuditEventDefinition] = {
    "auth.login.success": AuditEventDefinition(
        name="auth.login.success",
        category="authentication",
        description="User authenticated successfully.",
        severity="info",
    ),
    "auth.login.failure": AuditEventDefinition(
        name="auth.login.failure",
        category="authentication",
        description="Failed authentication attempt was rejected.",
        severity="warning",
    ),
    "auth.logout": AuditEventDefinition(
        name="auth.logout",
        category="authentication",
        description="User explicitly signed out of the system.",
        severity="info",
    ),
    "auth.token.refresh": AuditEventDefinition(
        name="auth.token.refresh",
        category="authentication",
        description="Access token refreshed for an active session.",
        severity="info",
    ),
    "user.bootstrap": AuditEventDefinition(
        name="user.bootstrap",
        category="user_management",
        description="System bootstrap created the first privileged administrator.",
        severity="critical",
    ),
    "user.provision": AuditEventDefinition(
        name="user.provision",
        category="user_management",
        description="User account provisioned automatically from an identity provider.",
        severity="info",
    ),
    "user.import": AuditEventDefinition(
        name="user.import",
        category="user_management",
        description="User imported in bulk by an administrator.",
        severity="info",
    ),
    "user.create": AuditEventDefinition(
        name="user.create",
        category="user_management",
        description="Administrator created a local user account.",
        severity="info",
    ),
    "user.update": AuditEventDefinition(
        name="user.update",
        category="user_management",
        description="User profile data was updated.",
        severity="info",
    ),
    "user.roles.update": AuditEventDefinition(
        name="user.roles.update",
        category="privilege_management",
        description="User role assignments were changed.",
        severity="warning",
    ),
    "user.status.update": AuditEventDefinition(
        name="user.status.update",
        category="user_management",
        description="User activation status was toggled.",
        severity="warning",
    ),
    "user.delete": AuditEventDefinition(
        name="user.delete",
        category="user_management",
        description="User account was deleted.",
        severity="warning",
    ),
    "security.provider.update": AuditEventDefinition(
        name="security.provider.update",
        category="configuration",
        description="Authentication provider configuration was added or updated.",
        severity="warning",
    ),
    "security.provider.delete": AuditEventDefinition(
        name="security.provider.delete",
        category="configuration",
        description="Authentication provider configuration was removed.",
        severity="warning",
    ),
}


def get_audit_event(name: str) -> AuditEventDefinition | None:
    return AUDIT_EVENT_DEFINITIONS.get(name)


def list_audit_events(names: Iterable[str] | None = None) -> List[AuditEventDefinition]:
    if names is None:
        return list(AUDIT_EVENT_DEFINITIONS.values())
    return [AUDIT_EVENT_DEFINITIONS[name] for name in names if name in AUDIT_EVENT_DEFINITIONS]
