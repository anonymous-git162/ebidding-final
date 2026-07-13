"""Production smoke test for cenbidding (live Vercel + Render)."""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

BASE = "https://cenbidding.vercel.app"
API = "https://cenbidding-backend.onrender.com"
OUT = Path(__file__).resolve().parent
PASSWORD = "Password123"

ACCOUNTS = [
    "admin@ebidding.com",
    "requester@ebidding.com",
    "approver@ebidding.com",
    "vendor@ebidding.com",
]

PROTECTED = [
    "/dashboard",
    "/procurements",
    "/approvals",
    "/vendors",
    "/audit",
    "/reporting",
    "/submissions",
]

results: list[dict] = []


def record(name: str, ok: bool, detail: str = "", duration_ms: int = 0):
    results.append(
        {
            "name": name,
            "ok": ok,
            "detail": detail,
            "duration_ms": duration_ms,
        }
    )
    status = "PASS" if ok else "FAIL"
    print(f"  [{status}] {name}" + (f" — {detail}" if detail else ""))


def main() -> int:
    started = datetime.now(timezone.utc).isoformat()
    print(f"Production smoke — {BASE}")
    print(f"Backend API       — {API}")
    print(f"Started           — {started}")
    print()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            ignore_https_errors=False,
        )
        page = context.new_page()
        console_errors: list[str] = []
        page_errors: list[str] = []

        page.on(
            "console",
            lambda msg: console_errors.append(msg.text)
            if msg.type == "error"
            else None,
        )
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        # --- 1. Backend health ---
        t0 = time.time()
        try:
            resp = page.request.get(f"{API}/api/health", timeout=30000)
            body = resp.text()
            ok = resp.status == 200 and "ok" in body.lower()
            record(
                "Backend /api/health",
                ok,
                f"status={resp.status} body={body[:80]}",
                int((time.time() - t0) * 1000),
            )
        except Exception as e:
            record("Backend /api/health", False, str(e))

        # --- 2. Frontend loads ---
        t0 = time.time()
        try:
            resp = page.goto(BASE, wait_until="networkidle", timeout=45000)
            page.screenshot(path=str(OUT / "01-home.png"), full_page=True)
            ok = resp is not None and resp.status < 400
            title = page.title()
            record(
                "Frontend home loads",
                ok,
                f"status={getattr(resp, 'status', None)} title={title!r}",
                int((time.time() - t0) * 1000),
            )
        except Exception as e:
            record("Frontend home loads", False, str(e))

        # --- 3. Login page ---
        t0 = time.time()
        try:
            page.goto(f"{BASE}/login", wait_until="networkidle", timeout=45000)
            page.screenshot(path=str(OUT / "02-login.png"), full_page=True)
            email = page.get_by_label("Email")
            password = page.get_by_label("Password")
            sign_in = page.get_by_role("button", name="Sign In")
            ok = email.is_visible() and password.is_visible() and sign_in.is_visible()
            record(
                "Login form visible",
                ok,
                "Email/Password/Sign In present",
                int((time.time() - t0) * 1000),
            )
        except Exception as e:
            record("Login form visible", False, str(e))

        # --- 4. Unauthenticated redirect ---
        for path in PROTECTED[:4]:
            t0 = time.time()
            try:
                page.goto(f"{BASE}{path}", wait_until="networkidle", timeout=30000)
                url = page.url
                ok = "/login" in url
                record(
                    f"Auth gate: {path}",
                    ok,
                    f"landed={url}",
                    int((time.time() - t0) * 1000),
                )
            except Exception as e:
                record(f"Auth gate: {path}", False, str(e))

        # --- 5. Login attempts for seed accounts ---
        login_ok_email: str | None = None
        for email_addr in ACCOUNTS:
            t0 = time.time()
            try:
                # Clear session between attempts
                context.clear_cookies()
                page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30000)
                page.get_by_label("Email").fill(email_addr)
                page.get_by_label("Password").fill(PASSWORD)
                page.get_by_role("button", name="Sign In").click()
                try:
                    page.wait_for_url("**/dashboard**", timeout=20000)
                    page.wait_for_load_state("networkidle")
                    ok = True
                    login_ok_email = email_addr
                    detail = f"redirected to {page.url}"
                except Exception:
                    # Capture error banner if any
                    body_text = page.locator("body").inner_text()[:200]
                    ok = False
                    detail = f"url={page.url} body={body_text!r}"
                safe = email_addr.split("@")[0]
                page.screenshot(
                    path=str(OUT / f"03-login-{safe}.png"), full_page=True
                )
                record(
                    f"Login: {email_addr}",
                    ok,
                    detail,
                    int((time.time() - t0) * 1000),
                )
                if ok:
                    break  # keep session for authenticated checks
            except Exception as e:
                record(f"Login: {email_addr}", False, str(e))

        # --- 6. Authenticated smoke (if login worked) ---
        if login_ok_email:
            auth_routes = [
                ("/dashboard", ["Dashboard"]),
                ("/procurements", ["Procurement", "Request", "Draft"]),
                ("/approvals", ["Approval", "Pending", "Request"]),
            ]
            for path, keywords in auth_routes:
                t0 = time.time()
                try:
                    page.goto(f"{BASE}{path}", wait_until="networkidle", timeout=45000)
                    page.wait_for_timeout(500)
                    text = page.locator("body").inner_text()
                    hit = any(k.lower() in text.lower() for k in keywords)
                    not_login = "/login" not in page.url
                    ok = hit and not_login
                    safe = path.strip("/").replace("/", "-") or "root"
                    page.screenshot(
                        path=str(OUT / f"04-auth-{safe}.png"), full_page=True
                    )
                    record(
                        f"Auth page: {path}",
                        ok,
                        f"url={page.url} keywords_hit={hit}",
                        int((time.time() - t0) * 1000),
                    )
                except Exception as e:
                    record(f"Auth page: {path}", False, str(e))

            # Invalid credentials should fail
            t0 = time.time()
            try:
                context.clear_cookies()
                page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30000)
                page.get_by_label("Email").fill("admin@ebidding.com")
                page.get_by_label("Password").fill("WrongPassword999!")
                page.get_by_role("button", name="Sign In").click()
                page.wait_for_timeout(2500)
                still_login = "/login" in page.url
                record(
                    "Reject bad password",
                    still_login,
                    f"url={page.url}",
                    int((time.time() - t0) * 1000),
                )
            except Exception as e:
                record("Reject bad password", False, str(e))
        else:
            record("Authenticated pages", False, "No seed account could log in")

        # --- 7. API CORS/proxy via frontend /api ---
        t0 = time.time()
        try:
            resp = page.request.get(f"{BASE}/api/health", timeout=30000)
            record(
                "Frontend /api/health proxy",
                resp.status == 200,
                f"status={resp.status} body={resp.text()[:80]}",
                int((time.time() - t0) * 1000),
            )
        except Exception as e:
            record("Frontend /api/health proxy", False, str(e))

        # --- 8. Console / page errors summary ---
        # Ignore expected 401 noise from unauthenticated auth-gate probes
        # and favicon/noise; flag everything else.
        def is_noise(msg: str) -> bool:
            m = msg.lower()
            return (
                "favicon" in m
                or "status of 401" in m
                or "401 (" in m
            )

        severe = [
            e
            for e in console_errors + page_errors
            if e and not is_noise(e)
        ]
        record(
            "No severe console/page errors",
            len(severe) == 0,
            f"count={len(severe)} ignored_401_noise=True"
            + (f" sample={severe[:3]!r}" if severe else ""),
        )

        browser.close()

    passed = sum(1 for r in results if r["ok"])
    failed = sum(1 for r in results if not r["ok"])
    report = {
        "started": started,
        "finished": datetime.now(timezone.utc).isoformat(),
        "frontend": BASE,
        "backend": API,
        "passed": passed,
        "failed": failed,
        "total": len(results),
        "results": results,
    }
    report_path = OUT / "report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print()
    print(f"Summary: {passed}/{len(results)} passed, {failed} failed")
    print(f"Report:  {report_path}")
    print(f"Shots:   {OUT}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
