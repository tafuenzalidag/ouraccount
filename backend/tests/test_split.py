from datetime import date
from unittest.mock import MagicMock
from services.split import compute_split, compute_settlement, SettlementResult
from models import Transaction, HouseholdMember, SplitAllocation


def _make_member(user_id, ratio):
    m = MagicMock()
    m.user_id = user_id
    m.ratio_default = ratio
    return m


def _make_tx(monto, es_hogar=True, payer_id="A", split_override=None):
    tx = MagicMock()
    tx.id = "tx1"
    tx.monto = monto
    tx.es_hogar = es_hogar
    tx.payer_user_id = payer_id
    tx.split_override = split_override
    return tx


def test_split_57_43():
    members = [_make_member("A", 0.57), _make_member("B", 0.43)]
    tx = _make_tx(100_000)
    db = MagicMock()
    allocs = compute_split(tx, members, db)
    montos = {a.user_id: a.monto_asignado for a in allocs}
    assert montos["A"] == 57_000
    assert montos["B"] == 43_000
    assert montos["A"] + montos["B"] == 100_000


def test_split_no_rounding_loss():
    """$100.001 — el peso extra va al segundo miembro."""
    members = [_make_member("A", 0.57), _make_member("B", 0.43)]
    tx = _make_tx(100_001)
    allocs = compute_split(tx, members, MagicMock())
    montos = {a.user_id: a.monto_asignado for a in allocs}
    assert montos["A"] + montos["B"] == 100_001


def test_split_negative_abono():
    """Un abono de -$10.000 genera split negativo."""
    members = [_make_member("A", 0.57), _make_member("B", 0.43)]
    tx = _make_tx(-10_000)
    allocs = compute_split(tx, members, MagicMock())
    montos = {a.user_id: a.monto_asignado for a in allocs}
    assert montos["A"] < 0
    assert montos["B"] < 0
    assert montos["A"] + montos["B"] == -10_000


def test_split_override():
    """Override 0.5/0.5 ignora el ratio del hogar."""
    members = [_make_member("A", 0.57), _make_member("B", 0.43)]
    tx = _make_tx(100_000, split_override=0.5)
    allocs = compute_split(tx, members, MagicMock())
    montos = {a.user_id: a.monto_asignado for a in allocs}
    assert montos["A"] == 50_000
    assert montos["B"] == 50_000


def test_split_not_hogar():
    """Si es_hogar=False, no se crea split."""
    members = [_make_member("A", 0.57), _make_member("B", 0.43)]
    tx = _make_tx(50_000, es_hogar=False)
    allocs = compute_split(tx, members, MagicMock())
    assert allocs == []


def test_settlement_b_paid_household_expense():
    """
    Caso tarjeta personal: B pagó $20.000 por gasto del hogar.
    A debe $11.400 a B.
    """
    result = SettlementResult(
        pagado={"A": 0, "B": 20_000},
        debido={"A": 11_400, "B": 8_600},
    )
    assert result.balance["A"] == -11_400  # A debe
    assert result.balance["B"] == 11_400   # B recibe
    deudor, acreedor, monto = result.settlement()
    assert deudor == "A"
    assert acreedor == "B"
    assert monto == 11_400
