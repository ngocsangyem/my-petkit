"""The BLE provisioning reply decoder (`pkParse` in the panel's provision.js).

It reads whatever a device in pairing mode notifies, so its input is anything
a radio neighbour can send. Hypothesis builds a batch of frames, one node
process decodes them all, and any input that makes the decoder throw (rather
than return null) is reported back.
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

PROVISION_JS = (Path(__file__).resolve().parents[2] / "src" / "my_petkit" / "web" / "static"
                / "js" / "provision.js")

pytestmark = pytest.mark.skipif(shutil.which("node") is None,
                                reason="node is needed to run the panel's JavaScript")

_HEADER = st.just(b"\xfa\xfc\xfd\x46")
_FRAMED = st.tuples(_HEADER, st.binary(min_size=0, max_size=300)).map(lambda t: t[0] + t[1])
_JSONISH = st.text(max_size=200).map(lambda s: s.encode("utf-8", "surrogatepass"))
_FRAME = st.one_of(_FRAMED, st.binary(max_size=300), _JSONISH)

_DECODE_ALL = """
globalThis.location = {pathname: '/'};
globalThis.document = {addEventListener() {}};
const {pkParse, pkJoinState} = await import(%(module)s);
const inputs = JSON.parse(%(inputs)s);
const thrown = [];
for (const hex of inputs) {
  const bytes = new Uint8Array(hex.match(/../g) ? hex.match(/../g).map(h => parseInt(h, 16)) : []);
  try {
    const doc = pkParse(bytes);
    if (doc && typeof doc === 'object') pkJoinState(doc.payload);
  } catch (e) {
    thrown.push([hex, String(e)]);
  }
}
console.log(JSON.stringify({count: inputs.length, thrown}));
"""


# One node process per batch of 200 frames; the nightly profile runs more batches.
@settings(max_examples=max(1, settings.default.max_examples // 200), deadline=None)
@given(st.lists(_FRAME, min_size=200, max_size=200))
def test_no_reply_makes_the_decoder_throw(frames):
    inputs = json.dumps([f.hex() for f in frames])
    script = _DECODE_ALL % {"module": repr(PROVISION_JS.as_uri()), "inputs": repr(inputs)}
    proc = subprocess.run(["node", "--input-type=module", "-e", script],  # noqa: S603, S607
                          capture_output=True, text=True, timeout=60, check=False)
    assert proc.returncode == 0, proc.stderr
    report = json.loads(proc.stdout)
    assert report["count"] == len(frames)
    assert report["thrown"] == []
