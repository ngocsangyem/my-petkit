"""`parse_x_device`: the X-Device header every Ingenic request carries."""

from hypothesis import given
from hypothesis import strategies as st

from my_petkit.http.middleware.device import parse_x_device
from tests.fuzz.conftest import bounded

_FIELD = st.sampled_from(["id", "sn", "type", "nonce", "timestamp", "sign", "", "&", "="])
_QUERYISH = st.lists(st.tuples(_FIELD, st.text(max_size=40)), max_size=12).map(
    lambda pairs: "&".join(f"{k}={v}" for k, v in pairs))


@given(st.one_of(st.text(max_size=2000), _QUERYISH))
def test_any_header_parses_to_a_dict_or_none(header):
    result = parse_x_device(header)
    assert result is None or (isinstance(result, dict) and "id" in result)
    assert bounded(result, len(header))
