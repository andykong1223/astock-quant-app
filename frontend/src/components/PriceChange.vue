<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: number
  suffix?: string
  digits?: number
}>()

const cls = computed(() => {
  if (props.value > 0) return 'price-up'
  if (props.value < 0) return 'price-down'
  return 'price-flat'
})

const text = computed(() => {
  const d = props.digits ?? 2
  const sign = props.value > 0 ? '+' : ''
  return `${sign}${props.value.toFixed(d)}${props.suffix || ''}`
})
</script>

<template>
  <span :class="cls" class="mono">{{ text }}</span>
</template>
