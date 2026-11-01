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
