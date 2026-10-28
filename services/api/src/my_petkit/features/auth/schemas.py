"""Request bodies of the auth routes: strict, bounded, never echoed back.

Unknown fields are refused and every string is length-capped. A validation
error names the offending FIELDS only: pydantic's own messages quote the input,
and the input here is a password.
"""

from __future__ import annotations

from typing import TypeVar

from aiohttp import web
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from my_petkit.features.auth.passwords import MAX_PASSWORD_LENGTH
from my_petkit.shared.errors import api_error
from my_petkit.shared.panel_request import _json_body


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False, frozen=True)


class PasswordBody(_Strict):
    """`POST /api/auth/login` and `/api/auth/step-up`."""

    password: str = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)


class SetupBody(_Strict):
    """`POST /api/auth/setup`."""

    setup_token: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)


class RedeemBody(_Strict):
    """`POST /api/auth/pairing/redeem`."""

    code: str = Field(min_length=1, max_length=64)
    name: str = Field(default="client", min_length=1, max_length=64)


class MediaUrlBody(_Strict):
    """`POST /api/auth/media-url`."""

    path: str = Field(min_length=1, max_length=1024)


_Model = TypeVar("_Model", bound=_Strict)


async def parse_body(request: web.Request, model: type[_Model]) -> _Model:
    """The JSON body validated against `model`.

    Raises:
        web.HTTPException: 415 without a JSON content type, 400 on a body that
            is not a JSON object or does not match `model`.
    """
    body = await _json_body(request)
    try:
        return model.model_validate(body)
    except ValidationError as e:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in e.errors()})
        raise api_error(400, "invalid_request", f"Invalid field(s): {', '.join(fields)}.") from None
