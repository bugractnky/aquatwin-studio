import os
from contextlib import asynccontextmanager
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Query, Response
from psycopg.types.json import Jsonb

from .auth import authorize
from .db import connect, migrate
from .schemas import MeasurementIn, MissionIn
from .operator import router as operator_router
from .plans import router as plans_router
from .telemetry import router as telemetry_router

@asynccontextmanager
async def lifespan(app):
    if len(os.environ.get('AQUATWIN_INGEST_TOKEN', '')) < 16:
        raise RuntimeError('Set AQUATWIN_INGEST_TOKEN to at least 16 characters')
    migrate()
    yield


app = FastAPI(title='AquaTwin Measurement API', version='0.2.0', lifespan=lifespan)
app.include_router(operator_router)
app.include_router(plans_router)
# Reads remain local/open; device report POST routes require ingest authorization.
app.include_router(telemetry_router)


@app.get('/api/v1/health')
def health():
    with connect() as conn:
        conn.execute('SELECT 1')
    return {'status': 'ok', 'schema_version': 1}


@app.post('/api/v1/missions', dependencies=[Depends(authorize)])
def create_mission(body: MissionIn, response: Response):
    with connect() as conn:
        row = conn.execute(
            'INSERT INTO missions (id,name,source) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING RETURNING *',
            (body.id, body.name, body.source),
        ).fetchone()
        response.status_code = 201 if row else 200
        if not row:
            row = conn.execute('SELECT * FROM missions WHERE id=%s', (body.id,)).fetchone()
            if row['name'] != body.name or row['source'] != body.source:
                raise HTTPException(409, 'Mission ID already has different content')
        return row


@app.get('/api/v1/missions')
def list_missions(limit: Annotated[int, Query(ge=1, le=200)] = 100, offset: Annotated[int, Query(ge=0)] = 0):
    with connect() as conn:
        total = conn.execute('SELECT count(*) AS n FROM missions').fetchone()['n']
        items = conn.execute('SELECT * FROM missions ORDER BY created_at DESC,id LIMIT %s OFFSET %s', (limit, offset)).fetchall()
    return {'items': items, 'total': total, 'limit': limit, 'offset': offset}


@app.post('/api/v1/measurements', dependencies=[Depends(authorize)])
def ingest(body: MeasurementIn, response: Response):
    payload = body.model_dump(mode='json')
    with connect() as conn:
        mission = conn.execute('SELECT source FROM missions WHERE id=%s FOR UPDATE', (body.mission_id,)).fetchone()
        if not mission:
            raise HTTPException(404, 'Mission not found')
        if mission['source'] != body.source:
            raise HTTPException(409, 'Measurement source must match mission source')
        row = conn.execute(
            'INSERT INTO measurements (id,mission_id,measured_at,payload) VALUES (%s,%s,%s,%s) ON CONFLICT DO NOTHING RETURNING payload,received_at',
            (body.id, body.mission_id, body.measured_at, Jsonb(payload)),
        ).fetchone()
        response.status_code = 201 if row else 200
        if not row:
            row = conn.execute('SELECT payload,received_at FROM measurements WHERE id=%s', (body.id,)).fetchone()
            if row['payload'] != payload:
                raise HTTPException(409, 'Measurement ID already has different content')
        return {**row['payload'], 'received_at': row['received_at']}


@app.get('/api/v1/measurements')
def list_measurements(mission_id: UUID, limit: Annotated[int, Query(ge=1, le=200)] = 100,
                      offset: Annotated[int, Query(ge=0)] = 0):
    with connect() as conn:
        if not conn.execute('SELECT 1 FROM missions WHERE id=%s', (mission_id,)).fetchone():
            raise HTTPException(404, 'Mission not found')
        total = conn.execute('SELECT count(*) AS n FROM measurements WHERE mission_id=%s', (mission_id,)).fetchone()['n']
        rows = conn.execute(
            'SELECT payload,received_at FROM measurements WHERE mission_id=%s ORDER BY measured_at,id LIMIT %s OFFSET %s',
            (mission_id, limit, offset),
        ).fetchall()
    return {'items': [{**r['payload'], 'received_at': r['received_at']} for r in rows],
            'total': total, 'limit': limit, 'offset': offset}
