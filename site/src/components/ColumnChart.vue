<script setup lang="ts">
import { computed } from 'vue'

export interface Column {
	label: string
	value: number
	// Text shown in the tooltip and, when `showValues` is set, above the bar.
	valueText: string
	// Axis label; empty to leave the tick blank.
	tick: string
}

const props = defineProps<{ columns: Column[]; showValues?: boolean; height?: number }>()
const max = computed(() => Math.max(...props.columns.map((c) => c.value), 1))
</script>

<template>
	<div class="column-chart" :style="{ '--plot-height': `${height ?? 140}px` }">
		<div class="plot">
			<div
			v-for="col in columns"
			:key="col.label"
			class="col"
			tabindex="0"
			:aria-label="`${col.label}：${col.valueText}`"
			>
				<span v-if="showValues" class="value">{{ col.valueText }}</span>
				<div class="bar" :style="{ height: `${(col.value / max) * 100}%` }"></div>
				<div class="tip" role="tooltip">{{ col.label }}<b>{{ col.valueText }}</b></div>
			</div>
		</div>
		<div class="axis">
			<span v-for="col in columns" :key="col.label" class="tick">{{ col.tick }}</span>
		</div>
	</div>
</template>

<style scoped>
.plot {
	height: var(--plot-height);
	display: flex;
	align-items: flex-end;
	gap: 2px;
	border-bottom: 1px solid var(--c-card-border);
}

.col {
	flex: 1;
	height: 100%;
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
	align-items: center;
	outline: none;
	cursor: default;
}

.bar {
	width: 100%;
	max-width: 48px;
	min-height: 0;
	background: var(--c-chart);
	border-radius: 4px 4px 0 0;
	transition: filter 0.15s;
}

.value {
	font-size: 12px;
	color: var(--c-text-muted);
	margin-bottom: 2px;
	white-space: nowrap;
}

.col:hover .bar,
.col:focus-visible .bar {
	filter: brightness(1.2);
}

.tip {
	display: none;
	position: absolute;
	bottom: calc(100% + 6px);
	left: 50%;
	transform: translateX(-50%);
	z-index: 1;
	padding: 4px 8px;
	border-radius: 6px;
	font-size: 12px;
	line-height: 1.5;
	white-space: nowrap;
	color: var(--c-text);
	background: var(--c-bg);
	border: 1px solid var(--c-card-border);
	box-shadow: 0 2px 8px var(--c-shadow);
}

.tip b {
	margin-left: 6px;
	font-weight: bold;
}

.col:hover .tip,
.col:focus-visible .tip {
	display: block;
}

.axis {
	display: flex;
	gap: 2px;
	margin-top: 4px;
}

.tick {
	flex: 1;
	text-align: center;
	font-size: 12px;
	color: var(--c-text-muted);
	white-space: nowrap;
}
</style>
