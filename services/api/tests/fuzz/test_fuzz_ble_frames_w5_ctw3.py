"""BLE relay frames from W5 and CTW3 fountains, as a parent device relays them."""

import base64
import urllib.parse

from hypothesis import given
from hypothesis import strategies as st

from my_petkit.devices.ble.ctw3 import decode_ctw3_config, parse_ctw3_ble_response
from my_petkit.devices.ble.framing import _ble_decode_data, _ble_unframe
from my_petkit.devices.ble.w5 import parse_w5_ble_response
from tests.fuzz.conftest import bounded

_FRAME = st.binary(max_size=256).map(lambda b: b"\xfa\xfc\xfd" + b)
_ENCODED = st.one_of(
    st.binary(max_size=256).map(lambda b: urllib.parse.quote(base64.b64encode(b).decode())),
    _FRAME.map(lambda b: urllib.parse.quote(base64.b64encode(b).decode())),
    st.binary(max_size=128).map(bytes.hex),
    st.text(max_size=200),
)
_ENTRY = st.fixed_dictionaries(
    {}, optional={"cmd": st.integers(-1, 300) | st.text(max_size=5), "data": _ENCODED,
                  "mac": st.text(max_size=20), "type": st.integers(0, 30)})
_CONTENT = st.one_of(
    st.lists(_ENTRY, max_size=6),
    st.dictionaries(st.sampled_from(["data", "cmd", "list", "states", "x"]),
                    _ENCODED | st.integers() | st.lists(_ENTRY, max_size=3), max_size=4),
    st.text(max_size=300), st.none(), st.integers(),
)


@given(st.one_of(st.binary(max_size=512), st.text(max_size=512), st.none(), st.integers()))
def test_any_data_field_decodes_or_is_skipped(blob):
    out = _ble_decode_data(blob)
    assert out is None or isinstance(out, bytes)


@given(st.one_of(_FRAME, st.binary(max_size=300)))
def test_any_bytes_unframe(raw):
    cmd, data = _ble_unframe(raw)
    assert cmd is None or isinstance(cmd, int)
    assert isinstance(data, bytes) and len(data) <= len(raw)


@given(_CONTENT)
def test_any_w5_response_parses(content):
    result = parse_w5_ble_response(content)
    assert isinstance(result, dict)
    assert bounded(result, len(repr(content)))


@given(_CONTENT)
def test_any_ctw3_response_parses(content):
    result = parse_ctw3_ble_response(content)
    assert isinstance(result, dict)
    assert bounded(result, len(repr(content)))


@given(st.binary(max_size=128))
def test_any_ctw3_config_tail_decodes(tail):
    assert isinstance(decode_ctw3_config(tail), dict)
