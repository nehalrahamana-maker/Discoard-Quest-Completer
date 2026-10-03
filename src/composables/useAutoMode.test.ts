import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { autoMode, autoScheduleInterval, autoClaimRewards, autoCycleAccounts, autoStartOnLaunch, useAutoMode } from './useAutoMode'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

describe('useAutoMode', () => {
  beforeEach(() => {
    const storage: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => { storage[key] = val },
      removeItem: (key: string) => { delete storage[key] },
      clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
    })
    setActivePinia(createPinia())
  })

  it('provides reactive configuration state', () => {
    const {
      autoMode: mode,
      autoScheduleInterval: schedule,
      autoClaimRewards: claim,
      autoCycleAccounts: cycle,
      autoStartOnLaunch: launch,
    } = useAutoMode()

    expect(mode.value).toBe(autoMode.value)
    expect(schedule.value).toBe(autoScheduleInterval.value)
    expect(claim.value).toBe(autoClaimRewards.value)
    expect(cycle.value).toBe(autoCycleAccounts.value)
    expect(launch.value).toBe(autoStartOnLaunch.value)
  })

  it('updates state reactively', () => {
    const { autoScheduleInterval: schedule } = useAutoMode()
    schedule.value = '12h'
    expect(autoScheduleInterval.value).toBe('12h')
    schedule.value = '24h'
  })
})
