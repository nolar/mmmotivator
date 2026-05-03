"""Unit tests for the rate-limit quota in main.py."""
import time
from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import Mock

import fakeredis
import pytest
from fastapi import HTTPException

import main
from main import (
    GRANULARITY_SECONDS,
    KEY_TTL_SECONDS,
    WINDOW_BUCKETS,
    _check_and_count_quota,
    _hash_for_redis,
    _user_key_from_request,
)


@pytest.fixture
async def redis_client() -> AsyncIterator[Any]:
    client = fakeredis.FakeAsyncRedis(decode_responses=True)
    yield client
    await client.aclose()


def _make_request(
    headers: dict[str, str] | None = None,
    client_host: str | None = None,
) -> Mock:
    request = Mock()
    request.headers = headers or {}
    request.client = Mock(host=client_host) if client_host is not None else None
    return request


# ----- _hash_for_redis -----

def test_hash_for_redis_is_deterministic() -> None:
    assert _hash_for_redis("1.2.3.4") == _hash_for_redis("1.2.3.4")


def test_hash_for_redis_different_inputs_differ() -> None:
    assert _hash_for_redis("alice") != _hash_for_redis("bob")


def test_hash_for_redis_is_8_hex_chars() -> None:
    h = _hash_for_redis("1.2.3.4")
    assert len(h) == 8
    int(h, 16)  # must parse as hex


# ----- _user_key_from_request -----

def test_user_key_prefers_cf_connecting_ip() -> None:
    request = _make_request(
        headers={
            "CF-Connecting-IP": "1.2.3.4",
            "X-Forwarded-For": "5.6.7.8",
        },
        client_host="9.10.11.12",
    )
    assert _user_key_from_request(request) == "1.2.3.4"


def test_user_key_falls_back_to_xff_first_hop() -> None:
    request = _make_request(headers={"X-Forwarded-For": "5.6.7.8, 1.1.1.1, 2.2.2.2"})
    assert _user_key_from_request(request) == "5.6.7.8"


def test_user_key_falls_back_to_immediate_sender() -> None:
    request = _make_request(client_host="9.10.11.12")
    assert _user_key_from_request(request) == "9.10.11.12"


def test_user_key_unknown_when_no_signal() -> None:
    request = _make_request()
    assert _user_key_from_request(request) == "unknown"


# ----- _check_and_count_quota -----

