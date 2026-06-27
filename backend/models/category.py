import uuid
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    parent_id: Mapped[str | None] = mapped_column(String, ForeignKey("categories.id"), nullable=True)
    nombre: Mapped[str] = mapped_column(String, nullable=False)
    icono: Mapped[str | None] = mapped_column(String, nullable=True)
    color: Mapped[str | None] = mapped_column(String, nullable=True)
