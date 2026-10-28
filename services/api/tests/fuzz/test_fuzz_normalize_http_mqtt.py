"""Event normalization for both transports: HTTP `dev_event_report`, MQTT events."""

from hypothesis import given
from hypothesis import strategies as st

from my_petkit.devices.base import Device
from my_petkit.devices.state_parsers import normalize_property_params
from my_petkit.events.normalize import from_event_report, from_mqtt, parse_event_report_form
from my_petkit.utils.const import DEVICE_TYPES_ALL
from tests.fuzz.conftest import bounded

_JSON = st.recursive(
    st.none() | st.booleans() | st.integers() | st.floats(allow_nan=True) | st.text(max_size=30),
    lambda children: st.lists(children, max_size=5) | st.dictionaries(st.text(max_size=12), children, max_size=5),
    max_leaves=25,
)
_KEYS = st.sampled_from(["event_type", "event_id", "timestamp", "content", "state", "XDevice",
                         "petEvent", "toiletEvent", "result", "start_reason", "score_info", "x"])
_PARAMS = st.dictionaries(_KEYS | st.text(max_size=12), _JSON, max_size=8)
_DEVICE_TYPE = st.sampled_from(sorted(DEVICE_TYPES_ALL) + ["", "unknown"])


def _device(device_type: str) -> Device:
    return Device(petkit_id=1, device_type=device_type or "t5", serial_number="SN1")


@given(st.text(max_size=3000))
def test_any_event_report_body_parses(text):
    form = parse_event_report_form(text)
    assert isinstance(form, dict)
    assert bounded(form, len(text))


@given(_DEVICE_TYPE, _PARAMS)
def test_any_event_report_form_normalizes(device_type, form):
    row = from_event_report(_device(device_type), form)
    assert isinstance(row, dict)


@given(_DEVICE_TYPE, st.text(max_size=40), _PARAMS)
def test_any_mqtt_event_normalizes(device_type, event_type, params):
    row = from_mqtt(_device(device_type), event_type, params)
    assert isinstance(row, dict)


@given(_DEVICE_TYPE, _PARAMS)
def test_any_property_params_normalize(device_type, params):
    out = normalize_property_params(device_type or "t5", params)
    assert isinstance(out, dict)
