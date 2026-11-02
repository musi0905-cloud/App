"""1초 동안 10회 클릭하는 오토클릭 프로그램.

사용법:
    pip install pyautogui
    python autoclicker.py            # 1초 동안 10회 클릭
    python autoclicker.py --seconds 5  # 5초 동안 (초당 10회 = 총 50회)

실행 후 3초 안에 마우스를 클릭할 위치에 올려두세요.
중단하려면 마우스를 화면 왼쪽 위 모서리로 빠르게 옮기세요 (pyautogui 비상 정지).
"""

import argparse
import time

import pyautogui

CLICKS_PER_SECOND = 10

pyautogui.PAUSE = 0          # pyautogui 기본 지연(0.1초)을 없애서 간격을 정확하게
pyautogui.FAILSAFE = True    # 마우스를 왼쪽 위 모서리로 옮기면 중단


def main():
    parser = argparse.ArgumentParser(description="초당 10회 오토클릭")
    parser.add_argument("--seconds", type=float, default=1.0, help="클릭할 시간(초), 기본 1초")
    parser.add_argument("--delay", type=int, default=3, help="시작 전 대기 시간(초), 기본 3초")
    args = parser.parse_args()

    total = round(args.seconds * CLICKS_PER_SECOND)
    interval = 1.0 / CLICKS_PER_SECOND

    for i in range(args.delay, 0, -1):
        print(f"{i}초 후 시작... 마우스를 클릭할 위치에 올려두세요")
        time.sleep(1)

    print(f"클릭 시작! ({args.seconds}초 동안 {total}회)")
    start = time.perf_counter()
    try:
        for n in range(total):
            # 시작 시각 기준으로 n번째 클릭 시각을 맞춰 오차가 쌓이지 않게 함
            target = start + n * interval
            wait = target - time.perf_counter()
            if wait > 0:
                time.sleep(wait)
            pyautogui.click()
    except pyautogui.FailSafeException:
        print("비상 정지되었습니다.")
        return

    elapsed = time.perf_counter() - start
    print(f"완료: {total}회 클릭, {elapsed:.2f}초 걸림")


if __name__ == "__main__":
    main()
