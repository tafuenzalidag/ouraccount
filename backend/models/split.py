import uuid
from sqlalchemy import String, BigInteger, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class SplitAllocation(Base):
    __tablename__ = "split_allocations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id: Mapped[str] = mapped_column(String, ForeignKey("transactions.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    ratio: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    monto_asignado: Mapped[int] = mapped_column(BigInteger, nullable=False)
