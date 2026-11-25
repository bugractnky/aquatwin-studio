"""Reserve a simulated plan snapshot before a durable offline replay is generated."""

from uuid import UUID
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import Field
from psycopg.types.json import Jsonb
from .auth import authorize
from .db import connect
from .plans import latest_plan
from .schemas import StrictModel

router = APIRouter(prefix="/api/v1", tags=["simulation"])


class RunIn(StrictModel):
    id: UUID
    mission_id: UUID
    expected_revision: Annotated[int, Field(strict=True, ge=1)]


@router.post("/simulation-runs", dependencies=[Depends(authorize)])
def reserve(body: RunIn, response: Response):
    with connect() as conn:
        mission = conn.execute(
            "SELECT * FROM missions WHERE id=%s FOR UPDATE", (body.mission_id,)
        ).fetchone()
        if not mission:
            raise HTTPException(404, "Mission not found")
        if mission["source"] != "simulated":
            raise HTTPException(422, "Simulation requires a simulated mission")
        old = conn.execute(
            "SELECT * FROM simulation_runs WHERE id=%s", (body.id,)
        ).fetchone()
        if old:
            if (
                old["mission_id"] != body.mission_id
                or old["revision"] != body.expected_revision
            ):
                raise HTTPException(409, "Run ID has different content")
            response.status_code = 200
            return old
        plan = latest_plan(conn, body.mission_id)
        if not plan or plan["revision"] != body.expected_revision:
            raise HTTPException(
                409, "Plan changed or missing; reload before simulation"
            )
        row = conn.execute(
            """INSERT INTO simulation_runs(id,mission_id,revision,plan) VALUES (%s,%s,%s,%s)
            ON CONFLICT (id) DO NOTHING RETURNING *""",
            (body.id, body.mission_id, plan["revision"], Jsonb(plan["plan"])),
        ).fetchone()
        if not row:
            raise HTTPException(409, "Run ID already reserved concurrently")
        response.status_code = 201
        return row
