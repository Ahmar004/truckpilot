from core.sentry import before_breadcrumb, before_send, strip_query

KEY_URL = "https://api.tomtom.com/routing/1/calculateRoute/a:b/json?key=SECRET&x=1"


def test_strip_query_cuts_query_and_fragment():
    assert strip_query(KEY_URL) == "https://api.tomtom.com/routing/1/calculateRoute/a:b/json"
    assert strip_query("see https://a.io/p#frag now") == "see https://a.io/p now"


def test_strip_query_leaves_plain_text():
    assert strip_query("no url here? maybe") == "no url here? maybe"


def test_before_send_drops_request_and_user_and_scrubs_values():
    event = {
        "request": {"cookies": "sessionid=abc", "data": {"a": 1}},
        "user": {"email": "a@example.com"},
        "exception": {"values": [{"value": f"GET {KEY_URL} failed"}, {"value": None}]},
        "message": f"bad {KEY_URL}",
    }
    out = before_send(event, {})
    assert "request" not in out and "user" not in out
    assert "SECRET" not in out["exception"]["values"][0]["value"]
    assert "SECRET" not in out["message"]


def test_before_send_handles_empty_event():
    assert before_send({}, {}) == {}


def test_before_breadcrumb_scrubs_http_data():
    crumb = {
        "message": f"GET {KEY_URL}",
        "data": {"url": KEY_URL, "http.query": "key=SECRET", "http.fragment": "f"},
    }
    out = before_breadcrumb(crumb, {})
    assert "SECRET" not in str(out)
    assert "http.query" not in out["data"] and "http.fragment" not in out["data"]
