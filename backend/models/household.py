import uuid
from datetime import date
from sqlalchemy import String, Date, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class Household(Base):
    __tablename__ = "households"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre: Mapped[str] = mapped_column(String, nullable=False)
    moneda: Mapped[str] = mapped_column(String, default="CLP")
    creado_en: Mapped[date] = mapped_column(Date, default=date.today)


class HouseholdMember(Base):
    __tablename__ = "household_members"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    ratio_default: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    nombre_display: Mapped[str | None] = mapped_column(String, nullable=True)
    invite_code: Mapped[str | None] = mapped_column(String, nullable=True)
