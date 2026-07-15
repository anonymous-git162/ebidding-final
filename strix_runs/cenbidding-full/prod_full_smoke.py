"""Full production smoke for cenbidding.vercel.app."""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "https://cenbidding.vercel.app"
API = "https://cenbidding-backend.onrender.com"
OUT = Path(__file__).resolve().parent
PASSWORD = "Password123"

ACCOUNTS = [
    "admin@ebidding.com",
    "requester@ebidding.com",
    "approver@ebidding.com",
    "vendor@ebidding.com",
    "evaluator@ebidding.com",
]

PROTECTED = [
    "/dashboard",
    "/procurements",
    "/approvals",
    "/vendors",
    "/audit",
    "/reporting",
    "/submissions",
    "/invitations",
]

results: list[dict] = []


def record(name: str, ok: bool, detail: str = "", duration_ms: int = 0):
    results.append(
        {"name": name, "ok": ok, "detail": detail, "duration_ms": duration_ms}
    )
    status = "PASS" if ok else "FAIL"
    print(f"  [{status}] {name}" + (f" — {detail}" if detail else ""))


def is_noise(msg: str) -> bool:
    m = msg.lower()
    return "favicon" in m or "status of 401" in m or "401 (" in m


def main() -> int:
    started = datetime.now(timezone.utc).isoformat()
    print(f"CenBidding full smoke — {BASE}")
    print(f"Backend API             — {API}")
    print(f"Started                 — {started}\n")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
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

        # Health
        t0 = time.time()
        try:
            resp = page.request.get(f"{API}/api/health", timeout=30000)
            body = resp.text()
            record(
                "Backend /api/health",
                resp.status == 200 and "ok" in body.lower(),
                f"status={resp.status} body={body[:80]}",
                int((time.time() - t0) * 1000),
            )
        except Exception as e:
            record("Backend /api/health", False, str(e))

        t0 = time.time()
        try:
            resp = page.request.get(f"{BASE}/api/health", timeout=30000)
            record(
                "Frontend /api proxy health",
                resp.status == 200,
                f"status={resp.status} body={resp.text()[:80]}",
                int((time.time() - t0) * 1000),
            )
        except Exception as e:
            record("Frontend /api proxy health", False, str(e))

        # Home
        t0 = time.time()
        try:
            resp = page.goto(BASE, wait_until="networkidle", timeout=45000)
            page.screenshot(path=str(OUT / "01-home.png"), full_page=True)
            title = page.title()
            record(
                "Frontend home",
                resp is not None and resp.status < 400 and "bidding" in title.lower(),
                f"status={getattr(resp, 'status', None)} title={title!r}",
                int((time.time() - t0) * 1000),
            )
        except Exception as e:
            record("Frontend home", False, str(e))

        # Login form
        t0 = time.time()
        try:
            page.goto(f"{BASE}/login", wait_until="networkidle", timeout=45000)
            page.screenshot(path=str(OUT / "02-login.png"), full_page=True)
            ok = (
                page.get_by_label("Email").is_visible()
                and page.get_by_label("Password").is_visible()
                and page.get_by_role("button", name="Sign In").is_visible()
            )
            record("Login form", ok, "", int((time.time() - t0) * 1000))
        except Exception as e:
            record("Login form", False, str(e))

        # Auth gates
        for path in PROTECTED:
            t0 = time.time()
            try:
                page.goto(f"{BASE}{path}", wait_until="networkidle", timeout=30000)
                ok = "/login" in page.url
                record(
                    f"Auth gate {path}",
                    ok,
                    f"landed={page.url}",
                    int((time.time() - t0) * 1000),
                )
            except Exception as e:
                record(f"Auth gate {path}", False, str(e))

        # Logins
        login_ok: str | None = None
        for email in ACCOUNTS:
            t0 = time.time()
            try:
                context.clear_cookies()
                page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30000)
                page.get_by_label("Email").fill(email)
                page.get_by_label("Password").fill(PASSWORD)
                page.get_by_role("button", name="Sign In").click()
                try:
                    page.wait_for_url("**/dashboard**", timeout=20000)
                    page.wait_for_load_state("networkidle")
                    ok = True
                    detail = page.url
                    if login_ok is None:
                        login_ok = email
                except Exception:
                    ok = False
                    detail = f"url={page.url} body={page.locator('body').inner_text()[:160]!r}"
                safe = email.split("@")[0]
                page.screenshot(path=str(OUT / f"03-login-{safe}.png"), full_page=True)
                record(f"Login {email}", ok, detail, int((time.time() - t0) * 1000))
            except Exception as e:
                record(f"Login {email}", False, str(e))

        # Keep admin session for auth pages
        if login_ok:
            context.clear_cookies()
            page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30000)
            page.get_by_label("Email").fill(login_ok)
            page.get_by_label("Password").fill(PASSWORD)
            page.get_by_role("button", name="Sign In").click()
            page.wait_for_url("**/dashboard**", timeout=20000)
            page.wait_for_load_state("networkidle")

            auth_routes = [
                ("/dashboard", ["Dashboard", "Total", "Recent"]),
                ("/procurements", ["Procurement", "Request", "Draft", "RFQ", "RFP", "RFI"]),
                ("/approvals", ["Approval", "Pending", "Request", "Inbox"]),
                ("/reporting", ["Report", "Analytics", "Chart", "Export", "KPI"]),
                ("/audit", ["Audit", "Log", "Activity"]),
            ]
            for path, keywords in auth_routes:
                t0 = time.time()
                try:
                    page.goto(f"{BASE}{path}", wait_until="networkidle", timeout=45000)
                    page.wait_for_timeout(600)
                    text = page.locator("body").inner_text()
                    hit = any(k.lower() in text.lower() for k in keywords)
                    not_login = "/login" not in page.url
                    # Admin may be redirected from some routes — still ok if not crash
                    safe = path.strip("/").replace("/", "-") or "root"
                    page.screenshot(
                        path=str(OUT / f"04-auth-{safe}.png"), full_page=True
                    )
                    record(
                        f"Auth page {path}",
                        not_login and (hit or page.url.endswith(path) or path in page.url),
                        f"url={page.url} hit={hit}",
                        int((time.time() - t0) * 1000),
                    )
                except Exception as e:
                    record(f"Auth page {path}", False, str(e))

            # Bad password
            t0 = time.time()
            try:
                context.clear_cookies()
                page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30000)
                page.get_by_label("Email").fill("admin@ebidding.com")
                page.get_by_label("Password").fill("WrongPassword999!")
                page.get_by_role("button", name="Sign In").click()
                page.wait_for_timeout(2500)
                record(
                    "Reject bad password",
                    "/login" in page.url,
                    f"url={page.url}",
                    int((time.time() - t0) * 1000),
                )
            except Exception as e:
                record("Reject bad password", False, str(e))
        else:
            record("Authenticated pages", False, "No seed account logged in")

        severe = [e for e in console_errors + page_errors if e and not is_noise(e)]
        record(
            "No severe console/page errors",
            len(severe) == 0,
            f"count={len(severe)}" + (f" sample={severe[:3]!r}" if severe else ""),
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
    path = OUT / "smoke-report.json"
    path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nSummary: {passed}/{len(results)} passed, {failed} failed")
    print(f"Report:  {path}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
