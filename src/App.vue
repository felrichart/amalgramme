<script setup>
import { useRoute } from 'vue-router';
import { syncVersion } from './services/sync.js';
import SyncPrompt from './components/SyncPrompt.vue';
const route = useRoute();
</script>

<template>
  <!-- Views read saves once at mount: remount when a sync rewrites them. -->
  <router-view :key="`${route.fullPath}#${syncVersion}`" />
  <SyncPrompt />
</template>
