import random
import string
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, Household, HouseholdMember
from schemas.household import HouseholdCreate, HouseholdOut, InviteOut, JoinRequest
from services.auth import get_current_user

router = APIRouter(prefix="/api/households", tags=["households"])


def _generate_code(length=6):
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


@router.post("", response_model=HouseholdOut)
def create_household(
    req: HouseholdCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not (0 < req.ratio_a < 1):
        raise HTTPException(status_code=400, detail="ratio_a debe estar entre 0 y 1")
    h = Household(nombre=req.nombre)
    db.add(h)
    db.flush()
    member = HouseholdMember(
        household_id=h.id,
        user_id=current_user.id,
        ratio_default=req.ratio_a,
        nombre_display=req.nombre_display_a,
    )
    db.add(member)
    db.commit()
    db.refresh(h)
    return h


@router.post("/join", response_model=HouseholdOut)
def join(
    req: JoinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    slot = db.query(HouseholdMember).filter(
        HouseholdMember.invite_code == req.code,
        HouseholdMember.user_id == None,
    ).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Código inválido o expirado")
    slot.user_id = current_user.id
    slot.invite_code = None
    db.commit()
    h = db.query(Household).filter(Household.id == slot.household_id).first()
    return h


@router.post("/{household_id}/invite", response_model=InviteOut)
def invite(
    household_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")
    code = _generate_code()
    slot = HouseholdMember(
        household_id=household_id,
        user_id=None,
        ratio_default=round(1.0 - float(member.ratio_default), 4),
        invite_code=code,
    )
    db.add(slot)
    db.commit()
    return InviteOut(code=code)


@router.get("/{household_id}", response_model=HouseholdOut)
def get_household(
    household_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")
    h = db.query(Household).filter(Household.id == household_id).first()
    return h


@router.get("/{household_id}/members")
def get_members(
    household_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")
    members = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id != None,
    ).all()
    users = {
        u.id: u
        for u in db.query(User).filter(User.id.in_([m.user_id for m in members])).all()
    }
    return [
        {
            "user_id": m.user_id,
            "nombre_display": m.nombre_display or users[m.user_id].nombre,
            "ratio_default": float(m.ratio_default),
        }
        for m in members
    ]
