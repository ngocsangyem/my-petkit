"""The management panel: the human-facing side of the add-on.

Everything a person does that Home Assistant entities cannot express lives
here - inspecting a device's raw state, browsing the timeline and its media,
managing pets, and running the on-device patchers. `panel.py` builds the
application and registers every route, `features/` holds the handlers behind
them, `shared/appkeys.py` documents what they read off the application, `spa.py`
serves the web app's build (`apps/web`) at `/`, `static/bin/` holds the dropbear
binaries the ssh patcher installs (read from disk, never served), and `hub.py`
is the pub/sub that pushes live progress and new media to an open page over
WebSocket.

Strictly a consumer: the panel reads the registry, the event store and the
device command queues, and never talks to a device itself.
"""
