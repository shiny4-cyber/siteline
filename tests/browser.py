"""Real-browser verification and screenshot capture for SITELINE.

Runs Firefox (headed on Xvfb; headless Firefox does not composite WebGL here) against a
local static server on an ephemeral port, drives the game through its debug hooks, asserts
gameplay, then captures the three dossier screenshots at 1280x800 (the rules cap the long
side at 1280 and the short side must be at least 480).
"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

try:
    from PIL import Image
    _PIL = True
except ImportError:  # Hermes python ships Playwright; the system python ships Pillow.
    _PIL = False

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "screenshots"
SHOTS.mkdir(exist_ok=True)
results = []


def check(name, ok, detail=""):
    results.append((name, "PASS" if ok else "FAIL", detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}", flush=True)
    return ok


def start_server():
    proc = subprocess.Popen(
        [os.environ.get("NODE_BIN", "node"), str(ROOT / "serve.mjs")], stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, env={**os.environ, "PORT": "0"},
    )
    line = proc.stdout.readline()
    url = line.strip().split()[-1].rstrip("/")
    return proc, url


def visible_enemy(page):
    """Project living defenders through the live camera; returns how many are on screen."""
    return page.evaluate(
        """() => {
          const s = window.__state;
          const cam = window.__camera;
          if (!cam) return -1;
          let n = 0;
          for (const b of s.actors) {
            if (!b.alive || b.team !== 'defend') continue;
            const v = new (window.__three.Vector3)(b.x, b.y + 1.35, b.z).project(cam);
            const dist = Math.hypot(b.x - s.player.x, b.z - s.player.z);
            if (v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95 && dist < 40) n++;
          }
          return n;
        }"""
    )


def pixel_report(path):
    if not _PIL:
        out = subprocess.check_output([os.environ.get("PIL_PYTHON", "/usr/bin/python3"), "-c", PIXEL_HELPER, str(path)])
        stats = json.loads(out)
        stats["path"] = str(path.relative_to(ROOT))
        stats["bytes"] = path.stat().st_size
        return stats
    im = Image.open(path).convert("RGB")
    w, h = im.size
    small = im.resize((96, 60))
    px = list(small.getdata())
    mean = tuple(sum(c[i] for c in px) // len(px) for i in range(3))
    dark = sum(1 for c in px if sum(c) < 24) / len(px)
    hues = len({(c[0] // 32, c[1] // 32, c[2] // 32) for c in px})
    return {"path": str(path.relative_to(ROOT)), "size": [w, h], "bytes": path.stat().st_size,
            "mean": list(mean), "dark_fraction": round(dark, 3), "palette_bins": hues}


PIXEL_HELPER = """
import json,sys
from PIL import Image
im=Image.open(sys.argv[1]).convert('RGB'); w,h=im.size
sm=im.resize((96,60)); px=list(sm.getdata())
mean=[sum(c[i] for c in px)//len(px) for i in range(3)]
dark=sum(1 for c in px if sum(c)<24)/len(px)
bins=len({(c[0]//32,c[1]//32,c[2]//32) for c in px})
print(json.dumps({'size':[w,h],'mean':mean,'dark_fraction':round(dark,3),'palette_bins':bins}))
"""


def capture(page, name):
    path = SHOTS / name
    page.screenshot(path=str(path), type="jpeg", quality=88)
    report = pixel_report(path)
    ok = report["bytes"] <= 262144 and max(report["size"]) <= 1280 and min(report["size"]) >= 480
    check(f"capture {name}: caps", ok, json.dumps({k: report[k] for k in ('size', 'bytes')}))
    check(f"capture {name}: not black", report["dark_fraction"] < 0.55 and sum(report["mean"]) > 90,
          f"mean={report['mean']} dark={report['dark_fraction']}")
    return report


def main():
    from playwright.sync_api import sync_playwright
    server, url = start_server()
    errors, shots = [], []
    try:
        with sync_playwright() as p:
            browser = p.firefox.launch(
                headless=False,
                firefox_user_prefs={"webgl.force-enabled": True, "webgl.disabled": False},
            )
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: errors.append(m.type + ": " + m.text) if m.type == "error" else None)

            page.goto(url + "/?seed=0", wait_until="domcontentloaded")
            page.wait_for_function("() => typeof window.__debug === 'function'", timeout=20000)
            page.wait_for_timeout(700)
            check("webgl2 context", page.evaluate(
                "() => { const c = document.createElement('canvas');"
                " return !!(c.getContext('webgl2')); }"), "firefox/llvmpipe")
            page.click("#play")
            page.wait_for_timeout(300)
            check("click-to-play starts the match", page.evaluate("() => window.__debug().started"))

            # ---- buy phase economics
            before = page.evaluate("() => window.__debug()")
            bought = page.evaluate("() => window.__buy('armour')")
            after = page.evaluate("() => window.__debug()")
            check("buy menu purchase charges money and grants armour",
                  bought and after["armour"] == 100 and before["money"] - after["money"] == 650,
                  f"money {before['money']}->{after['money']}, armour={after['armour']}")

            # ---- live phase, bot count
            page.evaluate("() => { window.__advance(12.4); }")
            live = page.evaluate("() => window.__debug()")
            check("buy phase ends and the round goes live", live["phase"] == "live",
                  f"phase={live['phase']} timer={live['timer']}")
            check("seven bots spawned, both teams present", live["botsAlive"] == 7 and
                  {b["team"] for b in live["bots"]} == {"attack", "defend"},
                  f"alive={live['botsAlive']}")
            check("HUD names the active objective site",
                  page.evaluate("() => document.getElementById('siteLabel').textContent.includes('OBJECTIVE')"),
                  page.evaluate("() => document.getElementById('siteLabel').textContent"))
            check("grenade stock is exposed to the HUD",
                  all(k in live["stock"] for k in ("frag", "smoke", "flash")), json.dumps(live["stock"]))

            # ---- hero capture: west lane, site door and defenders in frame
            page.evaluate("() => { window.__pause(true); window.__tp(-9, 9, 0, -0.02); window.__advance(0.35); }")
            page.wait_for_timeout(250)
            hero_enemies = visible_enemy(page)
            check("approach-lane capture has enemies on screen", hero_enemies >= 1, f"enemies={hero_enemies}")
            shots.append(capture(page, "1-approach-lane.jpg"))

            # ---- firefight capture: close quarters, player alive, muzzle flash live
            page.evaluate("""() => {
              window.__pause(false);
              const s = window.__state;
              const d = s.actors.find(b => b.team === 'defend' && b.alive);
              d.x = -3.2; d.z = -8.4; d.hp = 100; d.alive = true;
              window.__tp(-3.2, -4.2, 0, 0.02);
              window.__advance(0.2);
              window.__pause(true);
              window.__fire();
            }""")
            page.wait_for_timeout(200)
            ff = page.evaluate("() => window.__debug()")
            ff_enemies = visible_enemy(page)
            check("firefight: player alive at shutter", ff["alive"] and ff["hp"] > 0, f"hp={ff['hp']}")
            check("firefight: enemy in frame", ff_enemies >= 1, f"enemies={ff_enemies}")
            check("firefight: firing consumed ammo", ff["mag"] < 30, f"mag={ff['mag']}")
            shots.append(capture(page, "2-live-firefight.jpg"))

            # ---- ammo / reload / spread assertions in the live match
            ammo = page.evaluate("""() => {
              window.__pause(false);
              const s = window.__state, p = s.player;
              p.mag = 30; p.reserve = 90; p.reload = 0; p.cooldown = 0;
              window.__fire(); window.__advance(0.12); window.__fire();
              const afterFire = p.mag;
              window.__reload(); window.__advance(2.6);
              return {afterFire, afterReload: p.mag, reserve: p.reserve};
            }""")
            check("firing consumes ammo and reload refills the magazine",
                  ammo["afterFire"] <= 28 and ammo["afterReload"] == 30 and ammo["reserve"] < 90,
                  json.dumps(ammo))

            cost = page.evaluate("""() => {
              window.__pause(false);
              const t0 = performance.now();
              window.__advance(1);
              return performance.now() - t0;
            }""")
            check("simulation cost under 260 ms per simulated second", cost < 260, f"{cost:.1f} ms")

            # ---- objective session on a clean page (?nobots=1); close the WebGL page first
            page.close()
            page2 = browser.new_page(viewport={"width": 1280, "height": 800})
            page2.on("pageerror", lambda e: errors.append(str(e)))
            page2.goto(url + "/?nobots=1&seed=0", wait_until="domcontentloaded")
            page2.wait_for_function("() => typeof window.__debug === 'function'", timeout=20000)
            page2.wait_for_timeout(800)
            page2.click("#play")
            site = page2.evaluate("() => window.__debug().site")
            page2.evaluate("(site) => { window.__advance(12.4); window.__tp(site.x, site.z, 0, 0); }", site)
            check("objective page is live with no bots",
                  page2.evaluate("() => window.__debug().phase") == "live")
            page2.evaluate("() => { window.__state.input.plant = true; window.__advance(3.6); }")
            planted = page2.evaluate("() => window.__debug().bomb")
            check("charge plants on site with a live fuse", bool(planted) and planted["state"] == "armed"
                  and 0 < planted["timer"] <= 40, json.dumps(planted))
            page2.evaluate("() => { window.__state.input.plant = false; window.__advance(41); }")
            ended = page2.evaluate("() => window.__debug()")
            check("detonation wins the round for the attackers",
                  ended["phase"] == "roundEnd" and ended["score"]["attack"] == 1,
                  f"{ended['phase']} {ended['score']}")
            page2.evaluate("() => window.__advance(5.4)")
            restarted = page2.evaluate("() => window.__debug()")
            check("next round starts and score persists",
                  restarted["round"] == 2 and restarted["score"]["attack"] == 1,
                  f"round={restarted['round']} score={restarted['score']}")
            check("round summary is present with score and income",
                  ended.get("summary") is not None and "SCORE" in page2.evaluate("() => document.getElementById('ovStats').textContent"),
                  json.dumps(ended.get("summary")))

            # ---- buy menu capture on a fresh page (buy phase, no bots)
            page2.close()
            page3 = browser.new_page(viewport={"width": 1280, "height": 800})
            page3.on("pageerror", lambda e: errors.append(str(e)))
            page3.goto(url + "/?nobots=1&seed=0", wait_until="domcontentloaded")
            page3.wait_for_function("() => typeof window.__debug === 'function'", timeout=20000)
            page3.wait_for_timeout(800)
            page3.click("#play")
            page3.keyboard.press("KeyB")
            page3.wait_for_timeout(400)
            open_now = page3.evaluate("() => document.getElementById('buy').classList.contains('on')")
            check("buy menu opens on B", open_now)
            page3.evaluate("() => { document.getElementById('buyMoney').textContent = '800'; }")
            shots.append(capture(page3, "3-buy-menu.jpg"))
            page3.close()

            check("zero page errors", not errors, "; ".join(errors[:3]))
            browser.close()
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()

    print("\n=== browser results ===")
    for name, status, detail in results:
        print(f"{status:4} {name}" + (f"  [{detail}]" if detail else ""))
    print("\n=== screenshots ===")
    print(json.dumps(shots, indent=1))
    failed = [r for r in results if r[1] == "FAIL"]
    (ROOT / "tests" / "browser-report.json").write_text(json.dumps(
        {"results": [{"test": n, "result": s, "detail": d} for n, s, d in results], "screenshots": shots}, indent=1))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
