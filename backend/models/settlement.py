import uuid
from datetime import date
from sqlalchemy import String, BigInteger, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class Settlement(Base):
    __tablename__ = "settlements"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    periodo_desde: Mapped[date] = mapped_column(Date, nullable=False)
    periodo_hasta: Mapped[date] = mapped_column(Date, nullable=False)
    deudor_user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    acreedor_user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    monto: Mapped[int] = mapped_column(BigInteger, nullable=False)
    estado: Mapped[str] = mapped_column(String, default="pendiente")  # pendiente | pagado
    pagado_en: Mapped[date | None] = mapped_column(Date, nullable=True)
