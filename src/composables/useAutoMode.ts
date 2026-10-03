import { ref, watch } from 'vue'
import { useQuestsStore } from '@/stores/quests'
import { useAuthStore } from '@/stores/auth'
import { acceptQuest as acceptQuestApi, claimQuestReward } from '@/api/tauri'
import { getQuestKind } from '@/utils/questTasks'
import { getSimulationExecutables } from '@/utils/executables'

export type AutoScheduleInterval = 'disabled' | '1h' | '6h' | '12h' | '24h'

const AUTO_MODE_KEY = 'questHelper_autoMode'
const AUTO_SCHEDULE_KEY = 'questHelper_autoScheduleInterval'
const AUTO_CLAIM_KEY = 'questHelper_autoClaimRewards'
const AUTO_CYCLE_KEY = 'questHelper_autoCycleAccounts'
const AUTO_START_LAUNCH_KEY = 'questHelper_autoStartOnLaunch'
const LAST_RUN_KEY = 'questHelper_lastAutoRunTime'

function getStorageItem(key: string): string | null {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    return localStorage.getItem(key)
  }
  return null
}

function setStorageItem(key: string, value: string) {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value)
  }
}

export const autoMode = ref(getStorageItem(AUTO_MODE_KEY) === 'true')
export const autoScheduleInterval = ref<AutoScheduleInterval>(
  (getStorageItem(AUTO_SCHEDULE_KEY) as AutoScheduleInterval) || '24h'
)
export const autoClaimRewards = ref(getStorageItem(AUTO_CLAIM_KEY) !== 'false')
export const autoCycleAccounts = ref(getStorageItem(AUTO_CYCLE_KEY) !== 'false')
// Default autoStartOnLaunch to TRUE so auto mode fires on app startup automatically
export const autoStartOnLaunch = ref(getStorageItem(AUTO_START_LAUNCH_KEY) !== 'false')

export const autoModeRunning = ref(false)
export const autoModeLogs = ref<string[]>([])
export const lastAutoRunTime = ref<string | null>(getStorageItem(LAST_RUN_KEY))
export const nextAutoRunCountdown = ref<string>('')

let timerId: ReturnType<typeof setInterval> | null = null

function addLog(msg: string) {
  const time = new Date().toLocaleTimeString()
  autoModeLogs.value.unshift(`[${time}] ${msg}`)
  if (autoModeLogs.value.length > 50) {
    autoModeLogs.value.pop()
  }
}

watch(autoMode, val => setStorageItem(AUTO_MODE_KEY, String(val)))
watch(autoScheduleInterval, val => setStorageItem(AUTO_SCHEDULE_KEY, val))
watch(autoClaimRewards, val => setStorageItem(AUTO_CLAIM_KEY, String(val)))
watch(autoCycleAccounts, val => setStorageItem(AUTO_CYCLE_KEY, String(val)))
watch(autoStartOnLaunch, val => setStorageItem(AUTO_START_LAUNCH_KEY, String(val)))

