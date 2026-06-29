from datetime import datetime
from sqlalchemy import String, Integer, BigInteger, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(Integer, ForeignKey("households.id"), nullable=False)
    payment_method_id: Mapped[int] = mapped_column(Integer, ForeignKey("payment_methods.id"), nullable=False)
    archivo_origen: Mapped[str] = mapped_column(String, nullable=False)
    periodo_desde: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    periodo_hasta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_facturado_declarado: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    estado: Mapped[str] = mapped_column(String, default="preview")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
