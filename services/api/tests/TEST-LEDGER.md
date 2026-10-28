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

## Removed

None.

## Modified (same ID, changed body)

| Test file | Change | Kind | Phase |
|---|---|---|---|
| all files | `petkit_local`/`petkit-local`/`petkitlocal`/`PetKit Local`/`PetKit-Local` renamed by `scripts/rename-from-upstream.sh` | mechanical | import |
| `test_panel.py`, `test_main_lifecycle.py`, `test_panel_script_loads.py`, `test_provision_js.py`, `test_ble_accessories.py`, `test_bounded_growth.py` | paths into the package gain the `src/` segment | mechanical | import |
| `test_version.py` | `config.yaml` and `CHANGELOG.md` read from the repository-root `addon/`; `pyproject.toml` from `services/api/` | mechanical | import |
| `test_state_parsers.py` | real-looking SSID/BSSID fixture replaced by `ExampleNet` / `000000000000`; nothing asserts on it | fixture sanitising | import |
