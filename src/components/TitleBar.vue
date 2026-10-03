<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minus, Square, X, Copy, Sparkles } from 'lucide-vue-next'
import { useVersionStore } from '@/stores/version'

const appWindow = getCurrentWindow()
const versionStore = useVersionStore()
const isMaximized = ref(false)
let unlisten: (() => void) | null = null

onMounted(async () => {
  try {
    isMaximized.value = await appWindow.isMaximized()
    unlisten = await appWindow.listen('tauri://resize', async () => {
      isMaximized.value = await appWindow.isMaximized()
    })
  } catch {
    // Graceful fallback for non-Tauri browser preview
  }
})

onUnmounted(() => {
  if (unlisten) unlisten()
})

async function handleMinimize() {
  try {
    await appWindow.minimize()
  } catch {}
}

async function handleToggleMaximize() {
  try {
    await appWindow.toggleMaximize()
  } catch {}
}

async function handleClose() {
  try {
    await appWindow.close()
  } catch {}
}

// Manual drag implementation per Tauri v2 docs
async function handleDragStart(e: MouseEvent) {
  if (e.buttons === 1) {
    if (e.detail === 2) {
      handleToggleMaximize()
    } else {
      try {
        await appWindow.startDragging()
      } catch {}
    }
  }
}
</script>

<template>
  <div 
    class="h-[36px] w-full flex justify-between items-center bg-background/85 backdrop-blur-md select-none fixed top-0 left-0 z-50 border-b border-border/50 shadow-sm"
  >
    <div 
      class="flex-1 flex items-center gap-2.5 px-3.5 h-full cursor-default"
      @mousedown="handleDragStart"
    >
      <div class="relative flex items-center justify-center">
        <img src="/icons/logo.png" alt="logo" class="w-4 h-4 pointer-events-none drop-shadow-sm" />
        <span class="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
      </div>

      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold tracking-tight text-foreground/90 pointer-events-none">
          Nehal Quest Helper
        </span>
        <span class="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-muted/70 text-muted-foreground border border-border/40 pointer-events-none">
          v{{ versionStore.currentVersion }}
        </span>
      </div>

      <!-- Update Available Pill in Titlebar -->
      <button
        v-if="versionStore.hasUpdate"
        @click="versionStore.showUpdateModal = true"
        class="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-primary/20 to-purple-500/20 hover:from-primary/30 hover:to-purple-500/30 border border-primary/40 text-[11px] font-semibold text-primary shadow-sm hover:shadow transition-all cursor-pointer animate-pulse"
      >
        <Sparkles class="w-3 h-3 text-primary animate-spin" style="animation-duration: 4s;" />
        <span>Update Available</span>
      </button>
    </div>

    <!-- Window control buttons -->
    <div class="flex h-full items-center">
      <button 
        @click="handleMinimize" 
        class="hover:bg-accent/80 hover:text-accent-foreground inline-flex items-center justify-center h-full w-[44px] transition-colors text-muted-foreground"
        title="Minimize"
        tabindex="-1"
      >
        <Minus class="w-3.5 h-3.5" />
      </button>

      <button 
        @click="handleToggleMaximize" 
        class="hover:bg-accent/80 hover:text-accent-foreground inline-flex items-center justify-center h-full w-[44px] transition-colors text-muted-foreground"
        title="Maximize"
        tabindex="-1"
      >
        <Copy v-if="isMaximized" class="w-3.5 h-3.5 rotate-180" />
        <Square v-else class="w-3 h-3" />
      </button>

      <button 
        @click="handleClose" 
        class="hover:bg-destructive hover:text-white inline-flex items-center justify-center h-full w-[44px] transition-colors text-muted-foreground"
        title="Close"
        tabindex="-1"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
  <!-- Spacer to prevent content from going under titlebar -->
  <div class="h-[36px] w-full shrink-0"></div>
</template>
