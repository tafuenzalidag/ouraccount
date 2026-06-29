"""create dismissed_duplicate_pairs table"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"


def upgrade():
    op.create_table(
        "dismissed_duplicate_pairs",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("household_id", sa.Integer, sa.ForeignKey("households.id"), nullable=False),
        sa.Column("tx_id_a", sa.Integer, sa.ForeignKey("transactions.id"), nullable=False),
        sa.Column("tx_id_b", sa.Integer, sa.ForeignKey("transactions.id"), nullable=False),
        sa.Column("dismissed_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("tx_id_a", "tx_id_b"),
    )


def downgrade():
    op.drop_table("dismissed_duplicate_pairs")
