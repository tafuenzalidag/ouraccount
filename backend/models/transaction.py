import uuid
from datetime import date
from sqlalchemy import String, BigInteger, Boolean, Date, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class InstallmentPlan(Base):
    __tablename__ = "installment_plans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    descripcion: Mapped[str] = mapped_column(String, nullable=False)
    monto_total: Mapped[int] = mapped_column(BigInteger, nullable=False)
    cuota_actual: Mapped[int] = mapped_column(Integer, nullable=False)
    cuotas_totales: Mapped[int] = mapped_column(Integer, nullable=False)
    valor_cuota_mensual: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tasa: Mapped[float] = mapped_column(Numeric(6, 4), default=0.0)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    import_batch_id: Mapped[str | None] = mapped_column(String, ForeignKey("import_batches.id"), nullable=True)
    payment_method_id: Mapped[str] = mapped_column(String, ForeignKey("payment_methods.id"), nullable=False)
    payer_user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    category_id: Mapped[str | None] = mapped_column(String, ForeignKey("categories.id"), nullable=True)
    installment_plan_id: Mapped[str | None] = mapped_column(String, ForeignKey("installment_plans.id"), nullable=True)
    fecha_operacion: Mapped[date] = mapped_column(Date, nullable=False)
    descripcion_raw: Mapped[str] = mapped_column(String, nullable=False)
    descripcion_norm: Mapped[str] = mapped_column(String, nullable=False)
    lugar: Mapped[str | None] = mapped_column(String, nullable=True)
    monto: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tipo_movimiento: Mapped[str] = mapped_column(String, nullable=False)  # compra|abono|impuesto|cuota|interno
    es_hogar: Mapped[bool] = mapped_column(Boolean, default=True)
    es_interno: Mapped[bool] = mapped_column(Boolean, default=False)
    hash_dedupe: Mapped[str] = mapped_column(String, nullable=False)
    split_override: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    creado_en: Mapped[date] = mapped_column(Date, default=date.today)