async def test_quota_increments_both_buckets(
    redis_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(main, "MAX_REQUESTS_GLOBALLY_PER_DAY", 1000)
    monkeypatch.setattr(main, "MAX_REQUESTS_PER_USER_PER_DAY", 1000)

    await _check_and_count_quota(redis_client, "alice")

    bucket = int(time.time() // GRANULARITY_SECONDS) * GRANULARITY_SECONDS
    assert int(await redis_client.get(f"bio:count:{bucket}")) == 1
    h = _hash_for_redis("alice")
    assert int(await redis_client.get(f"bio:user:{h}:{bucket}")) == 1


async def test_bucket_id_is_unix_timestamp_boundary(
    redis_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Bucket id is the unix-timestamp boundary, not an int-divided index."""
    monkeypatch.setattr(main, "MAX_REQUESTS_GLOBALLY_PER_DAY", 1000)
    monkeypatch.setattr(main, "MAX_REQUESTS_PER_USER_PER_DAY", 1000)

    await _check_and_count_quota(redis_client, "alice")

    keys = [k async for k in redis_client.scan_iter("bio:count:*")]
    assert len(keys) == 1
    bucket = int(keys[0].split(":")[-1])
    assert bucket > 1_000_000_000  # plausible unix timestamp
    assert bucket % GRANULARITY_SECONDS == 0
    assert abs(bucket - int(time.time())) < GRANULARITY_SECONDS


async def test_bucket_keys_get_ttl(
    redis_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """TTL must outlast the rolling window so the oldest bucket is still alive at sum time."""
    monkeypatch.setattr(main, "MAX_REQUESTS_GLOBALLY_PER_DAY", 1000)
    monkeypatch.setattr(main, "MAX_REQUESTS_PER_USER_PER_DAY", 1000)

    await _check_and_count_quota(redis_client, "alice")

    bucket = int(time.time() // GRANULARITY_SECONDS) * GRANULARITY_SECONDS
    ttl = await redis_client.ttl(f"bio:count:{bucket}")
    assert ttl > GRANULARITY_SECONDS * WINDOW_BUCKETS
    assert ttl <= KEY_TTL_SECONDS


async def test_per_user_cap_triggers_429(
    redis_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(main, "MAX_REQUESTS_GLOBALLY_PER_DAY", 1000)
    monkeypatch.setattr(main, "MAX_REQUESTS_PER_USER_PER_DAY", 3)

    for _ in range(3):
        await _check_and_count_quota(redis_client, "alice")

    with pytest.raises(HTTPException) as exc_info:
        await _check_and_count_quota(redis_client, "alice")
    assert exc_info.value.status_code == 429
    assert "Per-user" in exc_info.value.detail


async def test_global_cap_triggers_429_across_users(
    redis_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The global cap fires from combined traffic across distinct users."""
    monkeypatch.setattr(main, "MAX_REQUESTS_GLOBALLY_PER_DAY", 3)
    monkeypatch.setattr(main, "MAX_REQUESTS_PER_USER_PER_DAY", 1000)

    for user in ("alice", "bob", "carol"):
        await _check_and_count_quota(redis_client, user)

    with pytest.raises(HTTPException) as exc_info:
        await _check_and_count_quota(redis_client, "dave")
    assert exc_info.value.status_code == 429
    assert "Global" in exc_info.value.detail


async def test_per_user_check_takes_precedence(
    redis_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """When both caps would trigger, the per-user error wins (it's checked first)."""
    monkeypatch.setattr(main, "MAX_REQUESTS_GLOBALLY_PER_DAY", 2)
    monkeypatch.setattr(main, "MAX_REQUESTS_PER_USER_PER_DAY", 2)

    await _check_and_count_quota(redis_client, "alice")
    await _check_and_count_quota(redis_client, "alice")

    with pytest.raises(HTTPException) as exc_info:
        await _check_and_count_quota(redis_client, "alice")
    assert exc_info.value.status_code == 429
    assert "Per-user" in exc_info.value.detail


async def test_redis_failure_raises_503() -> None:
    """Quota check must fail closed on Redis errors — uncapped LLM cost is worse."""

    class FailingRedis:
        async def incr(self, *args: Any, **kwargs: Any) -> int:
            raise ConnectionError("redis down")

    with pytest.raises(HTTPException) as exc_info:
        await _check_and_count_quota(FailingRedis(), "alice")
    assert exc_info.value.status_code == 503
    assert "Quota service unavailable" in exc_info.value.detail


async def test_recent_buckets_count_toward_window(
    redis_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A bucket from a few hours ago must count toward the rolling sum."""
    monkeypatch.setattr(main, "MAX_REQUESTS_GLOBALLY_PER_DAY", 1000)
    monkeypatch.setattr(main, "MAX_REQUESTS_PER_USER_PER_DAY", 8)

    h = _hash_for_redis("alice")
    bucket_now = int(time.time() // GRANULARITY_SECONDS) * GRANULARITY_SECONDS
    bucket_5h_ago = bucket_now - 5 * GRANULARITY_SECONDS

    # Pre-populate the past bucket with 7 hits.
    await redis_client.set(f"bio:user:{h}:{bucket_5h_ago}", 7)

    # First call: current bucket becomes 1, window sum = 8 (at cap, allowed).
    await _check_and_count_quota(redis_client, "alice")

    # Second call: current bucket becomes 2, window sum = 9 (over, rejected).
    with pytest.raises(HTTPException) as exc_info:
        await _check_and_count_quota(redis_client, "alice")
    assert exc_info.value.status_code == 429
    assert "Per-user" in exc_info.value.detail


async def test_old_buckets_outside_window_do_not_count(
    redis_client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A bucket older than WINDOW_BUCKETS hours must NOT count toward the sum."""
    monkeypatch.setattr(main, "MAX_REQUESTS_GLOBALLY_PER_DAY", 1000)
    monkeypatch.setattr(main, "MAX_REQUESTS_PER_USER_PER_DAY", 5)

    h = _hash_for_redis("alice")
    bucket_now = int(time.time() // GRANULARITY_SECONDS) * GRANULARITY_SECONDS
    bucket_30h_ago = bucket_now - 30 * GRANULARITY_SECONDS

    # Far past bucket has a huge count, but it's outside the rolling window.
    await redis_client.set(f"bio:user:{h}:{bucket_30h_ago}", 1000)

    # Current bucket starts empty; this call brings it to 1. Should pass.
    await _check_and_count_quota(redis_client, "alice")
