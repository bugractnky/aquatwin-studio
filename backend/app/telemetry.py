"""Immutable device reports, never physical commands. Full snapshots, not patches."""
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from psycopg.types.json import Jsonb
from pydantic import AwareDatetime, Field, FiniteFloat, field_validator, model_validator

from .auth import authorize
from .db import connect
from .schemas import Name, Position, Source, StrictModel

router = APIRouter(prefix='/api/v1', tags=['telemetry'])
Depth = Annotated[FiniteFloat, Field(ge=0)]


class Report(StrictModel):
    schema_version: Literal[1]
    id: UUID
    mission_id: UUID
    device_id: Name
    source: Source
    session_id: UUID
    session_started_at: AwareDatetime
    sequence: Annotated[int, Field(strict=True, ge=0, le=9007199254740991)]
    observed_at: AwareDatetime

    @field_validator('session_started_at', 'observed_at')
    @classmethod
    def utc(cls, value):
        return value.astimezone(timezone.utc)

    @model_validator(mode='after')
    def time_order(self):
        if self.observed_at < self.session_started_at:
            raise ValueError('observed_at must not precede session_started_at')
        return self


class TelemetryIn(Report):
    validity: Literal['valid', 'invalid']
    validity_reason: Annotated[str, Field(min_length=1, max_length=1000, pattern=r'\S')]
    station_id: Name | None = None
    position: Position | None = None
    target_depth_m: Depth | None = None
    actual_depth_m: Depth | None = None
    winch_stage: Literal['idle', 'lowering', 'settling', 'measuring', 'retracting', 'fault'] | None = None
    error_code: Name | None = None


class EventIn(Report):
    kind: Literal['mission_started', 'station_arrived', 'depth_reached', 'measurement_started',
                  'measurement_completed', 'retraction_completed', 'mission_completed', 'fault', 'info']
    severity: Literal['info', 'warning', 'error']
    message: Annotated[str, Field(min_length=1, max_length=1000, pattern=r'\S')]
    station_id: Name | None = None
    error_code: Name | None = None


def save_report(body, response, table):
    # Table comes exclusively from the two internal route handlers below.
    payload = body.model_dump(mode='json')
    with connect() as conn:
        # Serialize writes for one mission, including session and sequence checks.
        mission = conn.execute('SELECT source FROM missions WHERE id=%s FOR UPDATE', (body.mission_id,)).fetchone()
        if not mission:
            raise HTTPException(404, 'Mission not found')
        if body.source != mission['source']:
            raise HTTPException(409, 'Report source must match mission source')
        existing = conn.execute(f'SELECT payload,received_at FROM {table} WHERE id=%s', (body.id,)).fetchone()
        if existing:
            if existing['payload'] != payload:
                raise HTTPException(409, 'Report ID already has different content')
            response.status_code = 200
            return {**existing['payload'], 'received_at': existing['received_at']}
        now = datetime.now(timezone.utc)
        if body.observed_at > now + timedelta(seconds=30):
            raise HTTPException(422, 'Device clock is more than 30 seconds ahead of server')
        if body.source == 'device' and getattr(body, 'position', None) and body.position.reference_id == 'demo-pond-v1':
            raise HTTPException(422, 'Device telemetry cannot use schematic demo coordinates')
        session = conn.execute('SELECT started_at FROM device_sessions WHERE mission_id=%s AND device_id=%s AND session_id=%s',
                               (body.mission_id, body.device_id, body.session_id)).fetchone()
        if session and session['started_at'] != body.session_started_at:
            raise HTTPException(409, 'Session ID has a different start time')
        if not session:
            same_time = conn.execute('SELECT 1 FROM device_sessions WHERE mission_id=%s AND device_id=%s AND started_at=%s',
                                     (body.mission_id, body.device_id, body.session_started_at)).fetchone()
            if same_time:
                raise HTTPException(409, 'Session start time must uniquely identify its order')
            conn.execute('INSERT INTO device_sessions VALUES (%s,%s,%s,%s)',
                         (body.mission_id, body.device_id, body.session_id, body.session_started_at))
        key = (body.mission_id, body.device_id, body.session_id)
        if conn.execute(f'SELECT 1 FROM {table} WHERE mission_id=%s AND device_id=%s AND session_id=%s AND sequence=%s',
                        (*key, body.sequence)).fetchone():
            raise HTTPException(409, 'Sequence already belongs to another report ID')
        # Sequence ordering must agree with device time, even for reordered delivery.
        neighbors = conn.execute(f'''SELECT sequence,observed_at FROM {table}
            WHERE mission_id=%s AND device_id=%s AND session_id=%s AND
            (sequence=(SELECT max(sequence) FROM {table} WHERE mission_id=%s AND device_id=%s AND session_id=%s AND sequence<%s)
            OR sequence=(SELECT min(sequence) FROM {table} WHERE mission_id=%s AND device_id=%s AND session_id=%s AND sequence>%s))''',
            (*key, *key, body.sequence, *key, body.sequence)).fetchall()
        if any((r['sequence'] < body.sequence and r['observed_at'] > body.observed_at) or
               (r['sequence'] > body.sequence and r['observed_at'] < body.observed_at) for r in neighbors):
            raise HTTPException(422, 'Sequence and device time disagree; check clock/session')
        row = conn.execute(f'''INSERT INTO {table}(id,mission_id,device_id,session_id,sequence,observed_at,payload)
            VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING RETURNING received_at''',
            (body.id, *key, body.sequence, body.observed_at, Jsonb(payload))).fetchone()
        if not row:
            raise HTTPException(409, 'Report ID already belongs to another concurrent report')
        response.status_code = 201
        return {**payload, 'received_at': row['received_at']}


