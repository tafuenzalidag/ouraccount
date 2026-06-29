"""add timestamps to all tables

Revision ID: 001
Revises: 8ee2450d93bd
Create Date: 2026-06-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = "8ee2450d93bd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = [
    "users", "households", "household_members", "categories",
    "payment_methods", "merchant_rules", "import_batches",
    "installment_plans", "transactions", "split_allocations", "settlements",
]


def upgrade() -> None:
    for table in TABLES:
        op.add_column(table, sa.Column("created_at", sa.DateTime(timezone=True),
                      server_default=sa.func.now(), nullable=False))
        op.add_column(table, sa.Column("updated_at", sa.DateTime(timezone=True),
                      server_default=sa.func.now(), nullable=False))
        op.add_column(table, sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    for table in TABLES:
        op.drop_column(table, "created_at")
        op.drop_column(table, "updated_at")
        op.drop_column(table, "deleted_at")
