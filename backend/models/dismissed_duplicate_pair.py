from datetime import datetime
from sqlalchemy import Integer, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class DismissedDuplicatePair(Base):
    __tablename__ = "dismissed_duplicate_pairs"
    __table_args__ = (UniqueConstraint("tx_id_a", "tx_id_b"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(Integer, ForeignKey("households.id"), nullable=False)
    tx_id_a: Mapped[int] = mapped_column(Integer, ForeignKey("transactions.id"), nullable=False)
    tx_id_b: Mapped[int] = mapped_column(Integer, ForeignKey("transactions.id"), nullable=False)
    dismissed_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
