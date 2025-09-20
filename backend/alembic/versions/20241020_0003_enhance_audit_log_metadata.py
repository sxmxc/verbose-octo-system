"""Enhance audit log metadata

Revision ID: 20241020_0003
Revises: 20241013_0002
Create Date: 2024-10-20 00:03:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20241020_0003"
down_revision = "20241013_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "audit_logs",
        sa.Column("severity", sa.String(length=32), nullable=False, server_default="info"),
    )
    op.add_column("audit_logs", sa.Column("source_ip", sa.String(length=64), nullable=True))
    op.add_column("audit_logs", sa.Column("user_agent", sa.String(length=255), nullable=True))
    op.add_column("audit_logs", sa.Column("target_type", sa.String(length=128), nullable=True))
    op.add_column("audit_logs", sa.Column("target_id", sa.String(length=128), nullable=True))
    op.create_index("ix_audit_logs_event", "audit_logs", ["event"])
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.alter_column("audit_logs", "severity", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_event", table_name="audit_logs")
    op.drop_column("audit_logs", "target_id")
    op.drop_column("audit_logs", "target_type")
    op.drop_column("audit_logs", "user_agent")
    op.drop_column("audit_logs", "source_ip")
    op.drop_column("audit_logs", "severity")
