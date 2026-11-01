from truckpilot.env import database_from_url, env_list, load_env_file


def test_database_from_neon_url():
    db = database_from_url(
        "postgresql://tp_user:p%40ss@ep-x-pooler.us-east-1.aws.neon.tech/neondb"
        "?sslmode=require&channel_binding=require"
    )
    assert db["ENGINE"] == "django.db.backends.postgresql"
    assert db["NAME"] == "neondb"
    assert db["USER"] == "tp_user"
    assert db["PASSWORD"] == "p@ss"
    assert db["HOST"] == "ep-x-pooler.us-east-1.aws.neon.tech"
    assert db["OPTIONS"] == {"sslmode": "require", "channel_binding": "require"}
    assert db["CONN_MAX_AGE"] == 0
    assert db["DISABLE_SERVER_SIDE_CURSORS"] is True


def test_database_url_must_be_postgres():
    import pytest

    with pytest.raises(ValueError):
        database_from_url("sqlite:///db.sqlite3")


def test_env_list(monkeypatch):
    monkeypatch.setenv("X_LIST", " a.com, ,b.com ")
    assert env_list("X_LIST") == ["a.com", "b.com"]
    monkeypatch.delenv("X_LIST")
    assert env_list("X_LIST") == []


def test_load_env_file_keeps_real_env(tmp_path, monkeypatch):
    f = tmp_path / ".env.local"
    f.write_text('# comment\nTP_A="quoted"\nTP_B=plain=x\nTP_C=file\n', encoding="utf-8")
    monkeypatch.delenv("TP_A", raising=False)
    monkeypatch.delenv("TP_B", raising=False)
    monkeypatch.setenv("TP_C", "real")
    load_env_file(f)
    import os

    assert os.environ["TP_A"] == "quoted"
    assert os.environ["TP_B"] == "plain=x"
    assert os.environ["TP_C"] == "real"


def test_env_flag(monkeypatch):
    from truckpilot.env import env_flag

    monkeypatch.delenv("X_FLAG", raising=False)
    assert env_flag("X_FLAG") is False
    for on in ("1", "true", "TRUE"):
        monkeypatch.setenv("X_FLAG", on)
        assert env_flag("X_FLAG") is True
    for off in ("", "0", "no"):
        monkeypatch.setenv("X_FLAG", off)
        assert env_flag("X_FLAG") is False


def test_e2e_mode_needs_debug_and_not_vercel():
    import pytest
    from django.core.exceptions import ImproperlyConfigured

    from truckpilot.env import check_e2e_mode

    check_e2e_mode(e2e=True, debug=True, on_vercel=False)
    check_e2e_mode(e2e=False, debug=False, on_vercel=True)
    with pytest.raises(ImproperlyConfigured):
        check_e2e_mode(e2e=True, debug=False, on_vercel=False)
    with pytest.raises(ImproperlyConfigured):
        check_e2e_mode(e2e=True, debug=True, on_vercel=True)


def test_test_database_must_not_be_neon():
    import pytest
    from django.core.exceptions import ImproperlyConfigured

    from truckpilot.env import local_database_from_url

    db = local_database_from_url("postgres://postgres:pw@localhost:5432/truckpilot")
    assert db["HOST"] == "localhost"
    assert db["NAME"] == "truckpilot"
    with pytest.raises(ImproperlyConfigured):
        local_database_from_url("postgresql://u:p@ep-x-pooler.us-east-1.aws.neon.tech/neondb")


def test_empty_test_database_url_is_a_clear_error():
    import pytest
    from django.core.exceptions import ImproperlyConfigured

    from truckpilot.env import local_database_from_url

    with pytest.raises(ImproperlyConfigured, match="TEST_DATABASE_URL is empty"):
        local_database_from_url("")
