"""The auth endpoints: setup, login, logout, step-up, pairing, tokens, media URLs.

Every endpoint that checks a guessable secret (setup token, password, pairing
code) is rate-limited per peer address and globally, and every failure there
writes one structured `auth_failure` log line: which check, from which peer,
on which route — never the value tried.
"""

from __future__ import annotations

import logging

from aiohttp import web
from yarl import URL

from my_petkit.features.auth.pairing import CODE_TTL_SECONDS, qr_payload
from my_petkit.features.auth.passwords import password_problem
from my_petkit.features.auth.schemas import (
    MediaUrlBody,
    PasswordBody,
    RedeemBody,
    SetupBody,
    parse_body,
)
from my_petkit.features.auth.service import AuthService
from my_petkit.features.auth.middleware import peer_ip
from my_petkit.features.auth.sessions import (
    COOKIE_NAME,
    clear_session_cookie,
    set_session_cookie,
)
from my_petkit.features.auth.signed_media import SIGNABLE_PREFIX, SIGNED_URL_TTL_SECONDS
from my_petkit.features.auth.step_up import STEP_UP_SECONDS
from my_petkit.shared.appkeys import AUTH
from my_petkit.shared.errors import api_error
from my_petkit.shared.request_auth import auth_context
from my_petkit.shared.tiers import Tier, tier

log = logging.getLogger("my_petkit.audit")


def _auth(request: web.Request) -> AuthService:
    auth: AuthService | None = request.app.get(AUTH)
    if auth is None:
        raise api_error(503, "auth_unavailable", "Authentication is not configured.")
    return auth


def _peer(request: web.Request) -> str:
    """The TCP peer (never a forwarded header), as the rate-limit key."""
    return str(peer_ip(request) or "unknown")


def _check_limit(auth: AuthService, bucket: str, request: web.Request) -> None:
    wait = auth.limiter.retry_after(bucket, _peer(request))
    if wait > 0:
        raise api_error(
            429,
            "rate_limited",
            "Too many failed attempts. Try again later.",
            headers={"Retry-After": str(int(wait) + 1)},
        )


def _failed(auth: AuthService, bucket: str, request: web.Request) -> None:
    auth.limiter.failure(bucket, _peer(request))
    log.warning("auth_failure check=%s peer=%s route=%s", bucket, _peer(request), request.path)


def _signed_in(auth: AuthService) -> web.Response:
    _session, value = auth.sessions.new(auth.store.session_epoch())
    response = web.json_response({"ok": True})
    set_session_cookie(response, value)
    return response


@tier(POST=Tier.CREDENTIAL)
async def api_auth_setup(request: web.Request) -> web.Response:
    """Create the first admin with the setup token from the log; signs in."""
    auth = _auth(request)
    _check_limit(auth, "setup", request)
    body = await parse_body(request, SetupBody)
    if auth.admin_exists():
        raise api_error(409, "already_set_up", "An admin password is already set.")
    problem = password_problem(body.password)
    if problem:
        raise api_error(400, "weak_password", problem)
    if not auth.setup_token.redeem(body.setup_token):
        _failed(auth, "setup", request)
        raise api_error(401, "invalid_setup_token", "The setup token is not valid.")
    if not await auth.create_admin(body.password):
        raise api_error(409, "already_set_up", "An admin password is already set.")
    log.info("admin_created peer=%s", _peer(request))
    return _signed_in(auth)


@tier(POST=Tier.CREDENTIAL)
async def api_auth_login(request: web.Request) -> web.Response:
    """Exchange the admin password for a session cookie."""
    auth = _auth(request)
    _check_limit(auth, "login", request)
    body = await parse_body(request, PasswordBody)
    if not auth.admin_exists():
        raise api_error(409, "setup_required", "No admin password is set yet.")
    if not await auth.check_password(body.password):
        _failed(auth, "login", request)
        raise api_error(401, "invalid_credentials", "The password is not correct.")
    auth.limiter.success("login", _peer(request))
    return _signed_in(auth)


