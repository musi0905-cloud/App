"""오토클릭: Ctrl+A를 누르면 마우스 위치에서 1초 동안 10회 클릭합니다.

- Ctrl+A : 클릭 시작 (1초에 10회)
- Ctrl+Q : 프로그램 종료

Ctrl 키를 뗀 뒤에 클릭이 시작됩니다. (Ctrl을 누른 채로 클릭하면
브라우저에서 새 탭이 열리는 등 Ctrl+클릭으로 처리되기 때문)
"""

import sys
import threading
import time

from pynput import keyboard, mouse

CLICKS = 10          # 클릭 횟수
DURATION = 1.0       # 몇 초 동안 클릭할지

mouse_ctl = mouse.Controller()
pressed_ctrl = set()
busy = threading.Lock()
stop_event = threading.Event()

CTRL_KEYS = {keyboard.Key.ctrl, keyboard.Key.ctrl_l, keyboard.Key.ctrl_r}


def is_letter(key, letter):
    """Ctrl을 누른 상태에서도 글자 키를 정확히 알아보기 위한 검사."""
    ch = getattr(key, "char", None)
    vk = getattr(key, "vk", None)
    ctrl_char = chr(ord(letter) - ord("a") + 1)   # Ctrl+A -> '\x01'
    if ch in (letter, letter.upper(), ctrl_char):
        return True
    return sys.platform == "win32" and vk == ord(letter.upper())


def run_clicks():
    if not busy.acquire(blocking=False):
        return  # 이미 클릭 중이면 무시
    try:
        # Ctrl을 뗄 때까지 기다림 (최대 2초)
        deadline = time.perf_counter() + 2
        while pressed_ctrl and time.perf_counter() < deadline:
            time.sleep(0.01)

        interval = DURATION / CLICKS
        start = time.perf_counter()
        for n in range(CLICKS):
            wait = start + n * interval - time.perf_counter()
            if wait > 0:
                time.sleep(wait)
            mouse_ctl.click(mouse.Button.left)
        elapsed = time.perf_counter() - start
        print(f"  완료: {CLICKS}회 클릭 ({elapsed:.2f}초)")
    finally:
        busy.release()


def on_press(key):
    if key in CTRL_KEYS:
        pressed_ctrl.add(key)
        return
    if pressed_ctrl and is_letter(key, "a"):
        print("Ctrl+A 감지 → 클릭 시작!")
        threading.Thread(target=run_clicks, daemon=True).start()
    elif pressed_ctrl and is_letter(key, "q"):
        print("종료합니다.")
        stop_event.set()
        return False


def on_release(key):
    pressed_ctrl.discard(key)


def main():
    print("=" * 40)
    print(" 오토클릭")
    print(f"  Ctrl+A : {DURATION:g}초 동안 {CLICKS}회 클릭")
    print("  Ctrl+Q : 종료")
    print("=" * 40)
    print("마우스를 클릭할 위치에 두고 Ctrl+A를 누르세요.\n")
    with keyboard.Listener(on_press=on_press, on_release=on_release) as listener:
        listener.join()


if __name__ == "__main__":
    main()
