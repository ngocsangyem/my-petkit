"""T6 camera pan, driven through the firmware's own `pktool`.

The Purobot Ultra's camera sits on one horizontal stepper behind `/dev/motor`
(`pk_motor.ko`, loaded by `app_init.sh` with `maxstep=2500`). PetKit's app pans
it over Agora RTM, an end-to-end channel that never touches the cloud we stand
in for, so there is no cloud command to reproduce. What the device does ship is
`/app/bin/pktool`, a factory tool whose `motor_test` sub-command issues the
driver's ioctls directly:

* `motor_test 2 <steps>` - relative move; negative steps print "ptz turn left".
* `motor_test 3 <coord>` - absolute move.
* `motor_test 4`         - status, `coord0=<now>,target0=<goal>`.

Measured on a T6 (firmware 951, app `T6-262561`, 2026-10-29), facing the box:
2500 points the camera into the drum, which is where the firmware parks it;
1250 is a quarter turn to the left; every move landed on the exact step count
and the readback matched. The kernel clamps every target to `[0, maxstep]`
itself, so a step past either end simply stops there.

What this path does NOT have, and why it is an opt-in patcher at all: `ctrl`
owns the motor in normal use, with an arbitration lock and a userspace ADC
stall monitor, and `pktool` bypasses both. The kernel driver has no limit or
stall sensing of its own - only the software clamp - so a step counter that has
drifted (say, power lost mid-move) can drive the head into its hard stop with
nothing to notice. Three guards narrow that: every press runs only if pktool
is still the build its commands were read from; every move first reads the
status and is skipped unless the motor is idle (`coord == target`), so it
never races a move `ctrl` is making; and `ha/commands.py` refuses a pan while
the Camera switch is off, so a pan cannot turn the head back out of privacy
mode.

Nothing is written to the device: applying only verifies that the firmware is
the one these commands were read from, and records the opt-in. Every shell line
below is a constant - no caller-supplied value is ever interpolated into one -
and `send_pan_command` refuses anything that is not one of them.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from my_petkit.patchers.common import send_run_cmd

if TYPE_CHECKING:  # pragma: no cover - typing only
    from my_petkit.devices.base import Device

log = logging.getLogger(__name__)

PATCHER_ID = "pan"

#: The only model with a pan motor.
PAN_DEVICE_TYPES = frozenset({"t6"})

#: `pktool`'s md5 on the firmware the `motor_test` indices were read from. A
#: different build may number the actions differently, so applying refuses it
#: rather than guessing.
KNOWN_PKTOOL_MD5 = frozenset({
    "626fce2bb4febf259e2a8490af3c17b5",  # T6 firmware 951, app T6-262561
})

#: The travel `pk_motor.ko` is loaded with, and where the firmware parks the
#: camera (pointing into the drum).
MAX_STEP = 2500
HOME_COORD = MAX_STEP

#: One press: a tenth of the travel, about 18 degrees.
PAN_STEP = 250

#: `pktool` links against libraries outside the default search path; this is
#: the `LD_LIBRARY_PATH` `app_init.sh` exports before starting the firmware.
_PKTOOL = ("cd /app/bin && export LD_LIBRARY_PATH=/app/bin:/syslib/lib:/system/alg_lib"
           " && ./pktool motor_test")

#: Read the status and continue only when the motor is idle. Busybox here has
#: no `awk`/`cut`/`tr`, so the `coord0=<now>,target0=<goal>` line is taken apart
#: with shell parameter expansion, which ash has.
_IF_IDLE = (f"s=$({_PKTOOL} 4 | grep -m 1 coord0=); c=${{s#coord0=}}; c=${{c%%,*}};"
            f" t=${{s##*target0=}}; [ -n \"$c\" ] && [ \"$c\" = \"$t\" ] && {_PKTOOL}")

#: The opt-in survives an app OTA, which can replace pktool, so every press
#: re-checks the checksum before it moves anything. `case` rather than `[ = ]`
#: so more than one known build can be listed.
_IF_KNOWN = ("case \"$(md5sum /app/bin/pktool)\" in "
             + "|".join(f"{m}*" for m in sorted(KNOWN_PKTOOL_MD5)) + ") ")


def _guarded(motor_args: str) -> str:
    """One press: known pktool, idle motor, then `motor_test <motor_args>`."""
    return f"{_IF_KNOWN}{_IF_IDLE} {motor_args};; esac"


#: Button key -> the exact shell line it sends. Constants only.
PAN_COMMANDS: dict[str, str] = {
    "pan_left": _guarded(f"2 -{PAN_STEP}"),
    "pan_right": _guarded(f"2 {PAN_STEP}"),
    "pan_home": _guarded(f"3 {HOME_COORD}"),
}

_KEY_FOR_LINE = {line: key for key, line in PAN_COMMANDS.items()}

#: Read back what applying checks: the tool's checksum and the live travel.
VERIFY_COMMAND = "md5sum /app/bin/pktool; cat /sys/module/pk_motor/parameters/maxstep"


def is_active(device: Device) -> bool:
    """Whether the operator opted this device into camera pan."""
    return (device.device_type.lower() in PAN_DEVICE_TYPES
            and PATCHER_ID in device.config.get("active_patchers", []))


def verify_problem(output: str | None) -> str:
    """Why `VERIFY_COMMAND`'s output rules this device out, or "" if it fits.

    Args:
        output: What the device printed, or None when it never answered.
    """
    if output is None:
        return "the device did not answer the firmware check"
    words = output.split()
    md5 = words[0].lower() if words else ""
    if md5 not in KNOWN_PKTOOL_MD5:
        return "pktool is not the build these commands were read from"
    if words[-1] != str(MAX_STEP):
        return f"the pan motor's travel is not {MAX_STEP} steps"
    return ""


async def send_pan_command(device: Device, envelope: Any, bridge: Any = None) -> str:
    """Deliver one pan line built by `ha/commands.py`; returns the transport.

    The run_cmd path is root on the box, so this re-checks what it is handed
    rather than trusting the caller: only one of `PAN_COMMANDS` goes out.

    Raises:
        ValueError: the envelope does not carry one of the pan lines.
    """
    line = envelope.get("run_cmd") if isinstance(envelope, dict) else None
    if not isinstance(line, str) or line not in _KEY_FOR_LINE:
        raise ValueError("not a camera pan command")
    key = _KEY_FOR_LINE[line]
    # `send_run_cmd` logs only the line's start, which is the same guard for
    # all three, so name the button here.
    log.info("Camera pan %s for device %d", key, device.petkit_id)
    return await send_run_cmd(device, line, bridge)


PATCHER_INFO: dict[str, Any] = {
    "id": PATCHER_ID,
    "name": "Camera Pan (T6)",
    "description": (
        "Adds Pan Left, Pan Right and Pan Home buttons for the Purobot Ultra's "
        "camera. Each press moves the head a tenth of its travel (about 18 "
        "degrees); Pan Home turns it back into the drum, where the firmware "
        "parks it.\n\n"
        "What it does: nothing is written to the device. Applying checks that "
        "the firmware's own pktool tool is the build these commands were read "
        "from, then enables the buttons; each press runs pktool's motor_test "
        "on the device. Removing it takes the buttons away again. No reboot "
        "either way.\n\n"
        "Read before applying: pktool drives the motor directly, around the "
        "firmware's own motor control, so these moves do not get its stall "
        "detection. The motor driver still stops every move at the ends of the "
        "travel, a press is skipped while the motor is already moving, and the "
        "buttons do nothing while the Camera switch is off. If the head ever "
        "grinds at an end, stop using the buttons and power-cycle the device "
        "so the firmware re-homes it."
    ),
    # Nothing of ours lands on the device.
    "files": [],
    "arch": None,
    "needs_bytes": 0,
}
