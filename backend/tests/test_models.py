from models import (
    User, Household, HouseholdMember, PaymentMethod, Category,
    ImportBatch, Transaction, InstallmentPlan, SplitAllocation,
    Settlement, MerchantRule
)
from database import Base


def test_all_models_importable():
    tables = Base.metadata.tables
    assert "users" in tables
    assert "households" in tables
    assert "household_members" in tables
    assert "payment_methods" in tables
    assert "categories" in tables
    assert "import_batches" in tables
    assert "transactions" in tables
    assert "installment_plans" in tables
    assert "split_allocations" in tables
    assert "settlements" in tables
    assert "merchant_rules" in tables
