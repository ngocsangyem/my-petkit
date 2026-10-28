# Test ledger

Every difference between the collected test IDs and `baseline-test-ids.txt` (the upstream suite at
`9f86e22`, renamed) is declared here. `test_collected_ids_match_baseline.py` parses the lines that
start with `- added:` or `- removed:`; everything else in this file is for people.

A test whose **body** changed without its ID changing is also recorded, under "Modified", so a
reviewer can find every place the suite was touched.

## Added

- added: tests/test_collected_ids_match_baseline.py::test_ledger_entries_do_not_contradict_each_other
  — guards this ledger. (import)
- added: tests/test_collected_ids_match_baseline.py::test_collected_ids_match_baseline_plus_ledger
  — the baseline gate itself. (import)

### Listener bind addresses (each listener binds its own configured address)

- added: tests/test_listener_bind_addresses.py::test_defaults_bind_what_upstream_bound
- added: tests/test_listener_bind_addresses.py::test_a_bind_host_that_is_not_an_ip_literal_is_refused[localhost-device_bind_host]
- added: tests/test_listener_bind_addresses.py::test_a_bind_host_that_is_not_an_ip_literal_is_refused[localhost-mqtt_plain_bind]
- added: tests/test_listener_bind_addresses.py::test_a_bind_host_that_is_not_an_ip_literal_is_refused[localhost-user_bind_host]
- added: tests/test_listener_bind_addresses.py::test_a_bind_host_that_is_not_an_ip_literal_is_refused[-device_bind_host]
- added: tests/test_listener_bind_addresses.py::test_a_bind_host_that_is_not_an_ip_literal_is_refused[-mqtt_plain_bind]
- added: tests/test_listener_bind_addresses.py::test_a_bind_host_that_is_not_an_ip_literal_is_refused[-user_bind_host]
- added: tests/test_listener_bind_addresses.py::test_a_bind_host_that_is_not_an_ip_literal_is_refused[0.0.0.0; rm -rf /-device_bind_host]
- added: tests/test_listener_bind_addresses.py::test_a_bind_host_that_is_not_an_ip_literal_is_refused[0.0.0.0; rm -rf /-mqtt_plain_bind]
- added: tests/test_listener_bind_addresses.py::test_a_bind_host_that_is_not_an_ip_literal_is_refused[0.0.0.0; rm -rf /-user_bind_host]
- added: tests/test_listener_bind_addresses.py::test_a_bind_host_that_is_not_an_ip_literal_is_refused[10.0.0.300-device_bind_host]
- added: tests/test_listener_bind_addresses.py::test_a_bind_host_that_is_not_an_ip_literal_is_refused[10.0.0.300-mqtt_plain_bind]
- added: tests/test_listener_bind_addresses.py::test_a_bind_host_that_is_not_an_ip_literal_is_refused[10.0.0.300-user_bind_host]
- added: tests/test_listener_bind_addresses.py::test_ip_literals_are_accepted[127.0.0.1]
- added: tests/test_listener_bind_addresses.py::test_ip_literals_are_accepted[::1]
- added: tests/test_listener_bind_addresses.py::test_ip_literals_are_accepted[192.168.1.10]
- added: tests/test_listener_bind_addresses.py::test_rtsp_bind_accepts_host_port_forms[:8554]
- added: tests/test_listener_bind_addresses.py::test_rtsp_bind_accepts_host_port_forms[127.0.0.1:8554]
- added: tests/test_listener_bind_addresses.py::test_rtsp_bind_accepts_host_port_forms[[::1]:8554]
- added: tests/test_listener_bind_addresses.py::test_rtsp_bind_rejects_malformed_values[8554]
- added: tests/test_listener_bind_addresses.py::test_rtsp_bind_rejects_malformed_values[host:8554]
- added: tests/test_listener_bind_addresses.py::test_rtsp_bind_rejects_malformed_values[:0]
- added: tests/test_listener_bind_addresses.py::test_rtsp_bind_rejects_malformed_values[:99999]
- added: tests/test_listener_bind_addresses.py::test_rtsp_bind_rejects_malformed_values[]
- added: tests/test_listener_bind_addresses.py::test_cli_flags_set_each_bind
- added: tests/test_listener_bind_addresses.py::test_a_bad_bind_flag_stops_config_before_anything_binds
- added: tests/test_listener_bind_addresses.py::test_addon_options_set_each_bind
- added: tests/test_listener_bind_addresses.py::test_start_site_binds_the_configured_host
- added: tests/test_listener_bind_addresses.py::test_an_unbindable_address_fails_with_the_listener_and_setting_named
- added: tests/test_listener_bind_addresses.py::test_broker_listener_addresses_bracket_ipv6
- added: tests/test_listener_bind_addresses.py::test_go2rtc_rtsp_listen_follows_the_setting
- added: tests/test_listener_bind_addresses.py::test_no_listener_hard_codes_all_interfaces

