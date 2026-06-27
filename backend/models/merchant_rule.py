import uuid
from sqlalchemy import String, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class MerchantRule(Base):
    __tablename__ = "merchant_rules"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    patron: Mapped[str] = mapped_column(String, nullable=False)
    category_id: Mapped[str] = mapped_column(String, ForeignKey("categories.id"), nullable=False)
    es_hogar_default: Mapped[bool] = mapped_column(Boolean, default=True)
