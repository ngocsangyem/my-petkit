"""The repair that quotes a device's unquoted JSON value tokens."""

import json

from hypothesis import given
from hypothesis import strategies as st

from my_petkit.events.normalize import _as_dict, _repair_bare_values

_TOKEN = st.from_regex(r"[A-Za-z0-9_.\-+]{1,12}", fullmatch=True)
_BAREISH = st.lists(st.tuples(st.text(max_size=8), _TOKEN), max_size=8).map(
    lambda pairs: "{" + ",".join(f'"{k}":{v}' for k, v in pairs) + "}")


@given(st.one_of(st.text(max_size=2000), _BAREISH))
def test_repair_never_raises_and_stays_proportionate(text):
    repaired = _repair_bare_values(text)
    assert isinstance(repaired, str)
    # Each repaired token gains exactly two quote characters.
    assert len(repaired) <= 3 * len(text) + 2


@given(_BAREISH)
def test_a_repaired_object_either_parses_or_is_dropped(text):
    result = _as_dict(text)
    assert isinstance(result, dict)


@given(st.dictionaries(st.text(max_size=8), st.integers() | st.booleans() | st.none(), max_size=6))
def test_valid_json_survives_repair_unchanged(obj):
    text = json.dumps(obj)
    assert json.loads(_repair_bare_values(text)) == obj
