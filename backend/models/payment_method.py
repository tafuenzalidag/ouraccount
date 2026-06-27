import uuid
from sqlalchemy import String, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    owner_user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    tipo: Mapped[str] = mapped_column(String, nullable=False)  # cuenta_corriente | tarjeta_credito
    alias: Mapped[str] = mapped_column(String, nullable=False)
    ultimos_digitos: Mapped[str | None] = mapped_column(String(4), nullable=True)
    es_compartido: Mapped[bool] = mapped_column(Boolean, default=True)
    banco: Mapped[str | None] = mapped_column(String, nullable=True)