@router.post('/telemetry', dependencies=[Depends(authorize)])
def ingest_telemetry(body: TelemetryIn, response: Response):
    return save_report(body, response, 'telemetry')


@router.post('/events', dependencies=[Depends(authorize)])
def ingest_event(body: EventIn, response: Response):
    return save_report(body, response, 'mission_events')


def require_mission(conn, mission_id):
    if not conn.execute('SELECT 1 FROM missions WHERE id=%s', (mission_id,)).fetchone():
        raise HTTPException(404, 'Mission not found')


@router.get('/missions/{mission_id}/telemetry')
def current_telemetry(mission_id: UUID, response: Response):
    response.headers['Cache-Control'] = 'no-store'
    with connect() as conn:
        require_mission(conn, mission_id)
        rows = conn.execute('''SELECT DISTINCT ON (t.device_id) t.payload,t.received_at
            FROM telemetry t JOIN device_sessions s USING (mission_id,device_id,session_id)
            WHERE t.mission_id=%s ORDER BY t.device_id,s.started_at DESC,t.sequence DESC''', (mission_id,)).fetchall()
        now = conn.execute('SELECT clock_timestamp() AS now').fetchone()['now']
    items = []
    for row in rows:
        packet = row['payload']
        observed = datetime.fromisoformat(packet['observed_at'].replace('Z', '+00:00'))
        age = max(0, (now - min(row['received_at'], observed)).total_seconds())
        freshness = 'fresh' if age < 15 else 'stale' if age < 60 else 'offline'
        items.append({**packet, 'received_at': row['received_at'], 'age_seconds': age, 'freshness': freshness})
    return {'mission_id': mission_id, 'server_time': now, 'stale_after_seconds': 15, 'offline_after_seconds': 60, 'items': items}


@router.get('/missions/{mission_id}/events')
def list_events(mission_id: UUID, limit: Annotated[int, Query(ge=1, le=200)] = 50,
                offset: Annotated[int, Query(ge=0)] = 0):
    with connect() as conn:
        require_mission(conn, mission_id)
        total = conn.execute('SELECT count(*) AS n FROM mission_events WHERE mission_id=%s', (mission_id,)).fetchone()['n']
        rows = conn.execute('''SELECT payload,received_at FROM mission_events WHERE mission_id=%s
            ORDER BY observed_at DESC,id DESC LIMIT %s OFFSET %s''', (mission_id, limit, offset)).fetchall()
    return {'items': [{**r['payload'], 'received_at': r['received_at']} for r in rows], 'total': total, 'limit': limit, 'offset': offset}
