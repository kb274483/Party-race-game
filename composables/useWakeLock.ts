/**
 * useWakeLock — 行動裝置螢幕恆亮
 *
 * 使用 Screen Wake Lock API 防止螢幕自動關閉。
 * - 頁面切到背景時 wake lock 會自動被瀏覽器釋放，
 *   切回前景時自動重新申請。
 * - 不支援的瀏覽器會靜默 fallback，不拋錯。
 */
export function useWakeLock() {
  let wakeLock: WakeLockSentinel | null = null

  const acquire = async () => {
    if (!('wakeLock' in navigator)) return
    try {
      wakeLock = await navigator.wakeLock.request('screen')
    } catch {
      // 權限被拒或裝置不支援，靜默略過
    }
  }

  const release = async () => {
    if (!wakeLock) return
    try {
      await wakeLock.release()
    } catch {
      // 忽略
    } finally {
      wakeLock = null
    }
  }

  // 頁面從背景切回前景時重新申請
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      acquire()
    }
  }

  onMounted(() => {
    acquire()
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    release()
  })
}
