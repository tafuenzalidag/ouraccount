import uuid
from datetime import date
from sqlalchemy import String, BigInteger, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    payment_method_id: Mapped[str] = mapped_column(String, ForeignKey("payment_methods.id"), nullable=False)
    archivo_origen: Mapped[str] = mapped_column(String, nullable=False)  # pdf | csv
    periodo_desde: Mapped[date | None] = mapped_column(Date, nullable=True)
    periodo_hasta: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_facturado_declarado: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    importado_en: Mapped[date] = mapped_column(Date, default=date.today)
    estado: Mapped[str] = mapped_column(String, default="preview")  # preview | confirmado
