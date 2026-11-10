/// <reference types="vite/client" />

import type { StudioBridge } from '@shared/bridge'

declare global {
  interface Window {
    studio?: StudioBridge
  }
}

export {}
