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

### ha/commands.py and mqtt/bridge.py helpers moved to their own modules (one AST-check ID each)

- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[ha/command_values.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[mqtt/user_get.py]

### Device-plane fuzzing (never raise, never hang, bounded output)

- added: tests/fuzz/test_fuzz_ble_frames_w5_ctw3.py::test_any_data_field_decodes_or_is_skipped
- added: tests/fuzz/test_fuzz_ble_frames_w5_ctw3.py::test_any_bytes_unframe
- added: tests/fuzz/test_fuzz_ble_frames_w5_ctw3.py::test_any_w5_response_parses
- added: tests/fuzz/test_fuzz_ble_frames_w5_ctw3.py::test_any_ctw3_response_parses
- added: tests/fuzz/test_fuzz_ble_frames_w5_ctw3.py::test_any_ctw3_config_tail_decodes
- added: tests/fuzz/test_fuzz_json_bare_token_repair.py::test_repair_never_raises_and_stays_proportionate
- added: tests/fuzz/test_fuzz_json_bare_token_repair.py::test_a_repaired_object_either_parses_or_is_dropped
- added: tests/fuzz/test_fuzz_json_bare_token_repair.py::test_valid_json_survives_repair_unchanged
- added: tests/fuzz/test_fuzz_normalize_http_mqtt.py::test_any_event_report_body_parses
- added: tests/fuzz/test_fuzz_normalize_http_mqtt.py::test_any_event_report_form_normalizes
- added: tests/fuzz/test_fuzz_normalize_http_mqtt.py::test_any_mqtt_event_normalizes
- added: tests/fuzz/test_fuzz_normalize_http_mqtt.py::test_any_property_params_normalize
- added: tests/fuzz/test_fuzz_parse_x_device.py::test_any_header_parses_to_a_dict_or_none
- added: tests/fuzz/test_fuzz_provision_frame_decode.py::test_no_reply_makes_the_decoder_throw

### Reproductions awaiting approval (strict xfail; each becomes a plain test when its fix lands, or is removed if the fix is declined)

- added: tests/test_repro_api_url_local_substring.py::test_an_mdns_local_api_url_is_still_replaced_by_the_host_ip
- added: tests/test_repro_api_url_local_substring.py::test_an_explicit_api_url_merely_containing_dot_local_is_kept[http://my.localdomain.net/6/]
- added: tests/test_repro_api_url_local_substring.py::test_an_explicit_api_url_merely_containing_dot_local_is_kept[http://petkit.localnet:8080/6/]
- added: tests/test_repro_api_url_local_substring.py::test_an_explicit_api_url_merely_containing_dot_local_is_kept[http://10.0.0.7/.local/6/]
- added: tests/test_repro_backfill_beyond_first_page.py::test_backfill_repairs_rows_past_the_first_hundred_thousand
- added: tests/test_repro_bare_token_repair_inside_strings.py::test_repair_leaves_colon_text_inside_a_string_value_alone
- added: tests/test_repro_bare_token_repair_inside_strings.py::test_event_report_keeps_parent_link_when_a_string_contains_colon_text
- added: tests/test_repro_derived_state_across_restart.py::test_litter_box_derived_state_survives_registry_reload
- added: tests/test_repro_derived_state_across_restart.py::test_feeder_daily_totals_survive_registry_reload
- added: tests/test_repro_device_registry_string_petkit_id.py::test_registry_load_survives_a_string_petkit_id
- added: tests/test_repro_device_scoped_commands_and_zones.py::test_an_action_the_model_has_no_button_for_is_refused[t4-pack_waste]
- added: tests/test_repro_device_scoped_commands_and_zones.py::test_an_action_the_model_has_no_button_for_is_refused[d4-dump_litter]
- added: tests/test_repro_device_scoped_commands_and_zones.py::test_an_action_the_model_has_no_button_for_is_refused[w5-feed]
- added: tests/test_repro_device_scoped_commands_and_zones.py::test_an_action_the_model_has_a_button_for_is_still_sent
- added: tests/test_repro_device_scoped_commands_and_zones.py::test_the_heartbeat_queue_stays_bounded_and_keeps_the_newest
- added: tests/test_repro_device_scoped_commands_and_zones.py::test_a_code_reported_by_a_model_outside_its_families_is_logged
- added: tests/test_repro_device_scoped_commands_and_zones.py::test_the_daily_feed_record_id_uses_the_device_zone_not_the_host_zone
- added: tests/test_repro_event_identity_across_devices.py::test_same_event_id_from_two_devices_keeps_one_row_per_device
- added: tests/test_repro_event_identity_across_devices.py::test_timeline_media_is_not_borrowed_from_another_device
- added: tests/test_repro_ha_addon_cli_flags.py::test_flags_override_add_on_options_in_add_on_mode
- added: tests/test_repro_ha_mqtt_host_default.py::test_standalone_run_without_a_broker_leaves_ha_publishing_disabled
- added: tests/test_repro_ha_mqtt_host_default.py::test_publisher_without_a_broker_host_opts_out_without_connecting
- added: tests/test_repro_media_file_info_resend.py::test_resent_file_info_keeps_processed_media_ready
- added: tests/test_repro_media_late_chunks_after_stitch.py::test_late_chunks_after_a_stitch_are_joined_without_losing_footage
- added: tests/test_repro_mqtt_auth_signature_log.py::test_sign_mismatch_does_not_log_the_expected_signature[False]
- added: tests/test_repro_mqtt_auth_signature_log.py::test_sign_mismatch_does_not_log_the_expected_signature[True]
- added: tests/test_repro_mqtt_feed_get_parity.py::test_mqtt_feed_get_answers_the_same_fields_as_http_feed_get
- added: tests/test_repro_panel_app_key_reads.py::test_playing_a_sound_queues_the_command
- added: tests/test_repro_panel_app_key_reads.py::test_selecting_a_sound_queues_the_command
- added: tests/test_repro_panel_app_key_reads.py::test_uploading_a_sound_pushes_the_new_sound_list
- added: tests/test_repro_panel_app_key_reads.py::test_deleting_a_device_unpublishes_its_ha_entities
- added: tests/test_repro_panel_app_key_reads.py::test_deleting_a_device_clears_its_diagnostics
- added: tests/test_repro_panel_media_raw_dir.py::test_panel_media_routes_refuse_the_raw_upload_dir
- added: tests/test_repro_stitch_failure_keeps_chunks.py::test_failed_move_into_place_keeps_every_source_chunk
- added: tests/test_repro_stitch_failure_keeps_chunks.py::test_failed_db_swap_keeps_every_source_chunk

### Panel handlers read app state through the web/appkeys.py constants (one AST-check ID per module)

- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[__init__.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[_common.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[ble.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[devices.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[logs.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[media.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[patchers.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[pets.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[schedules.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[settings.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[sounds.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[talk.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[timeline.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_the_check_catches_both_read_forms

### MQTT CONNECT signature check (constant-time; a non-ASCII password never raises)

- added: tests/test_repro_mqtt_auth_signature_log.py::test_a_non_ascii_password_is_refused_without_raising[False]
- added: tests/test_repro_mqtt_auth_signature_log.py::test_a_non_ascii_password_is_refused_without_raising[True]

### dev_feed_get answers the same over MQTT user/get as over HTTP

- added: tests/test_repro_mqtt_feed_get_parity.py::test_mqtt_and_http_feed_get_agree_value_for_value_at_the_same_instant
- added: tests/test_repro_mqtt_feed_get_parity.py::test_mqtt_feed_get_stays_silent_when_no_schedule_is_stored

### The add-on api_url is replaced only for an mDNS host, matched on the parsed host

- added: tests/test_repro_api_url_local_substring.py::test_other_spellings_of_an_mdns_host_are_still_replaced[http://HomeAssistant.LOCAL:8123/6/]
- added: tests/test_repro_api_url_local_substring.py::test_other_spellings_of_an_mdns_host_are_still_replaced[http://homeassistant.local./6/]
- added: tests/test_repro_api_url_local_substring.py::test_other_spellings_of_an_mdns_host_are_still_replaced[homeassistant.local/6/]
- added: tests/test_repro_api_url_local_substring.py::test_an_api_url_that_does_not_parse_is_kept_rather_than_raising

### Panel command actions are scoped to the model's buttons

- added: tests/test_panel_command_action_validation.py::test_a_non_string_action_is_refused_not_a_server_error[action0]
- added: tests/test_panel_command_action_validation.py::test_a_non_string_action_is_refused_not_a_server_error[action1]
- added: tests/test_panel_command_action_validation.py::test_a_non_string_action_is_refused_not_a_server_error[7]
- added: tests/test_panel_command_action_validation.py::test_an_unknown_action_is_refused_with_the_existing_message
- added: tests/test_panel_command_action_validation.py::test_an_out_of_model_action_queues_nothing
- added: tests/test_panel_command_action_validation.py::test_the_raw_suffix_payload_form_is_not_scoped_by_model

### The heartbeat command queue is capped per device (Device.enqueue_command)

- added: tests/test_device_command_queue_bound.py::test_below_the_cap_nothing_is_dropped_or_logged
- added: tests/test_device_command_queue_bound.py::test_past_the_cap_the_oldest_are_dropped_and_the_device_is_named
- added: tests/test_device_command_queue_bound.py::test_pop_commands_still_drains_everything_oldest_first
- added: tests/test_device_command_queue_bound.py::test_nothing_outside_the_device_model_appends_to_the_queue_directly

### A device request body is read once; one too large to read whole is dropped and logged, never handled truncated

- added: tests/test_device_request_body_read_once.py::test_a_two_mib_event_report_is_parsed_whole
- added: tests/test_device_request_body_read_once.py::test_a_body_over_the_limit_is_dropped_logged_and_answered_success
- added: tests/test_device_request_body_read_once.py::test_the_device_limit_is_above_aiohttps_default_and_below_the_buckets
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/middleware/body.py]
  — the new `http/middleware/body.py` gains the per-module clock check's ID.

## Removed

None.

## Modified (same ID, changed body)

| Test file | Change | Kind | Phase |
|---|---|---|---|
| all files | `petkit_local`/`petkit-local`/`petkitlocal`/`PetKit Local`/`PetKit-Local` renamed by `scripts/rename-from-upstream.sh` | mechanical | import |
| `test_panel.py`, `test_main_lifecycle.py`, `test_panel_script_loads.py`, `test_provision_js.py`, `test_ble_accessories.py`, `test_bounded_growth.py` | paths into the package gain the `src/` segment | mechanical | import |
| `test_version.py` | `config.yaml` and `CHANGELOG.md` read from the repository-root `addon/`; `pyproject.toml` from `services/api/` | mechanical | import |
| `test_state_parsers.py` | real-looking SSID/BSSID fixture replaced by `ExampleNet` / `000000000000`; nothing asserts on it | fixture sanitising | import |
| `test_repro_panel_app_key_reads.py` | strict xfail markers removed now the sound and device-delete handlers read `hub`/`ha_publisher` through `web/appkeys.py`; docstring now describes the wired behaviour; unused `pytest` import dropped | xfail removed | fix |
| `test_repro_mqtt_auth_signature_log.py` | strict xfail marker removed now a sign mismatch logs pk/dn/signmethod and no signature; docstring in the past tense | xfail removed | fix |
| `test_repro_mqtt_feed_get_parity.py` | strict xfail marker removed now MQTT user/get builds dev_feed_get with the HTTP handler's builder; docstring in the past tense; unused `pytest` import dropped | xfail removed | fix |
| `test_repro_ha_mqtt_host_default.py` | strict xfail markers removed now the standalone `Config` and `HAPublisher` default `ha_mqtt_host` to empty; docstring in the past tense | xfail removed | fix |
| `test_repro_ha_addon_cli_flags.py` | strict xfail marker removed now `build_config` applies the flags after either config source; docstring in the past tense; unused `pytest` import dropped | xfail removed | fix |
| `test_repro_api_url_local_substring.py` | strict xfail marker removed now `.local` is matched on the parsed host; docstring in the past tense | xfail removed | fix |
| `test_repro_device_scoped_commands_and_zones.py` | strict xfail marker removed from `test_an_action_the_model_has_no_button_for_is_refused` now a named action needs a button on the model; the file's other tests unchanged | xfail removed | fix |
| `test_repro_device_scoped_commands_and_zones.py` | strict xfail marker removed from `test_the_heartbeat_queue_stays_bounded_and_keeps_the_newest` now `Device.enqueue_command` caps the queue at 64 | xfail removed | fix |
