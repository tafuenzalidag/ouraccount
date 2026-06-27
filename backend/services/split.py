from dataclasses import dataclass, field
from datetime import date
from sqlalchemy.orm import Session
from models import Transaction, HouseholdMember, SplitAllocation


def compute_split(tx, members: list, db: Session) -> list:
    """
    Splits a transaction across members. Returns a list of SplitAllocation objects
    added to db (but NOT committed — the caller commits).

    Rules:
    - If tx.es_hogar is False, returns [].
    - tx.split_override takes precedence over members[0].ratio_default.
    - First member gets round(monto * ratio); second member gets the remainder
      to prevent losing 1 peso to rounding.
    - Negative monto (abono) produces negative allocations with the same logic.
    """
    if not tx.es_hogar:
        return []

    ratio_a = float(tx.split_override) if tx.split_override is not None else float(members[0].ratio_default)
    monto_a = round(tx.monto * ratio_a)
    monto_b = tx.monto - monto_a  # remainder: prevents rounding loss

    allocs = []
    for member, monto_asignado in zip(members, [monto_a, monto_b]):
        ratio = ratio_a if member == members[0] else round(1.0 - ratio_a, 4)
        alloc = SplitAllocation(
            transaction_id=tx.id,
            user_id=member.user_id,
            ratio=ratio,
            monto_asignado=monto_asignado,
        )
        db.add(alloc)
        allocs.append(alloc)
    return allocs


@dataclass
class SettlementResult:
    pagado: dict[str, int]
    debido: dict[str, int]
    balance: dict[str, int] = field(init=False)

    def __post_init__(self):
        # balance > 0: member paid more than they owed (is owed money)
        # balance < 0: member paid less than they owed (owes money)
        self.balance = {
            uid: self.pagado[uid] - self.debido[uid]
            for uid in self.pagado
        }

    def settlement(self) -> tuple[str | None, str | None, int]:
        """Returns (deudor_id, acreedor_id, monto) for the single transfer that settles accounts."""
        if len(self.balance) < 2:
            return (None, None, 0)
        deudor = min(self.balance, key=lambda u: self.balance[u])
        acreedor = max(self.balance, key=lambda u: self.balance[u])
        return deudor, acreedor, abs(self.balance[deudor])


def compute_settlement(household_id: str, desde: date, hasta: date, db: Session) -> SettlementResult:
    """
    Computes the settlement for a household in a date range.
    Excludes es_interno=True transactions and members with user_id=None.
    """
    members = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id.isnot(None),
    ).all()

    txs = db.query(Transaction).filter(
        Transaction.household_id == household_id,
        Transaction.es_hogar == True,
        Transaction.es_interno == False,
        Transaction.fecha_operacion >= desde,
        Transaction.fecha_operacion <= hasta,
    ).all()

    allocs = db.query(SplitAllocation).filter(
        SplitAllocation.transaction_id.in_([t.id for t in txs])
    ).all() if txs else []

    pagado: dict[str, int] = {m.user_id: 0 for m in members}
    debido: dict[str, int] = {m.user_id: 0 for m in members}

    for tx in txs:
        if tx.payer_user_id in pagado:
            pagado[tx.payer_user_id] += tx.monto

    for alloc in allocs:
        if alloc.user_id in debido:
            debido[alloc.user_id] += alloc.monto_asignado

    return SettlementResult(pagado=pagado, debido=debido)
