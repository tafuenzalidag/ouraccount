from datetime import datetime, date
from sqlalchemy import String, Integer, BigInteger, Boolean, Date, DateTime, ForeignKey, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class InstallmentPlan(Base):
    __tablename__ = "installment_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(Integer, ForeignKey("households.id"), nullable=False)
    descripcion: Mapped[str] = mapped_column(String, nullable=False)
    monto_total: Mapped[int] = mapped_column(BigInteger, nullable=False)
    cuota_actual: Mapped[int] = mapped_column(Integer, nullable=False)
    cuotas_totales: Mapped[int] = mapped_column(Integer, nullable=False)
    valor_cuota_mensual: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tasa: Mapped[float] = mapped_column(Numeric(6, 4), default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(Integer, ForeignKey("households.id"), nullable=False)
    import_batch_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("import_batches.id"), nullable=True)
    payment_method_id: Mapped[int] = mapped_column(Integer, ForeignKey("payment_methods.id"), nullable=False)
    payer_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    category_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("categories.id"), nullable=True)
    installment_plan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("installment_plans.id"), nullable=True)
    fecha_operacion: Mapped[date] = mapped_column(Date, nullable=False)
    descripcion_raw: Mapped[str] = mapped_column(String, nullable=False)
    descripcion_norm: Mapped[str] = mapped_column(String, nullable=False)
    lugar: Mapped[str | None] = mapped_column(String, nullable=True)
    monto: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tipo_movimiento: Mapped[str] = mapped_column(String, nullable=False)
    es_hogar: Mapped[bool] = mapped_column(Boolean, default=True)
    es_interno: Mapped[bool] = mapped_column(Boolean, default=False)
    hash_dedupe: Mapped[str] = mapped_column(String, nullable=False)
    split_override: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