export function useAutoMode() {
  const questsStore = useQuestsStore()
  const authStore = useAuthStore()

  /**
   * Run the complete automated quest pipeline for the current logged-in account:
   * 1. Refresh quests & Orbs balance.
   * 2. Accept all unenrolled active quests.
   * 3. Queue & execute incomplete video, stream, and game quests.
   * 4. Auto-claim rewards & Orbs for finished quests.
   * 5. Check and claim Nitro Orbs monthly rewards.
   */
  async function runAutoForCurrentAccount() {
    if (!authStore.user) return

    addLog(`Starting auto-run for account ${authStore.user.username}...`)

    try {
      // 1. Fetch fresh quests and Orbs balance
      await questsStore.fetchQuests(true, true).catch(err => addLog(`Quest fetch notice: ${err}`))
      await questsStore.fetchOrbsBalance(true).catch(err => addLog(`Orbs fetch notice: ${err}`))
      await authStore.fetchNitroProgramReward(true).catch(err => addLog(`Nitro fetch notice: ${err}`))

      // 2. Accept all unenrolled non-expired quests
      const toAccept = questsStore.quests.filter(q => {
        if (q.user_status?.enrolled_at) return false
        if (!q.config.expires_at) return true
        return new Date(q.config.expires_at) > new Date()
      })

      if (toAccept.length > 0) {
        addLog(`Accepting ${toAccept.length} quest(s)...`)
        for (const q of toAccept) {
          try {
            await acceptQuestApi(q.id)
            questsStore.updateQuestEnrollment(q.id, new Date().toISOString())
            addLog(`Accepted quest: ${q.config.messages.quest_name}`)
          } catch (e) {
            addLog(`Failed to accept ${q.config.messages.quest_name}: ${e}`)
          }
          await new Promise(r => setTimeout(r, 400))
        }
        await questsStore.fetchQuests(true, true)
      } else {
        addLog('All active quests are already enrolled.')
      }

      // 3. Auto-claim existing ready-to-claim rewards
      if (autoClaimRewards.value) {
        const readyToClaim = questsStore.quests.filter(
          q => q.user_status?.completed_at && !q.user_status?.claimed_at
        )
        if (readyToClaim.length > 0) {
          addLog(`Claiming rewards for ${readyToClaim.length} finished quest(s)...`)
          for (const q of readyToClaim) {
            try {
              await claimQuestReward(q.id)
              addLog(`Claimed reward: ${q.config.messages.quest_name}`)
            } catch (e) {
              addLog(`Claim notice for ${q.config.messages.quest_name}: ${e}`)
            }
          }
          await questsStore.fetchQuests(true, true)
          await questsStore.fetchOrbsBalance(true)
        }
      }

      // 4. Queue and run incomplete quests
      const toRun = questsStore.quests.filter(q => {
        if (!q.user_status?.enrolled_at) return false
        if (q.user_status?.completed_at) return false
        if (q.config.expires_at && new Date(q.config.expires_at) < new Date()) return false
        const kind = getQuestKind(q)
        // Skip activity quests — they require manual user interaction inside Discord
        if (kind === 'activity') return false
        return true
      })

      if (toRun.length > 0) {
        addLog(`Queuing ${toRun.length} quest(s)...`)

        if (questsStore.gameQuestMode === 'simulate') {
          const capabilities = await questsStore.initPlatformCapabilities()
          if (capabilities) {
            const gamesList = await questsStore.getDetectableGames()
            for (const q of toRun) {
              if (getQuestKind(q) !== 'stream') {
                // Video quests don't need exe selection — add directly
                questsStore.addToQueue(q)
                continue
              }
              const appId = q.config.application?.id
              if (!appId) { questsStore.addToQueue(q); continue }
              const game = gamesList.find(g => g.id === appId)
              if (!game) { questsStore.addToQueue(q); continue }
              // Use correct PlatformCapabilities field names: os & executableOsPriority
              const simExes = getSimulationExecutables(
                game.executables,
                capabilities.os,
                capabilities.executableOsPriority
              )
              if (simExes.length > 0) {
                addLog(`🎮 Auto-selected exe "${simExes[0].name}" for ${q.config.messages.quest_name}`)
                questsStore.addToQueue(q, simExes[0].name)
              } else {
                // No compatible exe — queue anyway; store will raise a recoverable soft error
                questsStore.addToQueue(q)
              }
            }
          } else {
            // Capabilities unavailable — queue all and let store handle it
            toRun.forEach(q => questsStore.addToQueue(q))
          }
        } else {
          // CDP or heartbeat mode — no exe needed, queue everything
          toRun.forEach(q => {
            addLog(`📋 Queued: ${q.config.messages.quest_name}`)
            questsStore.addToQueue(q)
          })
        }

        addLog('▶️ Starting quest queue...')
        questsStore.startQueue()

        // Wait for the entire queue to drain (poll every second)
        await new Promise<void>(resolve => {
          const checkInterval = setInterval(() => {
            if (!questsStore.isQueueRunning && !questsStore.activeQuestId) {
              clearInterval(checkInterval)
              resolve()
            }
          }, 1000)
        })

        addLog('✅ Quest queue completed!')

        // Auto-claim newly completed rewards after queue finishes
        if (autoClaimRewards.value) {
          await questsStore.fetchQuests(true, true)
          const newlyCompleted = questsStore.quests.filter(
            q => q.user_status?.completed_at && !q.user_status?.claimed_at
          )
          if (newlyCompleted.length > 0) {
            addLog(`Claiming rewards for ${newlyCompleted.length} newly completed quest(s)...`)
            for (const q of newlyCompleted) {
              try {
                await claimQuestReward(q.id)
                addLog(`💎 Claimed reward: ${q.config.messages.quest_name}`)
              } catch (e) {
                addLog(`⚠️ Claim notice for ${q.config.messages.quest_name}: ${e}`)
              }
              await new Promise(r => setTimeout(r, 300))
            }
            await questsStore.fetchQuests(true, true)
            await questsStore.fetchOrbsBalance(true)
          }
        }
      } else {
        addLog('No pending quests to run. All done! ✨')
      }
    } catch (err) {
      addLog(`Error during account auto-run: ${err}`)
    }
  }

  /**
   * Main entry point to run full Auto Mode pipeline:
   * Optionally auto-cycles across all saved/detected accounts.
   */
  async function runAutoPipeline() {
    if (autoModeRunning.value) return
    if (!authStore.user) return

    autoModeRunning.value = true
    try {
      await runAutoForCurrentAccount()

      // Cycle across other detected accounts if enabled
      if (autoCycleAccounts.value && authStore.detectedAccounts.length > 1) {
        const currentUsername = authStore.user.username
        const otherAccounts = authStore.detectedAccounts.filter(
          acc => acc.user.username !== currentUsername
        )

        for (const acc of otherAccounts) {
          addLog(`🔄 Switching to account ${acc.user.username}...`)
          const success = await authStore.loginWithToken(acc.token)
          if (success) {
            await runAutoForCurrentAccount()
          }
        }
      }

      const now = new Date().toISOString()
      lastAutoRunTime.value = now
      localStorage.setItem(LAST_RUN_KEY, now)
      addLog('🎉 Fully auto task collection & quest execution complete!')
    } catch (e) {
      addLog(`Auto Mode pipeline error: ${e}`)
    } finally {
      autoModeRunning.value = false
    }
  }

  /**
   * Get remaining milliseconds for the next scheduled auto-run
   */
  function getIntervalMs(interval: AutoScheduleInterval): number {
    switch (interval) {
      case '1h':
        return 60 * 60 * 1000
      case '6h':
        return 6 * 60 * 60 * 1000
      case '12h':
        return 12 * 60 * 60 * 1000
      case '24h':
      default:
        return 24 * 60 * 60 * 1000
    }
  }

  /**
   * Update the countdown timer display for next auto-run
   */
  function updateCountdown() {
    if (!autoMode.value || autoScheduleInterval.value === 'disabled' || !lastAutoRunTime.value) {
      nextAutoRunCountdown.value = ''
      return
    }

    const lastRun = new Date(lastAutoRunTime.value).getTime()
    const nextRun = lastRun + getIntervalMs(autoScheduleInterval.value)
    const diff = nextRun - Date.now()

    if (diff <= 0) {
      nextAutoRunCountdown.value = 'Due now'
      if (!autoModeRunning.value) {
        runAutoPipeline()
      }
    } else {
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const secs = Math.floor((diff % (1000 * 60)) / 1000)
      nextAutoRunCountdown.value = `${hours}h ${mins}m ${secs}s`
    }
  }

  function initAutoScheduler() {
    if (timerId) clearInterval(timerId)
    timerId = setInterval(updateCountdown, 1000)
    updateCountdown()
  }

  return {
    autoMode,
    autoScheduleInterval,
    autoClaimRewards,
    autoCycleAccounts,
    autoStartOnLaunch,
    autoModeRunning,
    autoModeLogs,
    lastAutoRunTime,
    nextAutoRunCountdown,
    runAutoPipeline,
    initAutoScheduler,
  }
}
