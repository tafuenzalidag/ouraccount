from models import (
    User, Household, HouseholdMember, PaymentMethod, Category,
    ImportBatch, MerchantRule, Transaction, InstallmentPlan,
    SplitAllocation, Settlement,
)
from database import Base
from sqlalchemy import inspect


def _cols(model):
    return {c.key: c for c in inspect(model).mapper.column_attrs}


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


def test_user_has_integer_pk():
    cols = _cols(User)
    assert cols["id"].columns[0].type.python_type == int


def test_all_models_have_timestamps():
    for Model in [User, Household, HouseholdMember, PaymentMethod, Category,
                  ImportBatch, MerchantRule, Transaction, InstallmentPlan,
                  SplitAllocation, Settlement]:
        cols = {c.key for c in inspect(Model).mapper.column_attrs}
        assert "created_at" in cols, f"{Model.__name__} missing created_at"
        assert "updated_at" in cols, f"{Model.__name__} missing updated_at"
        assert "deleted_at" in cols, f"{Model.__name__} missing deleted_at"


def test_transaction_household_id_is_integer():
    cols = _cols(Transaction)
    assert cols["household_id"].columns[0].type.python_type == int
