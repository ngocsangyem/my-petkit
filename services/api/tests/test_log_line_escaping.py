"""A caller-supplied string written to a log stays on one line."""
from my_petkit.utils.logtext import one_line


def test_a_crlf_in_a_logged_value_is_escaped_not_emitted():
    forged = "/api/x\r\nauth_success principal=admin"
    assert one_line(forged) == "/api/x\\r\\nauth_success principal=admin"
    assert "\n" not in one_line(forged) and "\r" not in one_line(forged)


def test_an_ordinary_value_is_unchanged():
    assert one_line("/api/auth/tokens/7") == "/api/auth/tokens/7"
    assert one_line(7) == "7"
