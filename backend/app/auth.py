import os
import secrets
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer = HTTPBearer(auto_error=False)


def authorize(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    expected = os.environ['AQUATWIN_INGEST_TOKEN']
    if not credentials or not secrets.compare_digest(credentials.credentials, expected):
        raise HTTPException(401, 'Valid ingest token required', headers={'WWW-Authenticate': 'Bearer'})


