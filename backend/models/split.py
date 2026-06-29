from datetime import datetime
from sqlalchemy import Integer, BigInteger, DateTime, Numeric, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class SplitAllocation(Base):
    __tablename__ = "split_allocations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transaction_id: Mapped[int] = mapped_column(Integer, ForeignKey("transactions.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    ratio: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    monto_asignado: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
