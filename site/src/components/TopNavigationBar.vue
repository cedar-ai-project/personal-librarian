<script setup lang="ts">
import { useThemeMode } from '@/composables/useThemeMode'

const { isDark, toggleTheme } = useThemeMode()

const sections = [
	{ to: '/', icon: 'mdi-bookshelf', title: '书架' },
	{ to: '/profile', icon: 'mdi-account-heart-outline', title: '阅读画像' },
	{ to: '/recommend', icon: 'mdi-book-heart-outline', title: '好书推荐' },
	{ to: '/tree', icon: 'mdi-file-tree-outline', title: '知识树' },
]
</script>

<template>
	<v-app-bar :border=10 flat>
		<v-btn
		to="/"
		class="ml-2 ml-md-4 mr-2"
		rounded="0"
		variant="flat"
		:active="false"
		style="height: 100%"
		>
			<span class="nav-name">Personal Librarian</span>
		</v-btn>
		<v-divider vertical class="mr-4 d-none d-md-flex"></v-divider>
		<v-btn
		v-for="section in sections"
		:key="section.to"
		:to="section.to"
		:exact="section.to === '/'"
		class="mr-2 d-none d-md-flex"
		:prepend-icon="section.icon"
		>
			{{ section.title }}
		</v-btn>
		<v-spacer></v-spacer>
		<v-btn
		icon
		variant="text"
		title="切换亮/暗模式"
		aria-label="切换亮/暗模式"
		@click="toggleTheme"
		>
			<v-icon :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"></v-icon>
		</v-btn>
		<v-menu>
			<template #activator="{ props }">
				<v-btn icon variant="text" class="mr-2 d-md-none" aria-label="菜单" v-bind="props">
					<v-icon icon="mdi-menu"></v-icon>
				</v-btn>
			</template>
			<v-list density="compact">
				<v-list-item
				v-for="section in sections"
				:key="section.to"
				:to="section.to"
				:exact="section.to === '/'"
				:prepend-icon="section.icon"
				:title="section.title"
				></v-list-item>
			</v-list>
		</v-menu>
		<div class="mr-md-4"></div>
	</v-app-bar>
</template>

<style scoped>
.nav-name {
	font-size: 18px;
	font-weight: bold;
	letter-spacing: 0;
	text-transform: none;
}
</style>
