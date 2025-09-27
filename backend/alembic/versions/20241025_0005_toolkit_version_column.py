"""Add version column to toolkits

Revision ID: 20241025_0005
Revises: 20241020_0004
Create Date: 2024-10-25 00:05:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20241025_0005"
down_revision = "20241020_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("toolkits", sa.Column("version", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("toolkits", "version")
