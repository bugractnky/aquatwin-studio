"""Local operator sessions. Device ingest credentials never enter the browser."""
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import Field, SecretStr

from .db import connect
from .schemas import StrictModel

router = APIRouter(prefix='/api/v1/operator', tags=['operator'])
COOKIE = 'aquatwin_operator'
TTL_SECONDS = 8 * 60 * 60


class Login(StrictModel):
    password: SecretStr = Field(max_length=256)


def configured_password():
    value = os.environ.get('AQUATWIN_OPERATOR_PASSWORD', '')
    return value if len(value) >= 16 else None


def require_origin(request: Request):
    allowed = os.environ.get('AQUATWIN_OPERATOR_ORIGINS',
        'http://127.0.0.1:5173,http://127.0.0.1:5176,http://localhost:5173,http://localhost:5176').split(',')
    if request.headers.get('origin') not in {v.strip() for v in allowed}:
        raise HTTPException(403, 'Operator request origin is not allowed')


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def csrf_for(token):
    return hashlib.sha256(('aquatwin-csrf:' + token).encode()).hexdigest()


def session_token(request: Request):
    if not configured_password():
        return None
    token = request.cookies.get(COOKIE)
    if not token or len(token) > 256:
        return None
    with connect() as conn:
        row = conn.execute('SELECT 1 FROM operator_sessions WHERE token_hash=%s AND expires_at>now()',
                           (token_hash(token),)).fetchone()
    return token if row else None


def require_operator(request: Request):
    require_origin(request)
    token = session_token(request)
    if not token:
        raise HTTPException(401, 'Operator login required')
    if not secrets.compare_digest(request.headers.get('x-csrf-token', ''), csrf_for(token)):
        raise HTTPException(403, 'Invalid CSRF token')


@router.get('/session')
def current_session(request: Request, response: Response):
    response.headers['Cache-Control'] = 'no-store'
    token = session_token(request)
    return {'enabled': configured_password() is not None, 'authenticated': token is not None,
            'csrf_token': csrf_for(token) if token else None}


@router.post('/session', dependencies=[Depends(require_origin)])
def login(body: Login, request: Request, response: Response):
    expected = configured_password()
    if not expected:
        raise HTTPException(503, 'Operator login is not configured')
    supplied = body.password.get_secret_value()
    if not secrets.compare_digest(supplied.encode(), expected.encode()):
        raise HTTPException(401, 'Invalid operator password')
    token = secrets.token_urlsafe(32)
    with connect() as conn:
        conn.execute('DELETE FROM operator_sessions WHERE expires_at<=now()')
        previous = request.cookies.get(COOKIE)
        if previous:
            conn.execute('DELETE FROM operator_sessions WHERE token_hash=%s', (token_hash(previous),))
        conn.execute('INSERT INTO operator_sessions VALUES (%s,%s)',
                     (token_hash(token), datetime.now(timezone.utc) + timedelta(seconds=TTL_SECONDS)))
    response.set_cookie(COOKIE, token, httponly=True, samesite='strict', path='/api/v1',
                        max_age=TTL_SECONDS, secure=os.environ.get('AQUATWIN_SECURE_COOKIES') == 'true')
    response.headers['Cache-Control'] = 'no-store'
    return {'enabled': True, 'authenticated': True, 'csrf_token': csrf_for(token)}


@router.delete('/session', dependencies=[Depends(require_operator)])
def logout(request: Request, response: Response):
    with connect() as conn:
        conn.execute('DELETE FROM operator_sessions WHERE token_hash=%s', (token_hash(request.cookies[COOKIE]),))
    response.delete_cookie(COOKIE, path='/api/v1')
    response.headers['Cache-Control'] = 'no-store'
    return {'authenticated': False}
