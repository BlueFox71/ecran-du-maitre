import type { JdrApi } from '../../preload/index'

declare global {
  interface Window {
    jdr: JdrApi
  }
}

export {}
