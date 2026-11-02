#!/usr/bin/env python3
"""서버 시계 - 웹사이트 서버 시간을 밀리초(소수점)까지 표시합니다.

예매는 직접 하고, 정확한 타이밍만 확인하는 용도입니다.

원리:
  HTTP 응답의 Date 헤더는 초 단위까지만 나옵니다. 요청을 빠르게 반복해서
  보내면 '서버 시각 S초'라는 응답이 [요청 보낸 순간, 응답 받은 순간] 사이에
  찍혔다는 걸 알 수 있습니다. 즉 (서버시간 - 내시간) 오차는
      S - 응답받은시각  <  오차  <  S + 1 - 요청보낸시각
  범위 안에 있습니다. 여러 번 측정해 이 범위들의 교집합을 구하면
  오차를 수십 ms 이내로 좁힐 수 있습니다.

사용법:
  python server_clock.py                         # 기본: NOL 티켓
  python server_clock.py https://example.com     # 다른 사이트
  python server_clock.py --cli                   # 창 없이 터미널에 표시
"""
import argparse
import email.utils
import http.client
import os
import ssl
import sys
import threading
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

DEFAULT_URL = "https://tickets.interpark.com/"
KST = timezone(timedelta(hours=9))


class ServerClock:
    def __init__(self, url, samples=40):
        u = urlparse(url if "://" in url else "https://" + url)
        self.scheme = u.scheme
        self.host = u.hostname
        self.port = u.port
        self.path = u.path or "/"
        self.samples = samples
        self.offset = None        # 서버시간 - 내 PC 시간 (초)
        self.error_ms = None      # 추정 오차 범위 (± ms)
        self.rtt_ms = None
        self.status = "측정 준비 중..."
        self._conn = None

    # --- HTTP -------------------------------------------------------------
    def _connect(self):
        proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
        if self.scheme == "https":
            ctx = ssl.create_default_context()
            if proxy:
                p = urlparse(proxy)
                conn = http.client.HTTPSConnection(p.hostname, p.port or 80, timeout=5, context=ctx)
                conn.set_tunnel(self.host, self.port or 443)
            else:
                conn = http.client.HTTPSConnection(self.host, self.port, timeout=5, context=ctx)
        else:
            conn = http.client.HTTPConnection(self.host, self.port, timeout=5)
        conn.connect()
        return conn

    def _probe(self):
        """HEAD 요청 1회 → (보낸시각, 받은시각, 서버 Date 초)"""
        if self._conn is None:
            self._conn = self._connect()  # 연결을 미리 열어둬 왕복 시간을 줄임
        try:
            t0 = time.time()
            self._conn.request("HEAD", self.path, headers={"User-Agent": "server-clock", "Cache-Control": "no-cache"})
            resp = self._conn.getresponse()
            t1 = time.time()
            resp.read()
            if resp.getheader("Connection", "").lower() == "close":
                self._conn.close()
                self._conn = None
        except Exception:
            if self._conn:
                self._conn.close()
            self._conn = None
            raise
        date = resp.getheader("Date")
        if not date:
            raise RuntimeError("서버가 Date 헤더를 보내지 않습니다.")
        server_sec = email.utils.parsedate_to_datetime(date).timestamp()
        return t0, t1, server_sec

    # --- 측정 -------------------------------------------------------------
    def calibrate(self):
        lo, hi = -1e18, 1e18
        rtts = []
        prev_sec = None
        got = 0
        tries = 0
        while got < self.samples and tries < self.samples * 4:
            tries += 1
            try:
                t0, t1, s = self._probe()
            except Exception as e:
                self.status = f"연결 오류: {e}"
                time.sleep(1)
                continue
            got += 1
            rtts.append(t1 - t0)
            lo = max(lo, s - t1)
            hi = min(hi, s + 1 - t0)
            if hi < lo:  # 측정 중 이상치 → 다시 시작
                lo, hi = s - t1, s + 1 - t0
            # 초가 바뀌는 순간을 노려서 다음 요청 시점을 조절 (정밀도 향상)
            if prev_sec is not None and lo > -1e17:
                est = (lo + hi) / 2
                server_now = time.time() + est
                frac = server_now % 1
                # 다음 초 경계 직전/직후에 요청이 도착하도록 대기
                target = (got % 2) * 0.5 * (hi - lo)
                wait = (1 - frac) - (t1 - t0) / 2 - (hi - lo) / 2 + target
                if 0 < wait < 1:
                    time.sleep(wait)
            prev_sec = s
            self.offset = (lo + hi) / 2
            self.error_ms = (hi - lo) / 2 * 1000
            self.rtt_ms = sorted(rtts)[len(rtts) // 2] * 1000
            self.status = f"측정 중 {got}/{self.samples}"
        if self.offset is None:
            self.status = "측정 실패"
        else:
            self.status = "측정 완료"

    def now(self):
        if self.offset is None:
            return None
        return datetime.fromtimestamp(time.time() + self.offset, KST)


def fmt(dt):
    return dt.strftime("%H:%M:%S.") + f"{dt.microsecond // 1000:03d}"


def run_cli(clock):
    threading.Thread(target=clock.calibrate, daemon=True).start()
    try:
        while True:
            dt = clock.now()
            line = f"{clock.host}  서버시간 {fmt(dt)}" if dt else "측정 중..."
            if clock.offset is not None:
                line += f"  (내PC 대비 {clock.offset*1000:+.0f}ms, 오차 ±{clock.error_ms:.0f}ms)"
            sys.stdout.write("\r" + line + f"  [{clock.status}]   ")
            sys.stdout.flush()
            time.sleep(0.01)
    except KeyboardInterrupt:
        print()


def run_gui(clock):
    import tkinter as tk

    root = tk.Tk()
    root.title(f"서버 시계 - {clock.host}")
    root.configure(bg="#111")
    root.attributes("-topmost", True)  # 항상 위 (예매 창 옆에 띄워두기)

    host = tk.Label(root, text=clock.host, fg="#aaa", bg="#111", font=("Helvetica", 12))
    host.pack(padx=20, pady=(14, 0))
    big = tk.Label(root, text="--:--:--.---", fg="#fff", bg="#111", font=("Consolas", 48, "bold"))
    big.pack(padx=20)
    info = tk.Label(root, text="", fg="#8c8", bg="#111", font=("Helvetica", 11))
    info.pack(padx=20, pady=(0, 6))
    btn = tk.Button(root, text="다시 측정", command=lambda: start())
    btn.pack(pady=(0, 12))

    def start():
        clock.offset = None
        threading.Thread(target=clock.calibrate, daemon=True).start()

    def tick():
        dt = clock.now()
        if dt:
            big.config(text=fmt(dt))
            info.config(text=f"내 PC보다 {clock.offset*1000:+.0f}ms · 오차 ±{clock.error_ms:.0f}ms · "
                             f"응답 {clock.rtt_ms:.0f}ms · {clock.status}")
        else:
            info.config(text=clock.status)
        root.after(7, tick)

    start()
    tick()
    root.mainloop()


def main():
    ap = argparse.ArgumentParser(description="웹사이트 서버 시간을 밀리초까지 표시")
    ap.add_argument("url", nargs="?", default=DEFAULT_URL, help=f"사이트 주소 (기본 {DEFAULT_URL})")
    ap.add_argument("--cli", action="store_true", help="창 없이 터미널에 표시")
    ap.add_argument("--samples", type=int, default=40, help="측정 횟수 (기본 40)")
    args = ap.parse_args()

    clock = ServerClock(args.url, args.samples)
    if args.cli:
        run_cli(clock)
        return
    try:
        run_gui(clock)
    except Exception as e:  # tkinter 없음 / 화면 없음
        print(f"창을 열 수 없어 터미널 모드로 실행합니다 ({e})")
        run_cli(clock)


if __name__ == "__main__":
    main()