@tier(POST=Tier.R0)
async def api_auth_logout(request: web.Request) -> web.Response:
    """End this session (a client token is revoked instead, by id)."""
    auth = _auth(request)
    ctx = auth_context(request)
    if ctx is not None:
        auth.step_ups.revoke(ctx.principal)
        if ctx.method == "session":
            session = auth.sessions.verify(
                request.cookies.get(COOKIE_NAME, ""), auth.store.session_epoch()
            )
            if session is not None:
                auth.sessions.revoke(session)
    response = web.json_response({"ok": True})
    clear_session_cookie(response)
    return response


@tier(POST=Tier.R0)
async def api_auth_step_up(request: web.Request) -> web.Response:
    """Re-enter the password: unlocks R3 routes for this principal for 5 minutes."""
    auth = _auth(request)
    _check_limit(auth, "step_up", request)
    body = await parse_body(request, PasswordBody)
    ctx = auth_context(request)
    if ctx is None or not await auth.check_password(body.password):
        _failed(auth, "step_up", request)
        raise api_error(401, "invalid_credentials", "The password is not correct.")
    auth.limiter.success("step_up", _peer(request))
    auth.step_ups.grant(ctx.principal)
    log.info("step_up principal=%s", ctx.principal)
    return web.json_response({"ok": True, "expires_in": STEP_UP_SECONDS})


@tier(POST=Tier.R3)
async def api_auth_pairing_create(request: web.Request) -> web.Response:
    """A single-use pairing code and the QR payload that carries it."""
    auth = _auth(request)
    code, expires_at = auth.pairing.create()
    url = auth.settings.user_url
    if not url:
        # No configured address: the host this admin reached us on, at the TLS port.
        host = URL(f"//{request.host}").host or ""
        port = auth.settings.user_port
        url = f"https://{host}:{port}" if port else f"https://{request.host}"
    return web.json_response(
        {
            "code": code,
            "expires_at": expires_at,
            "expires_in": CODE_TTL_SECONDS,
            "qr": qr_payload(url, auth.settings.cert_sha256, code),
        }
    )


@tier(POST=Tier.CREDENTIAL)
async def api_auth_pairing_redeem(request: web.Request) -> web.Response:
    """Trade a pairing code for a client token. The token is shown only here."""
    auth = _auth(request)
    _check_limit(auth, "pairing", request)
    body = await parse_body(request, RedeemBody)
    if not auth.pairing.redeem(body.code):
        _failed(auth, "pairing", request)
        raise api_error(401, "invalid_pairing_code", "The pairing code is not valid.")
    auth.limiter.success("pairing", _peer(request))
    token_id, raw = auth.tokens.issue(body.name)
    log.info("client_paired token_id=%d peer=%s", token_id, _peer(request))
    return web.json_response({"token": raw, "token_id": token_id})


@tier(GET=Tier.R0_SENSITIVE)
async def api_auth_tokens(request: web.Request) -> web.Response:
    """Every live client token: id, name, created_at, last_used. Never the token."""
    rows = _auth(request).tokens.list()
    return web.json_response(
        {
            "tokens": [
                {"id": r.id, "name": r.name, "created_at": r.created_at, "last_used": r.last_used}
                for r in rows
            ]
        }
    )


@tier(DELETE=Tier.R1)
async def api_auth_token_revoke(request: web.Request) -> web.Response:
    """Revoke one client token by id."""
    raw_id = request.match_info["id"]
    if not raw_id.isdigit() or not _auth(request).tokens.revoke(int(raw_id)):
        raise api_error(404, "not_found", "No such token.")
    log.info("token_revoked token_id=%s", raw_id)
    return web.json_response({"ok": True})


@tier(POST=Tier.R0_SENSITIVE)
async def api_auth_media_url(request: web.Request) -> web.Response:
    """A five-minute signed URL for one file under `/api/media/`."""
    body = await parse_body(request, MediaUrlBody)
    rel = body.path.lstrip("/")
    rel = rel.removeprefix(SIGNABLE_PREFIX.lstrip("/"))
    if not rel or "\x00" in rel:
        raise api_error(400, "invalid_request", "Invalid field(s): path.")
    url = _auth(request).signer.signed_url(SIGNABLE_PREFIX + rel)
    return web.json_response({"url": url, "expires_in": SIGNED_URL_TTL_SECONDS})
