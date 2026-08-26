/**
 * Platform capability detection.
 *
 * 원칙:
 * 1. feature detection 우선. OS 이름으로 기능을 추측하지 않는다.
 *    (iOS 여부는 "iOS라서 못 한다"가 아니라 안내 문구를 고를 때만 쓴다.)
 * 2. SSR 안전. window/navigator 접근은 전부 가드한다.
 * 3. 부수효과 없음. 권한 요청(Notification.requestPermission,
 *    geolocation, push subscribe)은 여기서 하지 않는다.
 */

export interface PlatformCapabilities {
  /* --- OS 힌트 (안내 문구 분기에만 사용) --- */
  isIOS: boolean;
  isAndroid: boolean;
  isDesktop: boolean;

  /* --- 실행 형태 --- */
  isStandalonePWA: boolean;

  /* --- feature detection --- */
  supportsServiceWorker: boolean;
  supportsPush: boolean;
  supportsNotification: boolean;
  supportsGeolocation: boolean;
}

/**
 * 서버 렌더링 시점의 기본값.
 * 아무 기능도 "있다"고 가정하지 않는다 — hydration 이후 실제 값으로 대체된다.
 */
export const DEFAULT_CAPABILITIES: PlatformCapabilities = {
  isIOS: false,
  isAndroid: false,
  isDesktop: false,
  isStandalonePWA: false,
  supportsServiceWorker: false,
  supportsPush: false,
  supportsNotification: false,
  supportsGeolocation: false,
};

/** navigator.standalone 은 iOS Safari 전용이라 표준 타입에 없다. */
interface IOSNavigator extends Navigator {
  standalone?: boolean;
}

/** iPadOS 는 Mac 으로 위장하므로 터치 지원 여부까지 함께 본다. */
function detectIOS(nav: Navigator): boolean {
  if (/iPad|iPhone|iPod/.test(nav.userAgent)) return true;
  return nav.platform === "MacIntel" && nav.maxTouchPoints > 1;
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosNav = window.navigator as IOSNavigator;
  if (iosNav.standalone === true) return true;
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches
  );
}

/**
 * 현재 환경의 capability 를 계산한다.
 * 브라우저에서만 의미가 있으며, 서버에서는 DEFAULT_CAPABILITIES 를 돌려준다.
 */
export function getPlatformCapabilities(): PlatformCapabilities {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return DEFAULT_CAPABILITIES;
  }

  const nav = navigator;
  const isIOS = detectIOS(nav);
  const isAndroid = /Android/.test(nav.userAgent);

  const supportsServiceWorker = "serviceWorker" in nav;

  return {
    isIOS,
    isAndroid,
    // 터치가 없고 모바일 OS 도 아니면 데스크톱으로 본다.
    isDesktop: !isIOS && !isAndroid && nav.maxTouchPoints === 0,
    isStandalonePWA: detectStandalone(),
    supportsServiceWorker,
    // Push 는 Service Worker 위에서만 동작한다. 둘 다 있어야 "지원"이다.
    supportsPush: supportsServiceWorker && "PushManager" in window,
    supportsNotification: "Notification" in window,
    supportsGeolocation: "geolocation" in nav,
  };
}
