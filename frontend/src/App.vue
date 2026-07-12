<script setup lang="ts">
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  NLoadingBarProvider,
  darkTheme,
  type GlobalThemeOverrides,
} from 'naive-ui'

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#2DD4A8',
    primaryColorHover: '#3EE0B5',
    primaryColorPressed: '#22B890',
    primaryColorSuppl: '#2DD4A8',
    bodyColor: '#0B1220',
    cardColor: '#121A2B',
    modalColor: '#121A2B',
    popoverColor: '#182236',
    borderColor: 'rgba(148,163,184,0.12)',
    textColorBase: '#E8EEF9',
    textColor1: '#E8EEF9',
    textColor2: '#94A3B8',
    textColor3: '#64748B',
    fontFamily: "'DM Sans', 'PingFang SC', sans-serif",
    fontFamilyMono: "'JetBrains Mono', monospace",
    borderRadius: '10px',
  },
  Button: {
    heightMedium: '40px',
    heightLarge: '44px',
  },
  Input: {
    heightMedium: '44px',
  },
}
</script>

<template>
  <NConfigProvider :theme="darkTheme" :theme-overrides="themeOverrides">
    <NLoadingBarProvider>
      <NDialogProvider>
        <NMessageProvider>
          <RouterView />
        </NMessageProvider>
      </NDialogProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>
