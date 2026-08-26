"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_CAPABILITIES,
  getPlatformCapabilities,
  type PlatformCapabilities,
} from "@/lib/platform";

/**
 * capability 를 hydration 이후에 읽는다.
 * 첫 렌더는 서버와 동일한 DEFAULT_CAPABILITIES 로 두어 hydration mismatch 를 막는다.
 */
export function usePlatformCapabilities(): PlatformCapabilities {
  const [capabilities, setCapabilities] =
    useState<PlatformCapabilities>(DEFAULT_CAPABILITIES);

  useEffect(() => {
    setCapabilities(getPlatformCapabilities());
  }, []);

  return capabilities;
}
