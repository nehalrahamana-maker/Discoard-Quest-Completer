<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useI18n } from 'vue-i18n'
import {
  LayoutDashboard,
  Gamepad2,
  Settings2,
  Terminal
} from 'lucide-vue-next'

export type AppTab = 'home' | 'game' | 'settings' | 'debug'

const props = defineProps<{
  current: AppTab
  debugEnabled: boolean
}>()

const emit = defineEmits<{
  navigate: [tab: AppTab]
}>()

const { t } = useI18n()

const items = [
  { key: 'home' as const, label: 'nav.home', icon: LayoutDashboard },
  { key: 'game' as const, label: 'nav.game_simulator', icon: Gamepad2 },
  { key: 'settings' as const, label: 'nav.settings', icon: Settings2 },
  { key: 'debug' as const, label: 'nav.debug', icon: Terminal, debugOnly: true },
]
</script>

<template>
  <nav class="flex min-w-0 items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border/40 backdrop-blur-sm overflow-x-auto" :aria-label="t('general.title')">
    <Button
      v-for="item in items"
      v-show="!item.debugOnly || props.debugEnabled"
      :key="item.key"
      size="sm"
      variant="ghost"
      :aria-current="props.current === item.key ? 'page' : undefined"
      :class="cn(
        'relative shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold gap-1.5 transition-all duration-200 select-none cursor-pointer',
        props.current === item.key
          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/95 hover:text-primary-foreground'
          : 'text-muted-foreground hover:bg-background/80 hover:text-foreground'
      )"
      @click="emit('navigate', item.key)"
    >
      <component :is="item.icon" class="h-3.5 w-3.5 shrink-0" />
      <span>{{ t(item.label) }}</span>
    </Button>
  </nav>
</template>
