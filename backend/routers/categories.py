from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, HouseholdMember, Category
from schemas.category import CategoryCreate, CategoryOut
from services.auth import get_current_user

router = APIRouter(prefix="/api/households", tags=["categories"])


def _assert_member(household_id: str, user: User, db: Session):
    m = db.query(HouseholdMember).filter(
        HouseholdMember.household_id == household_id,
        HouseholdMember.user_id == user.id,
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="No perteneces a este hogar")


@router.get("/{household_id}/categories", response_model=list[CategoryOut])
def list_categories(
    household_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_member(household_id, current_user, db)
    return db.query(Category).filter(Category.household_id == household_id).all()


@router.post("/{household_id}/categories", response_model=CategoryOut)
def create_category(
    household_id: str,
    req: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_member(household_id, current_user, db)
    cat = Category(household_id=household_id, **req.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat
