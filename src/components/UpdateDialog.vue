<script setup lang="ts">
import { computed } from 'vue'
import { useVersionStore } from '@/stores/version'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Loader2,
  HardDrive
} from 'lucide-vue-next'

const versionStore = useVersionStore()

const isOpen = computed({
  get: () => versionStore.showUpdateModal,
  set: (val: boolean) => {
    versionStore.showUpdateModal = val
  }
})

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return dateStr
  }
}

async function openGithubRelease() {
  if (versionStore.latestRelease?.html_url) {
    try {
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(versionStore.latestRelease.html_url)
    } catch {
      window.open(versionStore.latestRelease.html_url, '_blank')
    }
  }
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-w-xl border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl p-6 sm:p-7 overflow-hidden">
      <!-- Glow background accent -->
      <div class="pointer-events-none absolute -top-24 -right-24 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
      <div class="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl" />

      <DialogHeader class="relative space-y-3">
        <div class="flex items-center gap-3">
          <div class="h-11 w-11 rounded-2xl bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/25">
            <Sparkles class="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <DialogTitle class="text-xl font-bold tracking-tight flex items-center gap-2">
              <span>Auto Update Available</span>
              <Badge variant="outline" class="border-primary/40 bg-primary/10 text-primary font-mono text-xs">
                {{ versionStore.latestRelease?.tag_name || 'New' }}
              </Badge>
            </DialogTitle>
            <DialogDescription class="text-xs text-muted-foreground mt-0.5">
              Published on {{ formatDate(versionStore.latestRelease?.published_at || '') }} · Nehal Quest Helper
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <!-- Version comparison bar -->
      <div class="relative mt-2 p-3.5 rounded-xl border border-border/50 bg-muted/40 backdrop-blur flex items-center justify-between gap-4">
        <div class="flex items-center gap-2 text-xs">
          <span class="text-muted-foreground">Current:</span>
          <span class="font-mono font-semibold px-2 py-0.5 rounded-md bg-background/80 border text-foreground">
            v{{ versionStore.currentVersion }}
          </span>
        </div>
        <div class="text-xs text-primary font-bold">➔</div>
        <div class="flex items-center gap-2 text-xs">
          <span class="text-muted-foreground">New Version:</span>
          <span class="font-mono font-bold px-2 py-0.5 rounded-md bg-primary/20 border border-primary/40 text-primary shadow-sm">
            {{ versionStore.latestRelease?.tag_name }}
          </span>
        </div>
      </div>

      <!-- Release Asset Info -->
      <div v-if="versionStore.bestWindowsAsset" class="relative flex items-center justify-between text-xs px-1 text-muted-foreground">
        <span class="flex items-center gap-1.5 truncate">
          <HardDrive class="h-3.5 w-3.5 shrink-0 text-primary" />
          <span class="truncate font-mono">{{ versionStore.bestWindowsAsset.name }}</span>
        </span>
        <span class="shrink-0 font-medium font-mono text-foreground/80">
          {{ formatBytes(versionStore.bestWindowsAsset.size) }}
        </span>
      </div>

      <!-- Changelog preview -->
      <div v-if="versionStore.latestRelease?.body" class="relative space-y-1.5">
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <span class="font-semibold text-foreground/90 flex items-center gap-1.5">
            <FileCode class="h-3.5 w-3.5 text-primary" />
            What's New in this Release:
          </span>
        </div>
        <div class="max-h-44 overflow-y-auto rounded-xl border border-border/40 bg-background/60 p-3.5 text-xs text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap select-text">
          {{ versionStore.latestRelease.body }}
        </div>
      </div>

      <!-- Downloading Progress state -->
      <div v-if="versionStore.updateStatus === 'downloading'" class="relative space-y-2 p-4 rounded-xl border border-primary/30 bg-primary/5">
        <div class="flex items-center justify-between text-xs">
          <span class="font-semibold text-primary flex items-center gap-2">
            <Loader2 class="h-3.5 w-3.5 animate-spin" />
            Downloading update from GitHub...
          </span>
          <span class="font-mono font-bold text-primary">{{ versionStore.downloadProgress }}%</span>
        </div>
        <div class="h-2.5 w-full bg-muted/60 rounded-full overflow-hidden p-0.5 border border-primary/20">
          <div
            class="h-full bg-gradient-to-r from-primary via-purple-500 to-pink-500 rounded-full transition-all duration-200 shadow-sm shadow-primary/50"
            :style="{ width: `${versionStore.downloadProgress}%` }"
          />
        </div>
        <div class="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
          <span>{{ versionStore.downloadedSizeFormatted }}</span>
          <span>⚡ {{ versionStore.downloadSpeed }}</span>
        </div>
      </div>

      <!-- Ready to install state -->
      <div v-else-if="versionStore.updateStatus === 'ready'" class="relative p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 flex items-center gap-3">
        <CheckCircle2 class="h-6 w-6 text-emerald-500 shrink-0" />
        <div class="text-xs">
          <p class="font-semibold text-emerald-600 dark:text-emerald-400">Update package ready!</p>
          <p class="text-muted-foreground mt-0.5">The update is downloaded and ready to apply. Click below to install.</p>
        </div>
      </div>

      <!-- Error state -->
      <div v-else-if="versionStore.updateStatus === 'error'" class="relative p-3.5 rounded-xl border border-destructive/40 bg-destructive/10 flex items-center gap-2.5 text-xs text-destructive">
        <AlertCircle class="h-4 w-4 shrink-0" />
        <span class="truncate">{{ versionStore.downloadError || versionStore.checkError || 'Failed to download update' }}</span>
      </div>

      <!-- Action buttons -->
      <div class="relative flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <label class="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            :checked="versionStore.autoCheckUpdates"
            @change="versionStore.setAutoCheckUpdates(($event.target as HTMLInputElement).checked)"
            class="rounded border-border text-primary focus:ring-primary"
          />
          <span>Check for updates on launch</span>
        </label>

        <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button variant="ghost" size="sm" @click="openGithubRelease" class="gap-1.5 text-xs">
            <ExternalLink class="h-3.5 w-3.5" />
            GitHub
          </Button>

          <Button
            v-if="versionStore.updateStatus === 'ready'"
            size="sm"
            class="gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25"
            @click="versionStore.applyUpdate"
          >
            <CheckCircle2 class="h-3.5 w-3.5" />
            Apply & Restart
          </Button>

          <Button
            v-else-if="versionStore.updateStatus === 'downloading'"
            disabled
            size="sm"
            class="gap-1.5 text-xs font-semibold"
          >
            <Loader2 class="h-3.5 w-3.5 animate-spin" />
            Downloading...
          </Button>

          <Button
            v-else
            size="sm"
            class="gap-1.5 text-xs font-semibold bg-gradient-to-r from-primary to-purple-600 hover:opacity-95 text-white shadow-lg shadow-primary/25"
            @click="versionStore.startDownload"
          >
            <Download class="h-3.5 w-3.5" />
            Download & Update Now
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
