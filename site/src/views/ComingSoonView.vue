<script setup lang="ts">
defineProps<{ icon: string; title: string; description: string }>()
</script>

<template>
	<div class="page coming-soon">
		<v-icon :icon="icon" size="72" color="primary"></v-icon>
		<h1>{{ title }}</h1>
		<p class="text-muted">{{ description }}</p>
		<p class="soon">Coming soon...</p>
	</div>
</template>

<style scoped>
.coming-soon {
	text-align: center;
	padding-top: 96px;
}

h1 {
	font-size: 28px;
	font-weight: bold;
	margin: 12px 0 8px;
}

.soon {
	margin-top: 24px;
	font-size: 22px;
	color: var(--c-link);
}
</style>
