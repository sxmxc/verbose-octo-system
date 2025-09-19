"""Add toolkit registry tables for persistence

Revision ID: 20241013_0002
Revises: 20241007_0001
Create Date: 2024-10-13 00:02:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20241013_0002"
down_revision = "20241007_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "toolkits",
        sa.Column("slug", sa.String(length=128), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("base_path", sa.String(length=255), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("category", sa.String(length=64), nullable=False, server_default=sa.text("'toolkit'")),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("origin", sa.String(length=32), nullable=False, server_default=sa.text("'custom'")),
        sa.Column("backend_module", sa.String(length=255), nullable=True),
        sa.Column("backend_router_attr", sa.String(length=128), nullable=True),
        sa.Column("worker_module", sa.String(length=255), nullable=True),
        sa.Column("worker_register_attr", sa.String(length=128), nullable=True),
        sa.Column("dashboard_cards", sa.JSON(), nullable=True),
        sa.Column("dashboard_context_module", sa.String(length=255), nullable=True),
        sa.Column("dashboard_context_attr", sa.String(length=128), nullable=True),
        sa.Column("frontend_entry", sa.String(length=255), nullable=True),
        sa.Column("frontend_source_entry", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "toolkit_removals",
        sa.Column("slug", sa.String(length=128), primary_key=True),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("toolkit_removals")
    op.drop_table("toolkits")
