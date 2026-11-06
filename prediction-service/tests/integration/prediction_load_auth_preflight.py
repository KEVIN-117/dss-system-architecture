"""Validate the local BFF session with the same HTTP stack as the load driver."""

from __future__ import annotations

import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def main() -> int:
    base_url = os.getenv("PREDICTION_LOAD_BFF_URL", "http://localhost:3006").rstrip("/")
    cookie = os.getenv("PREDICTION_LOAD_PREFLIGHT_COOKIE", os.getenv("PREDICTION_LOAD_SESSION_COOKIE", ""))
    required_role = os.getenv("PREDICTION_LOAD_REQUIRED_ROLE", "SUPERADMIN")
    if not cookie:
        print("BFF session cookie is missing.", file=sys.stderr)
        return 2

    request = Request(
        f"{base_url}/api/auth/me",
        headers={"Accept": "application/json", "Cookie": cookie},
    )
    try:
        with urlopen(request, timeout=10) as response:
            if response.status != 200:
                print(f"BFF session validation returned HTTP {response.status}.", file=sys.stderr)
                return 1
            profile = json.loads(response.read())
    except HTTPError as error:
        print(f"BFF rejected the local session (HTTP {error.code}).", file=sys.stderr)
        return 1
    except (URLError, TimeoutError, OSError) as error:
        print(f"Could not validate the local BFF session ({type(error).__name__}).", file=sys.stderr)
        return 1
    except (json.JSONDecodeError, UnicodeDecodeError):
        print("BFF session validation returned an invalid profile response.", file=sys.stderr)
        return 1

    roles = profile.get("roles") if isinstance(profile, dict) else None
    if not isinstance(roles, list) or required_role not in roles:
        print(f"The BFF session is valid but lacks required role {required_role}.", file=sys.stderr)
        return 1

    print(f"BFF session verified ({required_role}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
