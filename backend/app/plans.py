"""Persistent sampling plans; these routes never execute physical commands."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from psycopg.types.json import Jsonb
from pydantic import Field, FiniteFloat, model_validator

from .db import connect
from .operator import require_operator
from .schemas import MissionIn, Name, Position, StrictModel

router = APIRouter(prefix='/api/v1', tags=['plans'])
Depth = Annotated[FiniteFloat, Field(ge=0)]


class PlannedStation(StrictModel):
    station_id: Annotated[str, Field(min_length=1, max_length=40, pattern=r'^[A-Za-z0-9_-]+$')]
    name: Name
    position: Position
    target_depths_m: list[Depth] = Field(min_length=1, max_length=20)

    @model_validator(mode='after')
    def unique_depths(self):
        # Millimetre precision makes planned-target association unambiguous.
        depths = self.target_depths_m
        if any(abs(d - round(d, 3)) > 1e-8 for d in depths):
            raise ValueError('Target depths support at most three decimal places')
        if len(set(depths)) != len(depths):
            raise ValueError('Target depths must be unique within each station')
        return self


class SamplingPlan(StrictModel):
    schema_version: Annotated[int, Field(strict=True, ge=1, le=1)] = 1
    stations: list[PlannedStation] = Field(min_length=1, max_length=50)

    @model_validator(mode='after')
    def consistent_stations(self):
        ids = [s.station_id for s in self.stations]
        if len(set(ids)) != len(ids):
            raise ValueError('Station IDs must be unique')
        frames = {('local', s.position.reference_id) if s.position.local_x_m is not None else ('geo', 'WGS84') for s in self.stations}
        if len(frames) != 1:
            raise ValueError('Stations in one plan must share a coordinate reference')
        return self


class PlannedMission(MissionIn):
    plan: SamplingPlan


class PlanUpdate(StrictModel):
    expected_revision: Annotated[int, Field(strict=True, ge=0)]
    plan: SamplingPlan


def check_source(source, plan):
    if source == 'device' and any(s.position.reference_id == 'demo-pond-v1' for s in plan.stations):
        raise HTTPException(422, 'Device plans cannot use the schematic demo-pond-v1 reference')


def latest_plan(conn, mission_id):
    row = conn.execute('SELECT revision,payload,created_at FROM mission_plans WHERE mission_id=%s ORDER BY revision DESC LIMIT 1',
                       (mission_id,)).fetchone()
    return {'revision': row['revision'], 'plan': row['payload'], 'created_at': row['created_at']} if row else None


@router.post('/planned-missions', dependencies=[Depends(require_operator)])
def create_planned_mission(body: PlannedMission, response: Response):
    check_source(body.source, body.plan)
    payload = body.plan.model_dump(mode='json')
    with connect() as conn:
        # Conflict retries read the original revision, even if later edits exist.
        inserted = conn.execute('INSERT INTO missions(id,name,source) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING RETURNING *',
                                (body.id, body.name, body.source)).fetchone()
        mission = inserted or conn.execute('SELECT * FROM missions WHERE id=%s', (body.id,)).fetchone()
        if not inserted:
            original = conn.execute('SELECT payload FROM mission_plans WHERE mission_id=%s AND revision=1', (body.id,)).fetchone()
            if mission['name'] != body.name or mission['source'] != body.source or not original or original['payload'] != payload:
                raise HTTPException(409, 'Mission ID already has different content')
        else:
            conn.execute('INSERT INTO mission_plans(mission_id,revision,payload) VALUES (%s,1,%s)', (body.id, Jsonb(payload)))
        response.status_code = 201 if inserted else 200
        return {'mission': mission, **latest_plan(conn, body.id)}


@router.get('/missions/{mission_id}/plan')
def get_plan(mission_id: UUID):
    with connect() as conn:
        if not conn.execute('SELECT 1 FROM missions WHERE id=%s', (mission_id,)).fetchone():
            raise HTTPException(404, 'Mission not found')
        latest = latest_plan(conn, mission_id)
        locked = conn.execute('SELECT EXISTS(SELECT 1 FROM measurements WHERE mission_id=%s) AS locked', (mission_id,)).fetchone()['locked']
        return {'mission_id': mission_id, 'revision': latest['revision'] if latest else 0,
                'plan': latest['plan'] if latest else None, 'created_at': latest['created_at'] if latest else None,
                'locked': locked}


@router.put('/missions/{mission_id}/plan', dependencies=[Depends(require_operator)])
def update_plan(mission_id: UUID, body: PlanUpdate):
    with connect() as conn:
        # Ingestion takes the same mission row lock before inserting a measurement.
        mission = conn.execute('SELECT * FROM missions WHERE id=%s FOR UPDATE', (mission_id,)).fetchone()
        if not mission:
            raise HTTPException(404, 'Mission not found')
        check_source(mission['source'], body.plan)
        latest = latest_plan(conn, mission_id)
        current = latest['revision'] if latest else 0
        if body.expected_revision != current:
            raise HTTPException(409, 'Plan changed; reload before editing')
        if conn.execute('SELECT 1 FROM measurements WHERE mission_id=%s LIMIT 1', (mission_id,)).fetchone():
            raise HTTPException(409, 'Plan is locked because measurements exist; create a new mission')
        payload = body.plan.model_dump(mode='json')
        if latest and latest['plan'] == payload:
            return {'mission_id': mission_id, **latest}
        conn.execute('INSERT INTO mission_plans(mission_id,revision,payload) VALUES (%s,%s,%s)',
                     (mission_id, current + 1, Jsonb(payload)))
        return {'mission_id': mission_id, **latest_plan(conn, mission_id)}