### Local time through one clock (process zone, DST-aware; no naive calendar call outside it)

- added: tests/test_clock.py::test_frozen_pins_now_and_restores_it
- added: tests/test_clock.py::test_local_datetime_matches_localtime_in_the_process_zone
- added: tests/test_clock.py::test_the_spring_forward_day_is_23_hours_long
- added: tests/test_clock.py::test_the_fall_back_day_is_25_hours_long
- added: tests/test_clock.py::test_offset_hours_follows_dst
- added: tests/test_clock.py::test_the_repeated_hour_keeps_its_offset
- added: tests/test_clock.py::test_zone_for_is_the_process_zone_today
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ai/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ai/pets.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[config.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[devices/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[devices/base.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[devices/ble/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[devices/ble/ctw3.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[devices/ble/framing.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[devices/ble/registry.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[devices/ble/w5.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[devices/consumables.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[devices/defaults.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[devices/payloads.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[devices/registry.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[devices/state_parsers.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[devices/state_tables.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[events/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[events/codes.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[events/decode.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[events/ingest.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[events/migrations.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[events/models.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[events/normalize.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[events/sessions.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[events/store.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ha/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ha/categories.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ha/command_router.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ha/commands.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ha/discovery.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ha/entities/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ha/entities/ble.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ha/entities/buttons.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ha/entities/camera.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ha/entities/events.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ha/entities/numbers.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ha/entities/pet.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ha/entities/selects.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ha/entities/sensors.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ha/entities/switches.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ha/entities/text.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ha/entities/times.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ha/publisher.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/bucket.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/cloud_fetch.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/dns.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/handlers/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/handlers/_common.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/handlers/ble_device.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/handlers/discern.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/handlers/feed.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/handlers/heartbeat.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/handlers/iot_device_info.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/handlers/k3_device_info.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/handlers/schedule.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/handlers/serverinfo.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/handlers/signup.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/handlers/state_report.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/handlers/stubs.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/handlers/upload_file_info.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/handlers/upload_log.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/middleware/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/middleware/device.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/middleware/logging.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/middleware/proxy.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/proxy.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/redact/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/redact/rules.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/redact/walker.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/server.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[main/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[main/__main__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[main/cli.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[main/lifecycle.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[main/wiring.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[media/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[media/crypto.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[media/go2rtc.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[media/layout.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[media/pipeline.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[media/retention.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[media/stitch.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[media/transcode.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[mqtt/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[mqtt/auth.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[mqtt/ble_relay.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[mqtt/bridge.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[mqtt/broker.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[mqtt/topics.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[mqtt/upstream.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[patchers/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[patchers/cacert.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[patchers/camera.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[patchers/cloud.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[patchers/common.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[patchers/mqtt.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[patchers/ssh.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[patchers/talk.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[patchers/verify.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[utils/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[utils/capture.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[utils/coerce.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[utils/const.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[utils/crypto.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[utils/dicts.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[utils/jsonio.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[utils/logtext.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[utils/paths.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[utils/timeutil.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[web/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[web/api/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[web/api/_common.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[web/api/ble.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[web/api/devices.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[web/api/logs.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[web/api/media.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[web/api/patchers.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[web/api/pets.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[web/api/schedules.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[web/api/settings.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[web/api/sounds.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[web/api/talk.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[web/api/timeline.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[web/appkeys.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[web/hub.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[web/panel.py]
- added: tests/test_no_naive_calendar_calls.py::test_the_detector_catches_each_forbidden_form
- added: tests/test_no_naive_calendar_calls.py::test_the_detector_allows_explicit_zones

### events/store.py split into per-table query modules (the per-module AST check gains one ID each)

- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[events/store_base.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[events/store_blocked_attempts.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[events/store_media.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[events/store_pets.py]

## Removed

None.

## Modified (same ID, changed body)

| Test file | Change | Kind | Phase |
|---|---|---|---|
| all files | `petkit_local`/`petkit-local`/`petkitlocal`/`PetKit Local`/`PetKit-Local` renamed by `scripts/rename-from-upstream.sh` | mechanical | import |
| `test_panel.py`, `test_main_lifecycle.py`, `test_panel_script_loads.py`, `test_provision_js.py`, `test_ble_accessories.py`, `test_bounded_growth.py` | paths into the package gain the `src/` segment | mechanical | import |
| `test_version.py` | `config.yaml` and `CHANGELOG.md` read from the repository-root `addon/`; `pyproject.toml` from `services/api/` | mechanical | import |
| `test_state_parsers.py` | real-looking SSID/BSSID fixture replaced by `ExampleNet` / `000000000000`; nothing asserts on it | fixture sanitising | import |
