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

- added: tests/test_listener_bind_addresses.py::test_defaults_bind_what_upstream_bound_except_plain_mqtt_on_loopback
  — renamed from `test_defaults_bind_what_upstream_bound` when plain MQTT moved to loopback.
- added: tests/test_listener_bind_addresses.py::test_mqtt_plain_expose_restores_every_interface
- added: tests/test_listener_bind_addresses.py::test_mqtt_plain_expose_flag_and_addon_option
- added: tests/test_listener_bind_addresses.py::test_the_addon_schema_offers_mqtt_plain_expose
- added: tests/test_listener_bind_addresses.py::test_the_broker_binds_plain_mqtt_to_loopback_by_default
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
- added: tests/test_clock.py::test_the_spring_forward_day_is_23_hours_long
- added: tests/test_clock.py::test_the_fall_back_day_is_25_hours_long
- added: tests/test_clock.py::test_offset_hours_follows_dst
- added: tests/test_clock.py::test_the_repeated_hour_keeps_its_offset
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

### Event fixes (tests added beside the reproductions they close)

- added: tests/test_repro_event_identity_across_devices.py::test_a_retried_report_from_the_same_device_still_updates_its_row
- added: tests/test_repro_event_identity_across_devices.py::test_connect_collapses_duplicate_keys_before_adding_the_unique_index
- added: tests/test_repro_bare_token_repair_inside_strings.py::test_repair_honours_escaped_quotes_inside_a_string
- added: tests/test_repro_device_registry_string_petkit_id.py::test_registry_load_skips_only_an_entry_whose_petkit_id_is_not_a_number
- added: tests/test_repro_derived_state_across_restart.py::test_replay_leaves_a_device_with_no_stored_events_unknown
- added: tests/test_repro_derived_state_across_restart.py::test_start_up_replays_derived_state_after_the_backfill
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[events/derived_state_replay.py]

### Approved media fixes

- added: tests/test_repro_stitch_failure_keeps_chunks.py::test_successful_stitch_never_overwrites_a_source_and_then_removes_them
- added: tests/test_repro_stitch_failure_keeps_chunks.py::test_failed_stitch_leaves_only_the_source_chunks_on_disk[move]
- added: tests/test_repro_stitch_failure_keeps_chunks.py::test_failed_stitch_leaves_only_the_source_chunks_on_disk[swap]
- added: tests/test_repro_media_late_chunks_after_stitch.py::test_late_chunks_replace_a_stitched_row_whose_file_is_gone
- added: tests/test_repro_media_late_chunks_after_stitch.py::test_a_clip_that_cannot_be_extended_keeps_everything
- added: tests/test_media_stitch.py::test_late_chunks_extend_the_stitched_clip_with_real_ffmpeg
- added: tests/test_repro_panel_media_raw_dir.py::test_panel_media_routes_still_serve_the_friendly_tree_and_hide_dot_files
- added: tests/test_repro_media_file_info_resend.py::test_resent_file_info_with_fresh_bytes_keeps_the_filed_copy
- added: tests/test_repro_media_file_info_resend.py::test_a_ready_row_whose_file_is_gone_is_processed_again
- added: tests/test_ingest_endpoints.py::test_a_replayed_upload_file_info_answers_success_and_keeps_the_item_ready

### Session lookups scoped to the device (completes per-device event identity)

- added: tests/test_session_lookups_are_scoped_to_the_device.py::test_event_lookup_by_session_ignores_another_devices_event
- added: tests/test_session_lookups_are_scoped_to_the_device.py::test_media_lookup_by_session_ignores_another_devices_media
- added: tests/test_session_lookups_are_scoped_to_the_device.py::test_stitched_clip_ids_differ_per_device

### Panel handlers read app state through the web/appkeys.py constants (one AST-check ID per module)

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

### Local time from the configured zone, then the device locale, then UTC

- added: tests/test_clock.py::test_local_datetime_reads_the_configured_zone
- added: tests/test_clock.py::test_the_configured_zone_wins_over_the_device_locale_and_the_host
- added: tests/test_clock.py::test_without_configuration_the_device_locale_is_used
- added: tests/test_clock.py::test_without_configuration_or_locale_local_time_is_utc_with_a_warning
- added: tests/test_clock.py::test_an_unknown_configured_zone_is_refused

### User plane moved to features/ and shared/ (per-module checks follow the files; device sound-list reproduction)

- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[devices/sound_store.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/ble/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/ble/routes.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/devices/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/devices/routes.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/logs/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/logs/routes.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/media/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/media/routes.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/patchers/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/patchers/routes.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/pets/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/pets/routes.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/schedules/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/schedules/routes.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/setup/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/setup/routes.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/sounds/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/sounds/routes.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/talk/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/talk/routes.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/timeline/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/timeline/routes.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[shared/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[shared/appkeys.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[shared/background_tasks.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[shared/live_settings.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[shared/media_slots.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[shared/panel_request.py]
- added: tests/test_repro_device_sound_list.py::test_an_uploaded_sound_is_listed_to_its_device
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/__init__.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/ble/__init__.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/ble/routes.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/devices/__init__.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/devices/routes.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/logs/__init__.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/logs/routes.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/media/__init__.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/media/routes.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/patchers/__init__.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/patchers/routes.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/pets/__init__.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/pets/routes.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/schedules/__init__.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/schedules/routes.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/setup/__init__.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/setup/routes.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/sounds/__init__.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/sounds/routes.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/talk/__init__.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/talk/routes.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/timeline/__init__.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/timeline/routes.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[shared/__init__.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[shared/appkeys.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[shared/background_tasks.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[shared/live_settings.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[shared/media_slots.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[shared/panel_request.py]

### Default-deny user plane: every route declares a tier; only static files, signed media and the credential exchanges answer without a token

- added: tests/test_auth_every_route_requires_token.py::test_a_panel_without_auth_refuses_everything_but_static
- added: tests/test_auth_every_route_requires_token.py::test_an_undeclared_method_has_no_tier
- added: tests/test_auth_every_route_requires_token.py::test_an_unknown_path_reveals_nothing_without_a_token
- added: tests/test_auth_every_route_requires_token.py::test_every_non_exempt_route_refuses_a_request_without_a_token
- added: tests/test_auth_every_route_requires_token.py::test_every_route_declares_a_tier
- added: tests/test_auth_every_route_requires_token.py::test_only_the_named_routes_are_credential_exchanges
- added: tests/test_auth_every_route_requires_token.py::test_signed_media_without_a_signature_is_refused
- added: tests/test_auth_every_route_requires_token.py::test_static_shell_needs_no_token
- added: tests/test_auth_every_route_requires_token.py::test_the_websockets_are_covered

### Host allowlist and exact-Origin check on every unsafe method and WebSocket upgrade

- added: tests/test_ws_origin_allowlist.py::test_a_cross_origin_post_with_a_cookie_is_refused
- added: tests/test_ws_origin_allowlist.py::test_a_cross_origin_websocket_upgrade_is_refused[/api/devices/1/talk]
- added: tests/test_ws_origin_allowlist.py::test_a_cross_origin_websocket_upgrade_is_refused[/api/ws]
- added: tests/test_ws_origin_allowlist.py::test_a_rebound_host_name_is_refused_on_writes
- added: tests/test_ws_origin_allowlist.py::test_a_same_origin_websocket_upgrade_is_accepted
- added: tests/test_ws_origin_allowlist.py::test_a_token_client_without_origin_may_upgrade
- added: tests/test_ws_origin_allowlist.py::test_a_websocket_upgrade_without_origin_on_a_cookie_is_refused
- added: tests/test_ws_origin_allowlist.py::test_host_allowlist[-False]
- added: tests/test_ws_origin_allowlist.py::test_host_allowlist[192.168.1.10:8443-True]
- added: tests/test_ws_origin_allowlist.py::test_host_allowlist[None-False]
- added: tests/test_ws_origin_allowlist.py::test_host_allowlist[[::1]:8443-True]
- added: tests/test_ws_origin_allowlist.py::test_host_allowlist[evil.example-False]
- added: tests/test_ws_origin_allowlist.py::test_host_allowlist[localhost:8443-True]
- added: tests/test_ws_origin_allowlist.py::test_host_allowlist[petkit.example.com-True]
- added: tests/test_ws_origin_allowlist.py::test_origin_must_name_exactly_the_requested_host[file://-10.0.0.5-False]
- added: tests/test_ws_origin_allowlist.py::test_origin_must_name_exactly_the_requested_host[http://ha.local:8123-ha.local:8123-True]
- added: tests/test_ws_origin_allowlist.py::test_origin_must_name_exactly_the_requested_host[https://10.0.0.5-10.0.0.5-True]
- added: tests/test_ws_origin_allowlist.py::test_origin_must_name_exactly_the_requested_host[https://10.0.0.5-10.0.0.5:443-True]
- added: tests/test_ws_origin_allowlist.py::test_origin_must_name_exactly_the_requested_host[https://10.0.0.5:8443-10.0.0.5:8443-True]
- added: tests/test_ws_origin_allowlist.py::test_origin_must_name_exactly_the_requested_host[https://10.0.0.5:8443-10.0.0.5:8444-False]
- added: tests/test_ws_origin_allowlist.py::test_origin_must_name_exactly_the_requested_host[https://10.0.0.5:8443-None-False]
- added: tests/test_ws_origin_allowlist.py::test_origin_must_name_exactly_the_requested_host[https://10.0.0.6:8443-10.0.0.5:8443-False]
- added: tests/test_ws_origin_allowlist.py::test_origin_must_name_exactly_the_requested_host[null-10.0.0.5-False]

### Pairing codes and client tokens (128-bit single-use codes, 256-bit hashed tokens, idle expiry, revocation)

- added: tests/test_pairing_flow.py::test_a_code_carries_128_random_bits_and_never_repeats
- added: tests/test_pairing_flow.py::test_a_code_expires_after_five_minutes
- added: tests/test_pairing_flow.py::test_a_code_works_exactly_once
- added: tests/test_pairing_flow.py::test_a_revoked_token_stops_working
- added: tests/test_pairing_flow.py::test_a_token_carries_256_bits
- added: tests/test_pairing_flow.py::test_a_token_expires_after_90_idle_days_and_use_resets_the_clock
- added: tests/test_pairing_flow.py::test_a_wrong_or_oversized_code_is_refused
- added: tests/test_pairing_flow.py::test_only_hashes_reach_the_database
- added: tests/test_pairing_flow.py::test_pairing_end_to_end_gives_a_working_pinned_token

### Rate limits on login, step-up, setup and pairing redeem (per IP, global, exponential backoff)

- added: tests/test_rate_limit.py::test_a_failed_login_is_logged_without_the_password
- added: tests/test_rate_limit.py::test_buckets_are_independent
- added: tests/test_rate_limit.py::test_counters_forget_after_the_window_and_on_success
- added: tests/test_rate_limit.py::test_many_addresses_trip_the_global_limit
- added: tests/test_rate_limit.py::test_one_address_does_not_lock_out_another
- added: tests/test_rate_limit.py::test_pairing_redeem_is_rate_limited
- added: tests/test_rate_limit.py::test_the_first_failures_are_free_then_the_lockout_doubles
- added: tests/test_rate_limit.py::test_the_lockout_is_capped
- added: tests/test_rate_limit.py::test_the_login_endpoint_answers_429_with_retry_after

### Step-up for R3 actions, and the structured audit line they write

- added: tests/test_step_up_r3_routes.py::test_a_step_up_lasts_five_minutes_per_principal
- added: tests/test_step_up_r3_routes.py::test_an_r3_action_with_step_up_gets_past_the_gate[GET-/api/blocked?reveal=1-None]
- added: tests/test_step_up_r3_routes.py::test_an_r3_action_with_step_up_gets_past_the_gate[GET-/api/capture/c.jsonl/download-None]
- added: tests/test_step_up_r3_routes.py::test_an_r3_action_with_step_up_gets_past_the_gate[GET-/api/devicelogs/10/devRun.log?download=1-None]
- added: tests/test_step_up_r3_routes.py::test_an_r3_action_with_step_up_gets_past_the_gate[POST-/api/auth/pairing-None]
- added: tests/test_step_up_r3_routes.py::test_an_r3_action_with_step_up_gets_past_the_gate[POST-/api/devices/10/command-body1]
- added: tests/test_step_up_r3_routes.py::test_an_r3_action_with_step_up_gets_past_the_gate[POST-/api/devices/10/patcher-body0]
- added: tests/test_step_up_r3_routes.py::test_an_r3_action_with_step_up_gets_past_the_gate[POST-/api/settings-body2]
- added: tests/test_step_up_r3_routes.py::test_an_r3_action_without_step_up_is_refused[GET-/api/blocked?reveal=1-None]
- added: tests/test_step_up_r3_routes.py::test_an_r3_action_without_step_up_is_refused[GET-/api/capture/c.jsonl/download-None]
- added: tests/test_step_up_r3_routes.py::test_an_r3_action_without_step_up_is_refused[GET-/api/devicelogs/10/devRun.log?download=1-None]
- added: tests/test_step_up_r3_routes.py::test_an_r3_action_without_step_up_is_refused[POST-/api/auth/pairing-None]
- added: tests/test_step_up_r3_routes.py::test_an_r3_action_without_step_up_is_refused[POST-/api/devices/10/command-body1]
- added: tests/test_step_up_r3_routes.py::test_an_r3_action_without_step_up_is_refused[POST-/api/devices/10/patcher-body0]
- added: tests/test_step_up_r3_routes.py::test_an_r3_action_without_step_up_is_refused[POST-/api/settings-body2]
- added: tests/test_step_up_r3_routes.py::test_an_r3_action_writes_one_audit_line_without_values
- added: tests/test_step_up_r3_routes.py::test_stepping_up_with_the_password_unlocks_r3
- added: tests/test_step_up_r3_routes.py::test_the_entity_command_form_stays_r2

### Settings writes: proxy_* and capture keys are R3

- added: tests/test_settings_key_tiers.py::test_a_proxy_or_capture_write_needs_a_step_up[body0]
- added: tests/test_settings_key_tiers.py::test_a_proxy_or_capture_write_needs_a_step_up[body1]
- added: tests/test_settings_key_tiers.py::test_a_proxy_or_capture_write_needs_a_step_up[body2]
- added: tests/test_settings_key_tiers.py::test_any_other_key_is_r1
- added: tests/test_settings_key_tiers.py::test_every_proxy_and_capture_key_is_r3[capture]
- added: tests/test_settings_key_tiers.py::test_every_proxy_and_capture_key_is_r3[proxy_block_log_upload]
- added: tests/test_settings_key_tiers.py::test_every_proxy_and_capture_key_is_r3[proxy_block_ota]
- added: tests/test_settings_key_tiers.py::test_every_proxy_and_capture_key_is_r3[proxy_block_run_cmd]
- added: tests/test_settings_key_tiers.py::test_every_proxy_and_capture_key_is_r3[proxy_dns]
- added: tests/test_settings_key_tiers.py::test_every_proxy_and_capture_key_is_r3[proxy_local_cvr_window]
- added: tests/test_settings_key_tiers.py::test_every_proxy_and_capture_key_is_r3[proxy_media_real_oss]
- added: tests/test_settings_key_tiers.py::test_every_proxy_and_capture_key_is_r3[proxy_mode]
- added: tests/test_settings_key_tiers.py::test_every_proxy_and_capture_key_is_r3[proxy_mqtt_bridge]
- added: tests/test_settings_key_tiers.py::test_every_proxy_and_capture_key_is_r3[proxy_only]
- added: tests/test_settings_key_tiers.py::test_every_proxy_and_capture_key_is_r3[proxy_upstream]
- added: tests/test_settings_key_tiers.py::test_reading_settings_is_not_r3
- added: tests/test_settings_key_tiers.py::test_the_same_write_after_a_step_up_is_applied

### Client redaction built on the device-facing credential keys

- added: tests/test_client_redaction.py::test_ble_accessories_do_not_carry_their_pairing_secret
- added: tests/test_client_redaction.py::test_every_credential_key_is_masked_in_every_spelling
- added: tests/test_client_redaction.py::test_json_inside_strings_and_plain_text_are_masked
- added: tests/test_client_redaction.py::test_the_endpoints_that_relay_device_data_mask_credentials
- added: tests/test_client_redaction.py::test_the_input_is_not_mutated_and_empty_values_stay_empty
- added: tests/test_client_redaction.py::test_the_websocket_masks_credentials
- added: tests/test_client_redaction.py::test_there_is_no_second_key_list

### Signed media URLs (path-bound, five minutes, Range, HLS re-signing, masked in the access log)

- added: tests/test_signed_media_urls.py::test_a_range_request_goes_through_the_same_check
- added: tests/test_signed_media_urls.py::test_a_signature_does_not_open_another_path
- added: tests/test_signed_media_urls.py::test_a_signed_url_serves_the_file_without_a_token
- added: tests/test_signed_media_urls.py::test_a_tampered_or_expired_signature_is_refused
- added: tests/test_signed_media_urls.py::test_an_hls_playlist_has_every_segment_re_signed
- added: tests/test_signed_media_urls.py::test_nothing_outside_the_media_tree_can_be_signed_valid
- added: tests/test_signed_media_urls.py::test_signed_media_key_is_per_install
- added: tests/test_signed_media_urls.py::test_the_access_log_masks_the_signature

### First-run admin through the CLI or the one-time setup token only

- added: tests/test_bootstrap_setup_token.py::test_a_password_change_voids_existing_sessions
- added: tests/test_bootstrap_setup_token.py::test_a_setup_token_works_once_and_for_thirty_minutes
- added: tests/test_bootstrap_setup_token.py::test_loopback_gets_no_privilege
- added: tests/test_bootstrap_setup_token.py::test_no_token_exists_until_one_is_issued
- added: tests/test_bootstrap_setup_token.py::test_setup_needs_the_token_and_happens_once
- added: tests/test_bootstrap_setup_token.py::test_setup_token_is_logged_at_warning_for_visibility
- added: tests/test_bootstrap_setup_token.py::test_the_cli_refuses_a_weak_password
- added: tests/test_bootstrap_setup_token.py::test_the_cli_sets_the_password_and_signs_everyone_out
- added: tests/test_bootstrap_setup_token.py::test_the_token_is_printed_only_when_there_is_no_admin

### Home Assistant Ingress trusted only on the Ingress port from the Supervisor's exact address

- added: tests/test_ingress_trust_exact_peer_and_port.py::test_a_real_socket_with_ingress_headers_is_refused
- added: tests/test_ingress_trust_exact_peer_and_port.py::test_an_ingress_write_still_needs_its_own_origin
- added: tests/test_ingress_trust_exact_peer_and_port.py::test_forged_ingress_headers_from_another_peer_are_refused
- added: tests/test_ingress_trust_exact_peer_and_port.py::test_no_ingress_port_means_no_ingress_trust
- added: tests/test_ingress_trust_exact_peer_and_port.py::test_the_supervisor_needs_no_token
- added: tests/test_ingress_trust_exact_peer_and_port.py::test_the_supervisor_on_the_tls_port_still_needs_a_token
- added: tests/test_ingress_trust_exact_peer_and_port.py::test_trust_needs_both_the_port_and_the_exact_peer[127.0.0.1-8099-False]
- added: tests/test_ingress_trust_exact_peer_and_port.py::test_trust_needs_both_the_port_and_the_exact_peer[172.30.32.1-8099-False]
- added: tests/test_ingress_trust_exact_peer_and_port.py::test_trust_needs_both_the_port_and_the_exact_peer[172.30.32.2-8099-True]
- added: tests/test_ingress_trust_exact_peer_and_port.py::test_trust_needs_both_the_port_and_the_exact_peer[172.30.32.2-8443-False]
- added: tests/test_ingress_trust_exact_peer_and_port.py::test_trust_needs_both_the_port_and_the_exact_peer[172.30.32.3-8099-False]
- added: tests/test_ingress_trust_exact_peer_and_port.py::test_trust_needs_both_the_port_and_the_exact_peer[192.168.1.20-8099-False]
- added: tests/test_ingress_trust_exact_peer_and_port.py::test_trust_needs_both_the_port_and_the_exact_peer[::ffff:172.30.32.2-8099-True]

### Auth database, per-install keys and user-plane TLS material are private

- added: tests/test_auth_data_file_permissions.py::test_a_loose_existing_file_is_tightened
- added: tests/test_auth_data_file_permissions.py::test_auth_db_and_keys_are_created_private
- added: tests/test_auth_data_file_permissions.py::test_keys_are_per_install_and_stable_across_restarts
- added: tests/test_auth_data_file_permissions.py::test_the_certificate_is_kept_so_its_pinned_fingerprint_holds
- added: tests/test_auth_data_file_permissions.py::test_two_installs_never_share_a_certificate
- added: tests/test_auth_data_file_permissions.py::test_user_tls_certificate_and_key_are_private

### Error envelope, JSON-only bodies, security headers, no CORS

- added: tests/test_user_plane_errors_and_headers.py::test_a_flat_error_becomes_the_envelope_with_its_text_kept
- added: tests/test_user_plane_errors_and_headers.py::test_a_handler_500_with_an_os_error_text_is_masked
- added: tests/test_user_plane_errors_and_headers.py::test_a_json_body_without_the_json_content_type_is_refused
- added: tests/test_user_plane_errors_and_headers.py::test_an_unexpected_exception_is_a_500_with_a_correlation_id_and_no_detail
- added: tests/test_user_plane_errors_and_headers.py::test_every_response_carries_the_security_headers_and_no_cors

### Web sessions (signed cookie, idle and absolute limits, logout, password epoch)

- added: tests/test_web_sessions.py::test_a_forged_or_foreign_cookie_is_refused
- added: tests/test_web_sessions.py::test_a_refresh_is_not_issued_on_every_request
- added: tests/test_web_sessions.py::test_a_session_survives_activity_but_not_twelve_idle_hours
- added: tests/test_web_sessions.py::test_logout_ends_the_session
- added: tests/test_web_sessions.py::test_no_session_outlives_seven_days

### New user-plane modules join the per-module checks (local time through the clock; app state through appkeys constants)

- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/auth/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/auth/bootstrap.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/auth/install_secrets.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/auth/middleware.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/auth/pairing.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/auth/passwords.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/auth/rate_limit.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/auth/routes.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/auth/schemas.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/auth/security_headers.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/auth/service.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/auth/sessions.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/auth/signed_media.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/auth/step_up.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/auth/store.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/auth/tokens.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[shared/errors.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[shared/redact_client.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[shared/request_auth.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[shared/tiers.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[utils/user_tls.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/auth/__init__.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/auth/bootstrap.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/auth/install_secrets.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/auth/middleware.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/auth/pairing.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/auth/passwords.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/auth/rate_limit.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/auth/routes.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/auth/schemas.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/auth/security_headers.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/auth/service.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/auth/sessions.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/auth/signed_media.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/auth/step_up.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/auth/store.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/auth/tokens.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[shared/errors.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[shared/redact_client.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[shared/request_auth.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[shared/tiers.py]

### A client without an Aliyun-shaped MQTT id is accepted only from loopback

- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_the_internal_bridge_on_loopback_is_accepted[127.0.0.1-False]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_the_internal_bridge_on_loopback_is_accepted[127.0.0.1-True]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_the_internal_bridge_on_loopback_is_accepted[127.0.0.53-False]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_the_internal_bridge_on_loopback_is_accepted[127.0.0.53-True]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_the_internal_bridge_on_loopback_is_accepted[::1-False]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_the_internal_bridge_on_loopback_is_accepted[::1-True]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_the_internal_bridge_on_loopback_is_accepted[::ffff:127.0.0.1-False]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_the_internal_bridge_on_loopback_is_accepted[::ffff:127.0.0.1-True]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_a_non_aliyun_client_from_anywhere_else_is_refused[192.168.1.20-False]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_a_non_aliyun_client_from_anywhere_else_is_refused[192.168.1.20-True]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_a_non_aliyun_client_from_anywhere_else_is_refused[10.0.0.5-False]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_a_non_aliyun_client_from_anywhere_else_is_refused[10.0.0.5-True]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_a_non_aliyun_client_from_anywhere_else_is_refused[203.0.113.9-False]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_a_non_aliyun_client_from_anywhere_else_is_refused[203.0.113.9-True]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_a_non_aliyun_client_from_anywhere_else_is_refused[::ffff:192.168.1.20-False]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_a_non_aliyun_client_from_anywhere_else_is_refused[::ffff:192.168.1.20-True]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_a_non_aliyun_client_from_anywhere_else_is_refused[fe80::1-False]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_a_non_aliyun_client_from_anywhere_else_is_refused[fe80::1-True]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_a_non_aliyun_client_from_anywhere_else_is_refused[0.0.0.0-False]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_a_non_aliyun_client_from_anywhere_else_is_refused[0.0.0.0-True]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_a_non_aliyun_client_from_anywhere_else_is_refused[None-False]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_a_non_aliyun_client_from_anywhere_else_is_refused[None-True]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_a_non_aliyun_client_from_anywhere_else_is_refused[localhost-False]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_a_non_aliyun_client_from_anywhere_else_is_refused[localhost-True]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_a_non_aliyun_client_from_anywhere_else_is_refused[garbage-False]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_a_non_aliyun_client_from_anywhere_else_is_refused[garbage-True]
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_the_refusal_holds_before_a_registry_is_set
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_an_empty_client_id_from_the_lan_is_refused
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_a_device_shaped_id_from_the_lan_still_takes_the_device_path
- added: tests/test_mqtt_non_aliyun_requires_loopback.py::test_is_loopback_peer_strips_an_ipv6_zone

### Every connection the server opens to a device goes through utils/outbound_guard.py

- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[utils/outbound_guard.py]
  — the per-module clock check covers the new module.
- added: tests/test_outbound_guard_ssrf.py::test_a_registered_device_reporting_a_forbidden_address_is_refused[8.8.8.8]
- added: tests/test_outbound_guard_ssrf.py::test_a_registered_device_reporting_a_forbidden_address_is_refused[203.0.113.7]
- added: tests/test_outbound_guard_ssrf.py::test_a_registered_device_reporting_a_forbidden_address_is_refused[127.0.0.1]
- added: tests/test_outbound_guard_ssrf.py::test_a_registered_device_reporting_a_forbidden_address_is_refused[::1]
- added: tests/test_outbound_guard_ssrf.py::test_a_registered_device_reporting_a_forbidden_address_is_refused[169.254.169.254]
- added: tests/test_outbound_guard_ssrf.py::test_a_registered_device_reporting_a_forbidden_address_is_refused[fe80::1]
- added: tests/test_outbound_guard_ssrf.py::test_a_registered_device_reporting_a_forbidden_address_is_refused[0.0.0.0]
- added: tests/test_outbound_guard_ssrf.py::test_a_registered_device_reporting_a_forbidden_address_is_refused[224.0.0.1]
- added: tests/test_outbound_guard_ssrf.py::test_a_registered_device_reporting_a_forbidden_address_is_refused[::ffff:127.0.0.1]
- added: tests/test_outbound_guard_ssrf.py::test_a_private_address_no_device_reported_is_refused
- added: tests/test_outbound_guard_ssrf.py::test_anything_but_an_ip_literal_is_refused[]
- added: tests/test_outbound_guard_ssrf.py::test_anything_but_an_ip_literal_is_refused[device.local]
- added: tests/test_outbound_guard_ssrf.py::test_anything_but_an_ip_literal_is_refused[192.168.1.50:8888]
- added: tests/test_outbound_guard_ssrf.py::test_anything_but_an_ip_literal_is_refused[http://192.168.1.50]
- added: tests/test_outbound_guard_ssrf.py::test_anything_but_an_ip_literal_is_refused[192.168.1.050]
- added: tests/test_outbound_guard_ssrf.py::test_anything_but_an_ip_literal_is_refused[None]
- added: tests/test_outbound_guard_ssrf.py::test_a_reported_address_on_a_device_network_is_allowed[10.1.2.3]
- added: tests/test_outbound_guard_ssrf.py::test_a_reported_address_on_a_device_network_is_allowed[172.16.0.9]
- added: tests/test_outbound_guard_ssrf.py::test_a_reported_address_on_a_device_network_is_allowed[172.31.255.1]
- added: tests/test_outbound_guard_ssrf.py::test_a_reported_address_on_a_device_network_is_allowed[192.168.1.50]
- added: tests/test_outbound_guard_ssrf.py::test_a_reported_address_on_a_device_network_is_allowed[fd00::42]
- added: tests/test_outbound_guard_ssrf.py::test_a_mapped_ipv4_device_address_is_canonicalised
- added: tests/test_outbound_guard_ssrf.py::test_a_configured_wireguard_subnet_is_a_device_network
- added: tests/test_outbound_guard_ssrf.py::test_a_wireguard_subnet_cannot_reopen_loopback_or_metadata
- added: tests/test_outbound_guard_ssrf.py::test_with_no_guard_installed_everything_is_refused
- added: tests/test_outbound_guard_ssrf.py::test_a_failing_device_list_fails_closed
- added: tests/test_outbound_guard_ssrf.py::test_the_guard_follows_the_registry_live
- added: tests/test_outbound_guard_ssrf.py::test_an_ipv6_target_is_bracketed_in_a_url
- added: tests/test_outbound_guard_ssrf.py::test_wireguard_subnets_config_accepts_cidrs[value0]
- added: tests/test_outbound_guard_ssrf.py::test_wireguard_subnets_config_accepts_cidrs[value1]
- added: tests/test_outbound_guard_ssrf.py::test_wireguard_subnets_config_refuses_anything_else[value0]
- added: tests/test_outbound_guard_ssrf.py::test_wireguard_subnets_config_refuses_anything_else[value1]
- added: tests/test_outbound_guard_ssrf.py::test_wireguard_subnets_config_refuses_anything_else[10.0.0.0/8]
- added: tests/test_outbound_guard_ssrf.py::test_go2rtc_serves_no_stream_for_a_refused_address[8.8.8.8]
- added: tests/test_outbound_guard_ssrf.py::test_go2rtc_serves_no_stream_for_a_refused_address[127.0.0.1]
- added: tests/test_outbound_guard_ssrf.py::test_go2rtc_serves_no_stream_for_a_refused_address[169.254.169.254]
- added: tests/test_outbound_guard_ssrf.py::test_go2rtc_serves_no_stream_for_a_refused_address[192.168.1.99]
- added: tests/test_outbound_guard_ssrf.py::test_the_go2rtc_probe_never_dials_a_refused_address
- added: tests/test_outbound_guard_ssrf.py::test_the_patcher_read_back_refuses_before_connecting[8.8.8.8]
- added: tests/test_outbound_guard_ssrf.py::test_the_patcher_read_back_refuses_before_connecting[127.0.0.1]
- added: tests/test_outbound_guard_ssrf.py::test_the_patcher_read_back_refuses_before_connecting[169.254.169.254]
- added: tests/test_outbound_guard_ssrf.py::test_the_patcher_read_back_refuses_before_connecting[192.168.1.99]
- added: tests/test_outbound_guard_ssrf.py::test_run_cmd_capture_sends_nothing_to_a_refused_device
- added: tests/test_outbound_guard_ssrf.py::test_device_reads_do_not_follow_redirects
- added: tests/test_outbound_guard_ssrf.py::test_talk_refuses_a_device_address_the_guard_refuses

### proxy_upstream and proxy_dns reach only PetKit and Aliyun IoT hosts

- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[http/upstream_allowlist.py]
  — the per-module clock check covers the new module.
- added: tests/test_proxy_upstream_allowlist.py::test_every_preset_is_on_the_allowlist
- added: tests/test_proxy_upstream_allowlist.py::test_every_region_has_its_api_host_and_the_presets_cover_every_region
- added: tests/test_proxy_upstream_allowlist.py::test_petkit_and_aliyun_hosts_are_allowed[https://api-eu.petkt.com/6/]
- added: tests/test_proxy_upstream_allowlist.py::test_petkit_and_aliyun_hosts_are_allowed[https://api.eu-pet.com]
- added: tests/test_proxy_upstream_allowlist.py::test_petkit_and_aliyun_hosts_are_allowed[https://api.petkt.com]
- added: tests/test_proxy_upstream_allowlist.py::test_petkit_and_aliyun_hosts_are_allowed[https://api.petktasia.com/6/]
- added: tests/test_proxy_upstream_allowlist.py::test_petkit_and_aliyun_hosts_are_allowed[https://api.petkit.cn]
- added: tests/test_proxy_upstream_allowlist.py::test_petkit_and_aliyun_hosts_are_allowed[https://API-RU.PETKIT.CN/6/]
- added: tests/test_proxy_upstream_allowlist.py::test_petkit_and_aliyun_hosts_are_allowed[http://api-eu.petkt.com:80]
- added: tests/test_proxy_upstream_allowlist.py::test_petkit_and_aliyun_hosts_are_allowed[https://a1PK.iot-as-mqtt.eu-central-1.aliyuncs.com]
- added: tests/test_proxy_upstream_allowlist.py::test_petkit_and_aliyun_hosts_are_allowed[https://iot-600a5gmp.mqtt.iothub.aliyuncs.com]
- added: tests/test_proxy_upstream_allowlist.py::test_anything_else_is_refused_where_the_setting_is_written[http://127.0.0.1:8080]
- added: tests/test_proxy_upstream_allowlist.py::test_anything_else_is_refused_where_the_setting_is_written[http://169.254.169.254/latest/meta-data/]
- added: tests/test_proxy_upstream_allowlist.py::test_anything_else_is_refused_where_the_setting_is_written[http://192.168.1.10/6/]
- added: tests/test_proxy_upstream_allowlist.py::test_anything_else_is_refused_where_the_setting_is_written[https://evil.example]
- added: tests/test_proxy_upstream_allowlist.py::test_anything_else_is_refused_where_the_setting_is_written[https://api-eu.petkt.com.evil.example]
- added: tests/test_proxy_upstream_allowlist.py::test_anything_else_is_refused_where_the_setting_is_written[https://evilapi-eu.petkt.com]
- added: tests/test_proxy_upstream_allowlist.py::test_anything_else_is_refused_where_the_setting_is_written[https://user:pw@api-eu.petkt.com]
- added: tests/test_proxy_upstream_allowlist.py::test_anything_else_is_refused_where_the_setting_is_written[ftp://api-eu.petkt.com]
- added: tests/test_proxy_upstream_allowlist.py::test_anything_else_is_refused_where_the_setting_is_written[file:///etc/passwd]
- added: tests/test_proxy_upstream_allowlist.py::test_anything_else_is_refused_where_the_setting_is_written[https://a1PK.iot-as-mqtt.mars-1.aliyuncs.com]
- added: tests/test_proxy_upstream_allowlist.py::test_anything_else_is_refused_where_the_setting_is_written[https://bucket.oss-eu-central-1.aliyuncs.com]
- added: tests/test_proxy_upstream_allowlist.py::test_anything_else_is_refused_where_the_setting_is_written[https://api-eu.petkt.com:99999]
- added: tests/test_proxy_upstream_allowlist.py::test_anything_else_is_refused_where_the_setting_is_written[api-eu.petkt.com]
- added: tests/test_proxy_upstream_allowlist.py::test_anything_else_is_refused_where_the_setting_is_written[]
- added: tests/test_proxy_upstream_allowlist.py::test_preset_keys_are_still_valid_settings
- added: tests/test_proxy_upstream_allowlist.py::test_forward_never_contacts_a_refused_upstream
- added: tests/test_proxy_upstream_allowlist.py::test_cloud_fetch_never_contacts_a_refused_upstream
- added: tests/test_proxy_upstream_allowlist.py::test_the_proxy_dns_resolver_resolves_only_allowlisted_names
- added: tests/test_proxy_upstream_allowlist.py::test_forward_does_not_follow_redirects

### ffmpeg runs with -nostdin, a file/pipe protocol whitelist and input size and duration caps; output unchanged

- added: tests/test_ffmpeg_hardening.py::test_every_ffmpeg_input_gets_the_whitelist_and_the_duration_cap
- added: tests/test_ffmpeg_hardening.py::test_ffprobe_gets_the_whitelist_and_other_binaries_are_untouched
- added: tests/test_ffmpeg_hardening.py::test_run_ffmpeg_always_runs_the_hardened_argv
- added: tests/test_ffmpeg_hardening.py::test_an_input_over_the_size_cap_is_never_handed_to_ffmpeg
- added: tests/test_ffmpeg_hardening.py::test_a_stitch_over_the_size_cap_is_refused
- added: tests/test_ffmpeg_hardening.py::test_a_remux_is_byte_identical_to_the_unhardened_command
- added: tests/test_ffmpeg_hardening.py::test_a_stitch_is_byte_identical_to_the_unhardened_command
- added: tests/test_ffmpeg_hardening.py::test_the_probe_and_face_resize_still_work
- added: tests/test_ffmpeg_hardening.py::test_a_device_file_cannot_make_ffmpeg_open_the_network
- added: tests/test_ffmpeg_hardening.py::test_the_duration_cap_bounds_what_ffmpeg_reads
- added: tests/test_ffmpeg_hardening.py::test_talk_runs_ffmpeg_with_stdin_off_and_per_file_whitelists
- added: tests/test_ffmpeg_hardening.py::test_the_cap_constants_are_sane

### Files this process writes are owner-only (umask 077, data dir 0700)

- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[main/data_permissions.py]
  — the per-module clock check covers the new module.
- added: tests/test_data_file_permissions.py::test_the_data_dir_is_tightened_and_the_umask_set
- added: tests/test_data_file_permissions.py::test_a_missing_data_dir_is_created_owner_only
- added: tests/test_data_file_permissions.py::test_an_unchmoddable_data_dir_is_logged_not_fatal
- added: tests/test_data_file_permissions.py::test_devices_json_is_owner_only
- added: tests/test_data_file_permissions.py::test_the_event_database_is_owner_only
- added: tests/test_data_file_permissions.py::test_the_broker_certificate_and_key_are_owner_only
- added: tests/test_data_file_permissions.py::test_a_device_sound_list_is_owner_only
- added: tests/test_data_file_permissions.py::test_main_secures_the_data_dir_before_anything_is_written
- added: tests/test_log_line_escaping.py::test_a_crlf_in_a_logged_value_is_escaped_not_emitted
- added: tests/test_log_line_escaping.py::test_an_ordinary_value_is_unchanged
- added: tests/test_contract_spec_paths_exist.py::test_every_spec_operation_is_served_by_the_router
- added: tests/test_contract_spec_paths_exist.py::test_every_spec_operation_declares_the_tier_the_handler_enforces
- added: tests/test_contract_spec_paths_exist.py::test_a_route_left_out_of_the_spec_is_a_listed_exception
- added: tests/test_contract_spec_paths_exist.py::test_every_listed_exception_is_still_served_and_still_absent_from_the_spec
- added: tests/test_contract_spec_paths_exist.py::test_each_operation_carries_the_security_its_tier_requires
- added: tests/test_contract_spec_paths_exist.py::test_every_error_response_uses_the_error_envelope
- added: tests/test_contract_spec_paths_exist.py::test_each_operation_declares_the_refusals_its_tier_and_method_imply
- added: tests/test_contract_spec_paths_exist.py::test_operation_ids_are_unique
- added: tests/test_web_app_serving.py::test_the_document_is_never_reused_unasked_and_allows_no_inline_code
- added: tests/test_web_app_serving.py::test_a_hashed_asset_is_cached_for_good_and_other_files_are_revalidated
- added: tests/test_web_app_serving.py::test_the_document_reached_through_assets_is_not_cached_for_good
- added: tests/test_web_app_serving.py::test_a_path_outside_the_build_or_missing_from_it_is_a_404
- added: tests/test_web_app_serving.py::test_info_reports_the_entry_of_the_build_the_server_would_serve
- added: tests/test_event_content_repair_is_linear.py::test_an_unterminated_string_of_escaped_quotes_is_repaired_in_linear_time
- added: tests/test_event_content_repair_is_linear.py::test_a_bare_token_is_still_quoted_and_text_inside_strings_is_left_alone
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[shared/web_build.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[web/spa.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[shared/web_build.py]

### The W7H Water Change job (start_action 5) is removed, refused and cleared from Home Assistant

- added: tests/test_w7h_water_change_retired.py::test_the_crashing_start_action_cannot_be_built
- added: tests/test_w7h_water_change_retired.py::test_no_named_action_sends_the_crashing_start_action_to_a_w7h
- added: tests/test_w7h_water_change_retired.py::test_discovery_no_longer_offers_water_change
- added: tests/test_w7h_water_change_retired.py::test_only_the_w7h_retires_water_change
- added: tests/test_w7h_water_change_retired.py::test_the_retired_water_change_config_is_cleared_from_home_assistant
- added: tests/test_w7h_water_change_retired.py::test_the_panel_refuses_water_change_and_queues_nothing[body0]
- added: tests/test_w7h_water_change_retired.py::test_the_panel_refuses_water_change_and_queues_nothing[body1]

### HA event entities fire (payload reaches HA as JSON; declared types follow the codes table)

- added: tests/test_bridge_events.py::test_ha_event_fires_with_content_not_transport_envelope
- added: tests/test_discovery.py::test_event_entity_payload_reaches_ha_unwrapped
- added: tests/test_entities.py::test_event_entity_options_accept_every_event_the_device_can_fire
- added: tests/test_publisher_events.py::test_event_payload_is_json_carrying_event_type
- added: tests/test_publisher_events.py::test_event_attrs_become_attributes_and_envelope_is_stripped
- added: tests/test_publisher_events.py::test_device_content_cannot_override_event_type

### dev_state_report `time` rendered at the device's own UTC offset, UTC for an unusable one

- added: tests/test_timeutil.py::test_cloud_timestamp_defaults_to_utc
- added: tests/test_timeutil.py::test_cloud_timestamp_localizes_to_the_offset
- added: tests/test_timeutil.py::test_cloud_timestamp_offset_is_hhmm[0.0-+0000]
- added: tests/test_timeutil.py::test_cloud_timestamp_offset_is_hhmm[-7.0--0700]
- added: tests/test_timeutil.py::test_cloud_timestamp_offset_is_hhmm[5.75-+0545]
- added: tests/test_timeutil.py::test_cloud_timestamp_offset_is_hhmm[5.5-+0530]
- added: tests/test_timeutil.py::test_cloud_timestamp_offset_is_hhmm[14.0-+1400]
- added: tests/test_timeutil.py::test_cloud_timestamp_falls_back_to_utc_for_an_unusable_offset[nan]
- added: tests/test_timeutil.py::test_cloud_timestamp_falls_back_to_utc_for_an_unusable_offset[inf]
- added: tests/test_timeutil.py::test_cloud_timestamp_falls_back_to_utc_for_an_unusable_offset[-inf]
- added: tests/test_timeutil.py::test_cloud_timestamp_falls_back_to_utc_for_an_unusable_offset[24.0]
- added: tests/test_timeutil.py::test_cloud_timestamp_falls_back_to_utc_for_an_unusable_offset[-24.0]
- added: tests/test_timeutil.py::test_cloud_timestamp_falls_back_to_utc_for_an_unusable_offset[30.0]
- added: tests/test_timeutil.py::test_cloud_timestamp_falls_back_to_utc_for_an_unusable_offset[23.9999]
- added: tests/test_timeutil.py::test_cloud_timestamp_falls_back_to_utc_for_an_unusable_offset[1e+308]
- added: tests/test_http.py::test_state_report_time_carries_the_devices_offset
- added: tests/test_http.py::test_state_report_time_is_utc_for_an_unidentified_device
- added: tests/test_http.py::test_state_report_time_is_utc_for_an_out_of_range_offset

### An MQTT 5.0 CONNECT is refused with a v5-shaped CONNACK (reason 0x84); every other CONNACK is amqtt's

- added: tests/test_mqtt_protocol_compat.py::test_install_is_idempotent
- added: tests/test_mqtt_protocol_compat.py::test_v5_connect_refused_for_version_gets_v5_connack
- added: tests/test_mqtt_protocol_compat.py::test_v31_connect_refused_for_version_keeps_311_connack
- added: tests/test_mqtt_protocol_compat.py::test_v5_connect_other_refusal_is_not_rewritten
- added: tests/test_mqtt_protocol_compat.py::test_no_connect_seen_leaves_build_stock
- added: tests/test_mqtt_protocol_compat.py::test_v5_refusal_is_still_a_connack
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[mqtt/protocol_compat.py]
  — the per-module clock check gains the new module.

### A linked K3's battery and liquid also update from HTTP (state report and event report state block), only when `k3Id` names it

Ported from upstream petkit-local PR 28, with a `k3Id` guard added.

- added: tests/test_http_k3.py::test_the_helper_moves_battery_and_liquid_onto_the_named_k3
- added: tests/test_http_k3.py::test_the_helper_accepts_k3_id_as_a_decimal_string
- added: tests/test_http_k3.py::test_the_helper_does_nothing_without_a_linked_k3
- added: tests/test_http_k3.py::test_the_helper_ignores_a_state_with_neither_level
- added: tests/test_http_k3.py::test_a_parent_battery_without_k3_id_never_reaches_the_k3
- added: tests/test_http_k3.py::test_a_k3_id_naming_another_k3_is_refused_on_every_transport
- added: tests/test_http_k3.py::test_a_state_report_updates_the_linked_k3
- added: tests/test_http_k3.py::test_a_state_report_without_k3_id_leaves_the_k3_alone
- added: tests/test_http_k3.py::test_an_event_report_state_block_updates_the_linked_k3

### The web app is served at `/`; the server-rendered panel is deleted

`/` serves the web app's document, `/assets/{name}` and `/{name}` its build files, and `/app`,
`/app/` redirect there permanently. Two IDs are renamed for the new mount (the old ones are
dropped from the list above): `test_app_without_a_slash_redirects_relatively_so_ingress_keeps_its_prefix`
became the 301 test below, `test_without_a_build_the_app_says_how_to_build_it` the no-build test.

- added: tests/test_web_app_serving.py::test_the_old_mount_redirects_permanently_and_relatively_so_ingress_keeps_its_prefix
- added: tests/test_web_app_serving.py::test_without_a_build_the_root_says_how_to_build_it_and_the_api_still_answers
- added: tests/test_web_app_serving.py::test_the_document_assets_resolve_under_an_ingress_prefix
  — replaces `test_panel.py::test_index_assets_resolve_under_an_ingress_prefix` for the web app's document.
- added: tests/test_web_app_serving.py::test_only_the_web_app_routes_are_public_static
- added: tests/test_web_app_serving.py::test_without_a_credential_only_the_static_shell_answers

Also retired with the panel, never in the baseline: the ledger-added
`test_user_plane_errors_and_headers.py::test_the_index_csp_allows_exactly_its_one_inline_script`
(its line is dropped above). The document it checked had one hashed inline script; the web app's
has none, and `test_the_document_is_never_reused_unasked_and_allows_no_inline_code` pins `SPA_CSP`.

Also retired, never in the baseline: the ledger-added
`fuzz/test_fuzz_provision_frame_decode.py::test_no_reply_makes_the_decoder_throw` (its line is
dropped from the device-plane fuzzing list above). It fed hypothesis frames to `pkParse` in the
deleted `provision.js` through node. The decoder now lives in the web app's
`src/ble/provisioning-protocol.ts`, which Node 20 cannot load without the web toolchain, so the
"never throws on any notification" property belongs in that app's vitest suite; until a
randomized test lands there, only the fixed vectors in `provisioning-protocol.test.ts` cover it.

### Live video: go2rtc WebRTC config (off until candidates are set, fixed TCP+UDP port, STUN off)

- added: tests/test_go2rtc_webrtc_config.py::test_without_candidates_no_media_listener_and_no_stun
- added: tests/test_go2rtc_webrtc_config.py::test_with_candidates_one_port_for_tcp_and_udp_and_only_those_addresses
- added: tests/test_go2rtc_webrtc_config.py::test_the_api_stays_on_loopback_with_webrtc_on
- added: tests/test_go2rtc_webrtc_config.py::test_the_sidecar_reports_and_renders_what_it_was_given
- added: tests/test_go2rtc_webrtc_config.py::test_config_refuses_a_candidate_go2rtc_would_drop_or_misread[candidates0]
- added: tests/test_go2rtc_webrtc_config.py::test_config_refuses_a_candidate_go2rtc_would_drop_or_misread[candidates1]
- added: tests/test_go2rtc_webrtc_config.py::test_config_refuses_a_candidate_go2rtc_would_drop_or_misread[candidates2]
- added: tests/test_go2rtc_webrtc_config.py::test_config_refuses_a_candidate_go2rtc_would_drop_or_misread[candidates3]
- added: tests/test_go2rtc_webrtc_config.py::test_config_refuses_a_candidate_go2rtc_would_drop_or_misread[candidates4]
- added: tests/test_go2rtc_webrtc_config.py::test_config_refuses_a_candidate_go2rtc_would_drop_or_misread[candidates5]
- added: tests/test_go2rtc_webrtc_config.py::test_config_refuses_a_candidate_go2rtc_would_drop_or_misread[candidates6]
- added: tests/test_go2rtc_webrtc_config.py::test_config_accepts_ip_and_hostname_candidates
- added: tests/test_go2rtc_webrtc_config.py::test_config_refuses_a_bad_webrtc_port[0]
- added: tests/test_go2rtc_webrtc_config.py::test_config_refuses_a_bad_webrtc_port[65536]
- added: tests/test_go2rtc_webrtc_config.py::test_addon_options_parse_comma_separated_candidates

### Live video: the authenticated proxy to go2rtc (HLS with signed links, MSE bridge, WebRTC signaling)

- added: tests/test_live_proxy_auth.py::test_info_says_why_nothing_can_be_watched[sidecar0-False-192.0.2.10-not_a_camera]
- added: tests/test_live_proxy_auth.py::test_info_says_why_nothing_can_be_watched[sidecar1-True--device_unreachable]
- added: tests/test_live_proxy_auth.py::test_info_says_why_nothing_can_be_watched[sidecar2-True-192.0.2.10-no_stream]
- added: tests/test_live_proxy_auth.py::test_info_says_why_nothing_can_be_watched[sidecar3-True-192.0.2.10-sidecar_down]
- added: tests/test_live_proxy_auth.py::test_info_offers_webrtc_only_when_configured
- added: tests/test_live_proxy_auth.py::test_info_needs_a_principal_and_a_known_device
- added: tests/test_live_proxy_auth.py::test_hls_without_a_token_or_signature_is_401
- added: tests/test_live_proxy_auth.py::test_a_signature_for_one_device_does_not_open_another
- added: tests/test_live_proxy_auth.py::test_the_signed_hls_chain_plays_without_a_token
- added: tests/test_live_proxy_auth.py::test_only_go2rtc_hls_files_are_proxied[hls/../../stream.m3u8?id=AbC12345]
- added: tests/test_live_proxy_auth.py::test_only_go2rtc_hls_files_are_proxied[hls/evil.ts?id=AbC12345]
- added: tests/test_live_proxy_auth.py::test_only_go2rtc_hls_files_are_proxied[hls/segment.ts?id=../x]
- added: tests/test_live_proxy_auth.py::test_only_go2rtc_hls_files_are_proxied[hls/segment.ts]
- added: tests/test_live_proxy_auth.py::test_a_device_without_a_configured_stream_is_never_asked_for
- added: tests/test_live_proxy_auth.py::test_webrtc_needs_a_principal
- added: tests/test_live_proxy_auth.py::test_webrtc_offer_and_answer_go_through
- added: tests/test_live_proxy_auth.py::test_webrtc_is_refused_when_not_configured_or_malformed
- added: tests/test_live_proxy_auth.py::test_mse_needs_a_principal
- added: tests/test_live_proxy_auth.py::test_mse_bridges_only_the_mse_request

- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/live/__init__.py]
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[features/live/routes.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/live/__init__.py]
- added: tests/test_web_api_uses_appkeys_constants.py::test_web_api_reads_app_keys_through_the_appkeys_constants[features/live/routes.py]
  — the per-module clock and app-key checks pick up the new `features/live` package.
- added: tests/test_live_proxy_auth.py::test_an_offer_arriving_in_pieces_is_read_whole
- added: tests/test_live_proxy_auth.py::test_an_oversized_offer_is_413_even_without_a_length
- added: tests/test_live_proxy_auth.py::test_mse_forwards_only_the_first_request
- added: tests/test_live_proxy_auth.py::test_live_links_last_five_minutes_and_their_playlist_uris_an_hour
- added: tests/test_live_proxy_auth.py::test_go2rtc_not_answering_is_a_502_that_says_so
- added: tests/test_signed_media_urls.py::test_a_playlist_signs_only_inside_its_own_tree
- added: tests/test_signed_media_urls.py::test_a_uris_own_exp_and_sig_are_replaced_by_ours

### Talk: raw 16 kHz mono PCM input for the iOS app, checked with ffprobe

- added: tests/test_talk_pcm_input.py::test_pcm_input_reaches_the_device_as_16khz_mono_adts_aac
- added: tests/test_talk_pcm_input.py::test_an_unknown_format_is_refused_without_starting_ffmpeg
- added: tests/test_talk_pcm_input.py::test_webm_stays_the_default_and_probes_its_input
- added: tests/test_talk_pcm_input.py::test_a_malformed_or_mid_session_format_change_is_refused

## Removed

### The server-rendered panel (`web/templates`, `web/static/js`, `web/static/styles.css`) is deleted

These assert on the deleted markup, JavaScript and CSS, or on the routes that served them
(`/static`, `/asset/{v}/js/{name}`). The behaviour they guarded lives in the web app (`apps/web`)
and is tested there with vitest; the serving properties (no-cache document, immutable hashed
assets, relative URLs under Ingress, path containment, CSP) are tested for the web app in
`test_web_app_serving.py`. The one API assertion among them, that `/api/info` hands out no
`web_tls_port`, is kept by `test_contract_spec_paths_exist.py` (the spec's `SetupServerInfo`
has no such key and the contract test pins served routes) and was never a property of the page.

- removed: tests/test_panel.py::test_index_served
- removed: tests/test_panel.py::test_index_renders_template_and_links_assets
- removed: tests/test_panel.py::test_static_assets_are_served
- removed: tests/test_panel.py::test_index_assets_resolve_under_an_ingress_prefix
- removed: tests/test_panel.py::test_index_is_only_routed_at_a_trailing_slash_path
- removed: tests/test_panel.py::test_frontend_has_no_inline_event_handlers
- removed: tests/test_panel.py::test_devices_tab_is_one_collapsible_panel_per_device
- removed: tests/test_panel.py::test_the_timeline_container_is_left_with_nothing_but_our_own_nodes
- removed: tests/test_panel.py::test_a_filter_chip_with_no_events_is_not_shown
- removed: tests/test_panel.py::test_timeline_refresh_does_not_rebuild_the_whole_view
- removed: tests/test_panel.py::test_no_element_id_is_shared_between_device_panels
- removed: tests/test_panel.py::test_esc_escapes_every_markup_breaking_character
- removed: tests/test_panel.py::test_provision_ui_has_ble_protocol
- removed: tests/test_panel.py::test_the_timeline_filters_by_pet_with_chips_not_a_dropdown
- removed: tests/test_panel.py::test_the_capture_tab_warns_what_is_in_a_capture
- removed: tests/test_panel.py::test_the_capture_tab_no_longer_describes_capture_as_an_addon_option
- removed: tests/test_panel.py::test_the_capture_tab_offers_delete_next_to_download
- removed: tests/test_panel.py::test_assets_are_revalidated_not_heuristically_cached
- removed: tests/test_panel.py::test_the_index_says_no_cache_whatever_its_path_looks_like
- removed: tests/test_panel.py::test_a_stale_page_can_tell_that_it_is_stale
- removed: tests/test_panel.py::test_proxy_dependent_controls_are_gated_on_proxy_mode
- removed: tests/test_panel.py::test_provision_refuses_a_bluetooth_only_accessory
- removed: tests/test_panel.py::test_provision_does_not_claim_success_for_a_write_that_returned
- removed: tests/test_panel.py::test_the_accessory_panel_is_its_own_panel_and_is_trimmed
- removed: tests/test_panel.py::test_every_js_module_is_reachable_under_the_versioned_path
- removed: tests/test_panel.py::test_the_versioned_asset_path_cannot_escape_the_js_directory
- removed: tests/test_panel.py::test_a_hash_versioned_module_is_cacheable_forever

Node harnesses for the deleted JavaScript. The provisioning decoders were ported to TypeScript and
their vectors moved to `apps/web/src/ble/provisioning-protocol.test.ts` and
`provisioning-payload.test.ts` (CRC, both length readings, notification offset, fragmented ESP32
reply, join states, named failures, port-80 warning). The load test guarded a module graph that
no longer exists; the web app's build and its vitest suite fail on the equivalent errors.

- removed: tests/test_provision_js.py::test_a_blufi_level_failure_is_named_rather_than_numbered
- removed: tests/test_provision_js.py::test_a_fragmented_esp32_custom_data_reply_is_reassembled
- removed: tests/test_provision_js.py::test_a_notification_is_read_from_its_own_offset
- removed: tests/test_provision_js.py::test_a_reported_failure_is_named_rather_than_numbered
- removed: tests/test_provision_js.py::test_an_outbound_frame_uses_ingenic_crc_length
- removed: tests/test_provision_js.py::test_both_readings_of_the_length_field_are_accepted
- removed: tests/test_provision_js.py::test_esp32_provisioning_warns_when_api_url_is_not_port_80
- removed: tests/test_provision_js.py::test_server_connected_and_online_count_as_joined
- removed: tests/test_provision_js.py::test_the_crc_is_the_one_the_devices_use
- removed: tests/test_provision_js.py::test_wrong_password_state_is_a_warning_not_terminal
- removed: tests/test_panel_script_loads.py::test_a_plain_http_page_is_told_it_needs_https_not_a_different_browser
- removed: tests/test_panel_script_loads.py::test_the_panel_script_survives_being_loaded

## Modified (same ID, changed body)

| Test file | Change | Kind | Phase |
|---|---|---|---|
| all files | `petkit_local`/`petkit-local`/`petkitlocal`/`PetKit Local`/`PetKit-Local` renamed by `scripts/rename-from-upstream.sh` | mechanical | import |
| `test_panel.py`, `test_main_lifecycle.py`, `test_panel_script_loads.py`, `test_provision_js.py`, `test_ble_accessories.py`, `test_bounded_growth.py` | paths into the package gain the `src/` segment | mechanical | import |
| `test_version.py` | `config.yaml` and `CHANGELOG.md` read from the repository-root `addon/`; `pyproject.toml` from `services/api/` | mechanical | import |
| `test_state_parsers.py` | real-looking SSID/BSSID fixture replaced by `ExampleNet` / `000000000000`; nothing asserts on it | fixture sanitising | import |
| `test_repro_event_identity_across_devices.py` | strict-xfail markers removed from both tests: event upsert and timeline media pairing are now scoped by device | fix landed | – |
| `test_repro_bare_token_repair_inside_strings.py` | strict-xfail markers removed from both tests: the bare-token repair skips string literals | fix landed | – |
| `test_repro_device_registry_string_petkit_id.py` | strict-xfail marker removed; the assertion now requires the string id to be restored as the int, not merely tolerated | fix landed | – |
| `test_repro_backfill_beyond_first_page.py` | strict-xfail marker removed: the backfill pages through every row by id | fix landed | – |
| `test_repro_device_scoped_commands_and_zones.py` | strict-xfail marker removed from `test_a_code_reported_by_a_model_outside_its_families_is_logged` only; it now resets the once-per-pair warning set and asserts the second lookup does not warn again | fix landed | – |
| `test_repro_derived_state_across_restart.py` | strict-xfail markers removed from both tests and both retargeted from a bare registry reload to the start-up replay of stored events: they store events with fixed timestamps, reload the registry, run `replay_derived_state`, and assert each value carries its event's own time (feeder totals cover only the newest device day) | fix landed | – |
| `test_repro_stitch_failure_keeps_chunks.py` | strict xfail removed from both reproductions: the stitch now keeps every source until the DB swap commits, so they are regular tests | repro promoted to regular test | bugfix |
| `test_repro_media_late_chunks_after_stitch.py` | still a strict xfail, now also asserting one stitched clip per visit holding every chunk in order: with sources kept until the swap commits, footage is no longer lost, so the remaining failure is the second clip | repro tightened | bugfix |
| `test_repro_media_late_chunks_after_stitch.py` | strict xfail removed: late chunks now extend the episode's existing stitched clip in one swap, so the reproduction is a regular test | repro promoted to regular test | bugfix |
| `test_repro_panel_media_raw_dir.py` | strict xfail removed: the panel media routes refuse any dot-prefixed component of the resolved path, so the reproduction is a regular test | repro promoted to regular test | bugfix |
| `test_repro_stitch_failure_keeps_chunks.py::test_successful_stitch_never_overwrites_a_source_and_then_removes_them` | asserts the move-in name is free of every source, and that the clip then takes the first chunk's (preferred) name once the sources are deleted | behaviour refined per the approved fix | 04 |
| `test_media_stitch.py` (3 tests: end-to-end, late-chunk real ffmpeg, mismatched chunk) | expected stitched `file_id` now carries the device id (`stitched:1:<session>:<category>`) | behaviour change per the approved per-device identity fix | 04 |
| `test_timeutil.py`, `test_feed_get.py`, `test_clock.py` (zone helpers) | the fixtures that pinned the process TZ now also configure the clock with that zone, since the host zone is no longer read; the DST assertions are unchanged | behaviour change per the approved zone order | 04 |
| `test_feed_get.py::test_recurring_meal_appears_with_live_countdown` | computes "now" on the device's calendar via `clock.local_datetime` instead of `time.localtime` | same | 04 |
| `test_repro_device_scoped_commands_and_zones.py::test_the_daily_feed_record_id_uses_the_device_zone_not_the_host_zone` | strict xfail removed: the feeder record id uses the device's zone | fix landed | 04 |
| `test_panel.py::test_action_and_entity_forms_have_the_same_side_effects` | pins `time.time` so the two requests' feed record ids (seconds since midnight) cannot straddle a second boundary; it failed about once in ten runs | flaky test fixed, assertion unchanged | 04 |
| `test_listener_bind_addresses.py` | module docstring: plain MQTT is the one listener whose default moved off upstream's (loopback); the defaults test was renamed (see Added) | behaviour change: plain MQTT on loopback | 05 |
| `test_go2rtc.py`, `test_patcher_space.py` | autouse fixture admits the TEST-NET and loopback test-server addresses through the outbound guard, which now gates the probe, the stream sources and the patcher read-back; assertions unchanged (the guard itself is tested in `test_outbound_guard_ssrf.py`) | fixture for the outbound guard | 05 |
| `conftest.py` (every test) | autouse fixture admits `127.0.0.1`/`localhost` as a proxy upstream, so the proxy, cloud-fetch and panel tests keep forwarding to their local stand-in for PetKit; no test body changed (the allowlist itself is tested unpatched in `test_proxy_upstream_allowlist.py`) | fixture for the upstream allowlist | 05 |
| `test_panel.py::test_a_custom_upstream_url_is_accepted` | the typed URL is now a PetKit host (`https://api.eu-pet.com/6/`); an arbitrary mirror (`https://my.mirror/6/`) is asserted refused with 400 and nothing changed | behaviour change: proxy upstream allowlist | 05 |
| `test_repro_media_file_info_resend.py` | strict xfail removed: a replayed file_info no longer moves a ready row with its file on disk out of `ready`, so the reproduction is a regular test | repro promoted to regular test | bugfix |
| `test_repro_panel_app_key_reads.py` | strict xfail markers removed now the sound and device-delete handlers read `hub`/`ha_publisher` through `web/appkeys.py`; docstring now describes the wired behaviour; unused `pytest` import dropped | xfail removed | fix |
| `test_repro_mqtt_auth_signature_log.py` | strict xfail marker removed now a sign mismatch logs pk/dn/signmethod and no signature; docstring in the past tense | xfail removed | fix |
| `test_repro_mqtt_feed_get_parity.py` | strict xfail marker removed now MQTT user/get builds dev_feed_get with the HTTP handler's builder; docstring in the past tense; unused `pytest` import dropped | xfail removed | fix |
| `test_repro_ha_mqtt_host_default.py` | strict xfail markers removed now the standalone `Config` and `HAPublisher` default `ha_mqtt_host` to empty; docstring in the past tense | xfail removed | fix |
| `test_repro_ha_addon_cli_flags.py` | strict xfail marker removed now `build_config` applies the flags after either config source; docstring in the past tense; unused `pytest` import dropped | xfail removed | fix |
| `test_repro_api_url_local_substring.py` | strict xfail marker removed now `.local` is matched on the parsed host; docstring in the past tense | xfail removed | fix |
| `test_repro_device_scoped_commands_and_zones.py` | strict xfail marker removed from `test_an_action_the_model_has_no_button_for_is_refused` now a named action needs a button on the model; the file's other tests unchanged | xfail removed | fix |
| `test_repro_device_scoped_commands_and_zones.py` | strict xfail marker removed from `test_the_heartbeat_queue_stays_bounded_and_keeps_the_newest` now `Device.enqueue_command` caps the queue at 64 | xfail removed | fix |
| `test_panel.py`, `test_ble_accessories.py`, `test_cloud_pet_import.py`, `test_k3_and_cloud_bindings.py`, `test_panel_command_action_validation.py`, `test_panel_devicelogs.py`, `test_panel_media.py`, `test_repro_device_scoped_commands_and_zones.py`, `test_repro_panel_app_key_reads.py`, `test_repro_panel_media_raw_dir.py`, `test_schedules.py` | panel clients built with `authed_test_client(app)` (`tests/conftest_auth.py`: a client token plus a fresh step-up) instead of `TestClient(TestServer(app))`, since every panel route now needs a principal; now-unused `TestClient`/`TestServer`/`json` imports dropped | auth migration | 05 |
| same files | JSON request bodies sent with `json=` instead of `data=json.dumps(...)`, so they carry `Content-Type: application/json`, which `_json_body` now requires | auth migration | 05 |
| `test_cloud_pet_import.py::test_a_malformed_request_is_refused`, `test_k3_and_cloud_bindings.py::test_a_malformed_request_is_refused` | the malformed body is sent with `Content-Type: application/json`, so it is still the BODY that is refused (400) rather than the content type (415) | auth migration | 05 |
| `test_panel.py` (3 tests), `test_schedules.py::test_an_unknown_target_is_refused`, `test_k3_and_cloud_bindings.py::test_an_unreachable_cloud_is_an_error_not_a_silent_nothing`, `test_cloud_pet_import.py::test_a_refusal_from_petkit_is_reported_not_swallowed`, `test_panel_media.py::test_pet_face_upload_stops_at_the_cap`, `test_panel_command_action_validation.py::test_an_unknown_action_is_refused_with_the_existing_message` | read the error text from `["error"]["message"]`: errors are the `{"error": {"code", "message"}}` envelope now; the message text is unchanged | error envelope | 05 |
| `conftest.py` | re-exports the `authed_client` fixture from `conftest_auth.py` | auth migration | 05 |
| `test_w7h.py::test_the_job_buttons_send_actions_the_firmware_accepts`, `test_w7h.py::test_no_button_sends_an_action_that_is_not_a_job` | `fountain_water_change` dropped from the buttons checked: the button and its action are removed because `start_action: 5` crashes the device | behaviour change | – |
| `test_entities.py::test_entity_count_per_device_type_is_unchanged` | W7H 84 -> 83 for the removed Water Change button | behaviour change | – |
| `test_http.py::test_a_command_is_labelled_with_a_msg_type_the_device_dispatches` | the camera-pan actions are checked against `build_run_cmd`'s envelope instead: they are run_cmd lines and never pass through the heartbeat translation | behaviour change | – |
| `test_panel.py::test_all_patchers_are_offered_on_every_next_gen_device` | Camera Pan may show as unavailable: it is gated by model (only the T6 has the motor), not by architecture | behaviour change | – |
| `test_patcher_space.py::test_every_patcher_declares_more_space_than_the_gate_can_ever_demand` | Camera Pan is exempt and pinned to 0: it writes nothing, not even the wrapper, so the space gate never runs for it | behaviour change | – |
| `test_panel.py::test_every_published_entity_component_has_somewhere_to_render`, `test_panel.py::test_the_accessory_panel_renders_every_component_an_accessory_has` | read the web app's `entity-sections.ts` (`ENTITY_SECTION`) and `accessory-panel-body.tsx` instead of the deleted `static/js`; no longer start a test client; same property, every published component has a home | panel deleted, check moved to the web app | – |
| `test_panel.py::test_every_hub_kind_the_proxy_publishes_has_a_colour` | checks that the web app's `log-format.ts` `levelOf` names `redact` and `blocked` (the row colour), instead of `.k.<kind>` rules in the deleted CSS | panel deleted, check moved to the web app | – |
| `test_panel.py::test_the_photo_cap_agrees_with_the_store` | reads `MAX_FACES` from the web app's `pet-model.ts` instead of the deleted JS | panel deleted, check moved to the web app | – |
| `test_bounded_growth.py::test_every_retention_category_is_editable_from_the_panel` | reads `RETENTION_SIZED` / `RETENTION_AGE_ONLY` from the web app's `retention-and-blocked-model.ts` instead of `RETENTION_LABELS` in the deleted `setup.js`; same three assertions | panel deleted, check moved to the web app | – |
| `test_auth_every_route_requires_token.py::test_static_shell_needs_no_token`, `test_auth_every_route_requires_token.py::test_a_panel_without_auth_refuses_everything_but_static` | use the `web_build` fixture (`conftest.py`), since `/` now serves the web app's build; the shell files checked are `/assets/<entry>` and `/favicon.svg` instead of `/static/styles.css` | `/` serves the web app | – |
| `test_user_plane_errors_and_headers.py::test_every_response_carries_the_security_headers_and_no_cors` | the static file checked is the web app's `/favicon.svg`, which carries `SPA_CSP`; `/api/devices` still carries `BASE_CSP`; other headers unchanged | `/` serves the web app | – |
| `test_web_app_serving.py` (document, hashed asset, document-through-assets, path containment, info entry) | paths moved from `/app/...` to `/`, `/assets/...` and `/{name}`; the build comes from the shared `web_build` fixture; the info test also asserts `asset_version` is present and empty | `/` serves the web app | – |
| `test_contract_spec_paths_exist.py` (`UNDESCRIBED`) | `/static`, `/asset/{v}/js/{name}` and `/app/{path}` dropped; `/assets/{name}` and `/{name}` added; `/app`, `/app/` now described as redirects to the root | `/` serves the web app | – |
| `conftest.py` | new `web_build` fixture and `WEB_ENTRY` constant: a minimal build in a temporary dist directory, moved out of `test_web_app_serving.py` so every module that reaches `/` can use it | fixture | – |
| `test_go2rtc.py` | `test_the_rendered_config_binds_where_we_intend`: comment only — WebRTC media is off until candidates are configured, rather than off outright; the assertion is unchanged | comment | live video |

### Media serves the byte ranges the iOS media loader asks for

The app plays media through an AVAssetResourceLoader over its pinned session:
a two-byte probe for type and total length, then open-ended ranges.

- added: tests/test_media_range_requests.py::test_the_two_byte_probe_reports_type_and_total_length
- added: tests/test_media_range_requests.py::test_an_open_ended_range_reads_to_the_end
- added: tests/test_media_range_requests.py::test_a_range_past_the_end_is_refused_not_served_whole

### T6 camera pan: opt-in buttons over the firmware's pktool

Only the three fixed shell lines may reach run_cmd, and only on a T6 whose operator applied
the Camera Pan patcher.

- added: tests/test_t6_camera_pan.py::test_the_buttons_appear_only_on_an_opted_in_t6
- added: tests/test_t6_camera_pan.py::test_the_pan_buttons_are_appended_after_every_existing_t6_entity
- added: tests/test_t6_camera_pan.py::test_each_button_sends_its_exact_fixed_shell_line
- added: tests/test_t6_camera_pan.py::test_a_pan_is_refused_without_the_patcher
- added: tests/test_t6_camera_pan.py::test_a_pan_is_refused_while_the_camera_is_off
- added: tests/test_t6_camera_pan.py::test_only_a_pan_line_reaches_run_cmd
- added: tests/test_t6_camera_pan.py::test_the_firmware_check_accepts_only_the_build_the_commands_came_from[known-build]
- added: tests/test_t6_camera_pan.py::test_the_firmware_check_accepts_only_the_build_the_commands_came_from[no-answer]
- added: tests/test_t6_camera_pan.py::test_the_firmware_check_accepts_only_the_build_the_commands_came_from[other-pktool]
- added: tests/test_t6_camera_pan.py::test_the_firmware_check_accepts_only_the_build_the_commands_came_from[other-travel]
- added: tests/test_t6_camera_pan.py::test_the_firmware_check_accepts_only_the_build_the_commands_came_from[empty]
- added: tests/test_t6_camera_pan.py::test_the_panel_action_sends_the_pan_line_over_run_cmd
- added: tests/test_t6_camera_pan.py::test_the_raw_panel_form_cannot_name_the_run_cmd_suffix
- added: tests/test_t6_camera_pan.py::test_the_shared_delivery_helper_refuses_the_run_cmd_suffix
- added: tests/test_t6_camera_pan.py::test_a_home_assistant_press_sends_the_pan_line_over_run_cmd
- added: tests/test_t6_camera_pan.py::test_a_home_assistant_press_with_the_camera_off_sends_nothing
- added: tests/test_t6_camera_pan.py::test_retiring_the_pan_buttons_clears_their_discovery
- added: tests/test_t6_camera_pan.py::test_the_patcher_is_unavailable_and_refused_off_the_t6
- added: tests/test_t6_camera_pan.py::test_applying_records_the_opt_in_only_when_the_firmware_checks_out[known-build]
- added: tests/test_t6_camera_pan.py::test_applying_records_the_opt_in_only_when_the_firmware_checks_out[no-answer]
- added: tests/test_t6_camera_pan.py::test_applying_records_the_opt_in_only_when_the_firmware_checks_out[other-pktool]
- added: tests/test_t6_camera_pan.py::test_removing_drops_the_opt_in_and_says_done_without_a_reboot
- added: tests/test_no_naive_calendar_calls.py::test_module_reads_local_time_only_through_clock[patchers/pan.py]
  — the per-module clock check picks up the new `patchers/pan.py`.
