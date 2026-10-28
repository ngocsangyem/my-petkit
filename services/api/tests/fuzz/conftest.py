"""Hypothesis profiles for the device-plane fuzz tests.

Everything these tests feed in is what an unauthenticated device, or anything
else on the LAN, can send. The contract under test is the device-plane
invariant: the parser returns (some value, possibly empty), it never raises,
never hangs, and never builds output out of proportion to its input.

Profiles (select with HYPOTHESIS_PROFILE):
  ci       ~200 examples per test, run on every pull request (default)
  nightly  10x that, with a longer deadline, for the scheduled run
"""

import os

from hypothesis import HealthCheck, settings

settings.register_profile(
    "ci", max_examples=200, deadline=500, derandomize=True,
    suppress_health_check=[HealthCheck.too_slow],
)
settings.register_profile(
    "nightly", max_examples=2000, deadline=2000,
    suppress_health_check=[HealthCheck.too_slow],
)
settings.load_profile(os.environ.get("HYPOTHESIS_PROFILE", "ci"))

#: Output may legitimately be larger than input (a decoded field gains a key
#: name), but never by more than this factor plus a fixed allowance.
OUTPUT_GROWTH_FACTOR = 64
OUTPUT_ALLOWANCE = 4096


def bounded(result: object, input_size: int) -> bool:
    """Whether `result`, rendered, stays proportionate to an input of `input_size`."""
    return len(repr(result)) <= OUTPUT_GROWTH_FACTOR * input_size + OUTPUT_ALLOWANCE
