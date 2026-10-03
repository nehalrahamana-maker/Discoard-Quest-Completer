import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface ReleaseAsset {
    name: string
    browser_download_url: string
    size: number
    content_type?: string
}

export interface ReleaseInfo {
    tag_name: string
    html_url: string
    published_at: string
    name: string
    body?: string
    assets?: ReleaseAsset[]
    prerelease?: boolean
}

export type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'installing' | 'error'

/**
 * Parse a version string like "0.9.0-rc1" into its numeric components [0, 9, 0].
 * Pre-release suffixes (e.g. -rc1, -beta2) are stripped before parsing.
 */
function parseSemver(version: string): [number, number, number] {
    const cleaned = version.replace(/^v/, '').split('-')[0]
    const parts = cleaned.split('.').map(Number)
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
}

/**
 * Compare two semver strings. Returns -1 / 0 / 1.
 */
function compareSemver(a: string, b: string): -1 | 0 | 1 {
    const [a0, a1, a2] = parseSemver(a)
    const [b0, b1, b2] = parseSemver(b)
    if (a0 !== b0) return a0 < b0 ? -1 : 1
    if (a1 !== b1) return a1 < b1 ? -1 : 1
    if (a2 !== b2) return a2 < b2 ? -1 : 1
    return 0
}

export const useVersionStore = defineStore('version', () => {
    const currentVersion = ref<string>('Dev')
    const latestRelease = ref<ReleaseInfo | null>(null)
    const checkError = ref<string | null>(null)
    const isChecking = ref(false)
    const hasChecked = ref(false)
    const checkPreRelease = ref(localStorage.getItem('checkPreRelease') === 'true')
    
    // Auto-update configuration
    const githubRepo = ref<string>(localStorage.getItem('githubRepo') || 'nehalrahamana-maker/Discoard-Quest-Completer')
    const autoCheckUpdates = ref<boolean>(localStorage.getItem('autoCheckUpdates') !== 'false')
    const autoDownloadUpdates = ref<boolean>(localStorage.getItem('autoDownloadUpdates') === 'true')
    
    // Live update download state
    const updateStatus = ref<UpdateState>('idle')
    const downloadProgress = ref<number>(0)
    const downloadSpeed = ref<string>('0 KB/s')
    const downloadedSizeFormatted = ref<string>('0 MB / 0 MB')
    const downloadError = ref<string | null>(null)
    const showUpdateModal = ref<boolean>(false)
    const downloadedBlobUrl = ref<string | null>(null)
    const downloadedFileName = ref<string>('')

    const isPreRelease = computed(() =>
        currentVersion.value !== 'Dev' && currentVersion.value.includes('rc'),
    )

    const hasUpdate = computed(() => {
        if (!latestRelease.value || currentVersion.value === 'Dev') return false
        const current = currentVersion.value.replace(/^v/, '')
        const latest = latestRelease.value.tag_name.replace(/^v/, '')
        return compareSemver(latest, current) > 0
    })

    const isLatest = computed(() => {
        return hasChecked.value && !hasUpdate.value && !checkError.value
    })

    const bestWindowsAsset = computed<ReleaseAsset | null>(() => {
        if (!latestRelease.value?.assets || latestRelease.value.assets.length === 0) return null
        const assets = latestRelease.value.assets
        // Priority 1: Windows portable zip
        const portableZip = assets.find(a => /windows.*portable.*\.zip$/i.test(a.name) || /win.*x64.*\.zip$/i.test(a.name))
        if (portableZip) return portableZip
        // Priority 2: Windows setup/msi
        const setupMsi = assets.find(a => /windows.*setup.*\.msi$/i.test(a.name) || /\.msi$/i.test(a.name))
        if (setupMsi) return setupMsi
        // Priority 3: Any zip or exe
        const anyZip = assets.find(a => /\.zip$/i.test(a.name) || /\.exe$/i.test(a.name))
        if (anyZip) return anyZip
        return assets[0] || null
    })

    async function loadCurrentVersion() {
        try {
            const res = await fetch('/version.txt')
            if (res.ok) {
                const text = await res.text()
                if (text) {
                    currentVersion.value = text.trim()
                }
            }
        } catch {
            // Keep 'Dev' as default
        }
    }

    async function checkForUpdate() {
        if (isChecking.value) return

        isChecking.value = true
        checkError.value = null
        updateStatus.value = 'checking'

        try {
            const repo = githubRepo.value.trim() || 'nehalrahamana-maker/Discoard-Quest-Completer'
            const url = checkPreRelease.value
              ? `https://api.github.com/repos/${repo}/releases`
              : `https://api.github.com/repos/${repo}/releases/latest`

            let res = await fetch(url, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json'
                }
            })

            // If the custom fork hasn't created a release yet, fall back to upstream release
            if (res.status === 404 && repo !== 'Masterain98/discord-quest-helper') {
                const fallbackUrl = checkPreRelease.value
                  ? `https://api.github.com/repos/Masterain98/discord-quest-helper/releases`
                  : `https://api.github.com/repos/Masterain98/discord-quest-helper/releases/latest`
                const fallbackRes = await fetch(fallbackUrl, {
                    headers: { 'Accept': 'application/vnd.github.v3+json' }
                })
                if (fallbackRes.ok) {
                    res = fallbackRes
                }
            }

            if (!res.ok) {
                throw new Error(`GitHub API returned ${res.status}`)
            }

            const data = await res.json()

            let releaseData = data
            if (checkPreRelease.value && Array.isArray(data)) {
                if (data.length === 0) throw new Error('No releases found')
                releaseData = data[0]
            }

            latestRelease.value = {
                tag_name: releaseData.tag_name,
                html_url: releaseData.html_url,
                published_at: releaseData.published_at,
                name: releaseData.name || releaseData.tag_name,
                body: releaseData.body || '',
                assets: Array.isArray(releaseData.assets) ? releaseData.assets.map((a: any) => ({
                    name: a.name,
                    browser_download_url: a.browser_download_url,
                    size: a.size,
                    content_type: a.content_type
                })) : [],
                prerelease: releaseData.prerelease || false
            }

            hasChecked.value = true
            
            if (hasUpdate.value) {
                updateStatus.value = 'available'
                if (autoDownloadUpdates.value) {
                    startDownload()
                }
            } else {
                updateStatus.value = 'idle'
            }
        } catch (e) {
            checkError.value = e instanceof Error ? e.message : 'Failed to check for updates'
            updateStatus.value = 'error'
            console.error('Version check failed:', e)
        } finally {
            isChecking.value = false
        }
    }

    async function startDownload() {
        const asset = bestWindowsAsset.value
        if (!asset) {
            // Fallback to opening browser if no asset found
            if (latestRelease.value?.html_url) {
                window.open(latestRelease.value.html_url, '_blank')
            }
            return
        }

        updateStatus.value = 'downloading'
        downloadProgress.value = 0
        downloadError.value = null
        downloadedFileName.value = asset.name

        try {
            const startTime = Date.now()
            let lastTime = startTime
            let lastLoaded = 0

            const response = await fetch(asset.browser_download_url)
            if (!response.ok) {
                throw new Error(`Failed to download: HTTP ${response.status}`)
            }

            const contentLength = +(response.headers.get('Content-Length') || asset.size || 0)
            const reader = response.body?.getReader()

            if (!reader) {
                // If stream reader not available, fallback to blob
                const blob = await response.blob()
                downloadedBlobUrl.value = URL.createObjectURL(blob)
                downloadProgress.value = 100
                updateStatus.value = 'ready'
                return
            }

            const chunks: Uint8Array[] = []
            let receivedLength = 0

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                chunks.push(value)
                receivedLength += value.length

                // Calculate progress
                if (contentLength > 0) {
                    const percent = Math.min(100, Math.round((receivedLength / contentLength) * 100))
                    downloadProgress.value = percent
                }

                // Calculate speed every 250ms
                const now = Date.now()
                if (now - lastTime >= 250) {
                    const timeDiff = (now - lastTime) / 1000
                    const bytesDiff = receivedLength - lastLoaded
                    const speedBps = bytesDiff / timeDiff
                    
                    if (speedBps > 1024 * 1024) {
                        downloadSpeed.value = `${(speedBps / (1024 * 1024)).toFixed(1)} MB/s`
                    } else {
                        downloadSpeed.value = `${Math.round(speedBps / 1024)} KB/s`
                    }

                    const recMb = (receivedLength / (1024 * 1024)).toFixed(1)
                    const totalMb = contentLength > 0 ? (contentLength / (1024 * 1024)).toFixed(1) : '?'
                    downloadedSizeFormatted.value = `${recMb} MB / ${totalMb} MB`

                    lastTime = now
                    lastLoaded = receivedLength
                }
            }

            const blob = new Blob(chunks as BlobPart[])
            downloadedBlobUrl.value = URL.createObjectURL(blob)
            downloadProgress.value = 100
            updateStatus.value = 'ready'
        } catch (err: any) {
            console.error('Update download error:', err)
            downloadError.value = err?.message || 'Download failed'
            updateStatus.value = 'error'
        }
    }

    async function applyUpdate() {
        updateStatus.value = 'installing'

        if (downloadedBlobUrl.value) {
            // Trigger browser/OS file download/save
            const a = document.createElement('a')
            a.href = downloadedBlobUrl.value
            a.download = downloadedFileName.value || 'Nehal-Quest-Helper-Update.zip'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
        } else if (bestWindowsAsset.value?.browser_download_url) {
            window.open(bestWindowsAsset.value.browser_download_url, '_blank')
        } else if (latestRelease.value?.html_url) {
            window.open(latestRelease.value.html_url, '_blank')
        }

        // Try Tauri shell open if available
        try {
            const { open } = await import('@tauri-apps/plugin-shell')
            if (latestRelease.value?.html_url) {
                await open(latestRelease.value.html_url)
            }
        } catch {
            // Fallback already triggered
        }
    }

    function setCheckPreRelease(value: boolean) {
        checkPreRelease.value = value
        localStorage.setItem('checkPreRelease', String(value))
        hasChecked.value = false
        latestRelease.value = null
        checkForUpdate()
    }

    function setGithubRepo(repo: string) {
        githubRepo.value = repo.trim() || 'nehalrahamana-maker/Discoard-Quest-Completer'
        localStorage.setItem('githubRepo', githubRepo.value)
        hasChecked.value = false
        latestRelease.value = null
        checkForUpdate()
    }

    function setAutoCheckUpdates(val: boolean) {
        autoCheckUpdates.value = val
        localStorage.setItem('autoCheckUpdates', String(val))
    }

    function setAutoDownloadUpdates(val: boolean) {
        autoDownloadUpdates.value = val
        localStorage.setItem('autoDownloadUpdates', String(val))
    }

    async function initialize() {
        await loadCurrentVersion()
        if (isPreRelease.value) {
            checkPreRelease.value = true
        }
        if (autoCheckUpdates.value) {
            await checkForUpdate()
        }
    }

    return {
        currentVersion,
        latestRelease,
        checkError,
        isChecking,
        hasChecked,
        hasUpdate,
        isLatest,
        isPreRelease,
        checkPreRelease,
        githubRepo,
        autoCheckUpdates,
        autoDownloadUpdates,
        updateStatus,
        downloadProgress,
        downloadSpeed,
        downloadedSizeFormatted,
        downloadError,
        showUpdateModal,
        downloadedBlobUrl,
        downloadedFileName,
        bestWindowsAsset,
        loadCurrentVersion,
        checkForUpdate,
        startDownload,
        applyUpdate,
        setCheckPreRelease,
        setGithubRepo,
        setAutoCheckUpdates,
        setAutoDownloadUpdates,
        initialize
    }
})
