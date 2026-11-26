<script setup lang="ts">
import { RouterView } from 'vue-router'
import TopNavigationBar from '@/components/TopNavigationBar.vue'
import { syncThemeWithDocument } from '@/composables/useThemeMode'

syncThemeWithDocument()
</script>

<template>
  <v-app>
    <TopNavigationBar />
    <v-main>
      <RouterView />
    </v-main>
    <footer class="site-footer text-muted">
      Powered by
      <a href="https://github.com/cedar-ai-project/personal-librarian" target="_blank" rel="noopener">Personal Librarian</a>
      · 内容来自<a href="https://weread.qq.com/" target="_blank" rel="noopener">微信读书</a>
      <br />
      © 2026 Shanshan Shen · 原创内容采用
      <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/deed.zh-hans" target="_blank" rel="noopener">CC BY-NC-ND 4.0</a>
      许可，禁止商用 · 书中摘录与封面版权归原作者和出版社所有
    </footer>
  </v-app>
</template>

<style scoped>
.site-footer {
  text-align: center;
  font-size: 13px;
  padding: 24px 16px 32px;
}
</style>
