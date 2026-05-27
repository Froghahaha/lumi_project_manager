"""Customer CRUD — /customers"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..deps import get_current_user, get_session, require_permission, utcnow
from ..models import Customer
from ..schemas import CustomerCreate, CustomerOut, CustomerUpdate
from ..utils import customer_to_out

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=list[CustomerOut])
def list_customers(actor=Depends(get_current_user), session: Session = Depends(get_session)):
    return [customer_to_out(c) for c in session.exec(select(Customer))]


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(
    body: CustomerCreate,
    actor=Depends(require_permission("customers:manage", "customer")),
    session: Session = Depends(get_session),
):
    existing = session.exec(select(Customer).where(Customer.code == body.code)).first()
    if existing:
        raise HTTPException(400, "customer code already exists")
    c = Customer(code=body.code, name=body.name)
    session.add(c)
    session.flush()
    return customer_to_out(c)


@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: uuid.UUID,
    body: CustomerUpdate,
    actor=Depends(require_permission("customers:manage", "customer")),
    session: Session = Depends(get_session),
):
    c = session.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "customer not found")
    if body.code is not None:
        existing = session.exec(select(Customer).where(
            Customer.code == body.code, Customer.id != customer_id
        )).first()
        if existing:
            raise HTTPException(400, "customer code already exists")
        c.code = body.code
    if body.name is not None:
        c.name = body.name
    c.updated_at = utcnow()
    session.add(c)
    session.flush()
    return customer_to_out(c)


@router.delete("/{customer_id}", status_code=204)
def delete_customer(
    customer_id: uuid.UUID,
    actor=Depends(require_permission("customers:manage", "customer")),
    session: Session = Depends(get_session),
):
    c = session.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "customer not found")
    session.delete(c)
