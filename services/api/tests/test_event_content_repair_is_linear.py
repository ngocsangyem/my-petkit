"""Repairing a device's malformed event JSON takes time linear in its size.

A pattern that required the closing quote of a string re-scanned the rest of
the text from every later quote, so a payload of 32k escaped quotes took 15 s
on the server's event loop.
"""
import time

from my_petkit.events.normalize import _as_dict, _repair_bare_values


def test_an_unterminated_string_of_escaped_quotes_is_repaired_in_linear_time():
    hostile = '{"a":"' + '\\"' * 200_000
    started = time.perf_counter()
    _repair_bare_values(hostile)
    assert time.perf_counter() - started < 1.0
    assert _as_dict(hostile) == {}


def test_a_bare_token_is_still_quoted_and_text_inside_strings_is_left_alone():
    fixed = _repair_bare_values('{"related_event":3_10000001_1784741818,"m":"a, b:c","x":tok}')
    assert fixed == '{"related_event":"3_10000001_1784741818","m":"a, b:c","x":"tok"}'
