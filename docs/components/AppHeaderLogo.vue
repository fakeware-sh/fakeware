<script setup lang="ts">
const appConfig = useAppConfig()
const { hasLogo, headerLightUrl, headerDarkUrl, contextMenuItems } = useLogoAssets()
</script>

<template>
  <span class="flex items-center gap-2">
    <UContextMenu
      v-if="hasLogo"
      :items="contextMenuItems"
    >
      <UColorModeImage
        :light="headerLightUrl"
        :dark="headerDarkUrl"
        :alt="appConfig.header?.logo?.alt || appConfig.header?.title"
        :class="['h-6 w-auto shrink-0', appConfig.header?.logo?.class]"
      />
    </UContextMenu>
    <span class="text-highlighted text-lg font-bold">
      {{ appConfig.header?.title }}
    </span>
  </span>
</template>
