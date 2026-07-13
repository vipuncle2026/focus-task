<template>
  <div
    class="task-item"
    :class="{ done: task.done, selected, compact, pending: task.syncStatus === 'pending', conflict: task.syncStatus === 'conflict' }"
    :data-client-id="task.clientId"
    tabindex="0"
    role="button"
    :aria-label="task.title || '未命名任务'"
    @click="$emit('select')"
    @keydown.enter="$emit('select')"
    @contextmenu="$emit('contextmenu', $event)"
  >
    <button
      class="task-drag-handle"
      type="button"
      title="拖动排序"
      aria-label="拖动排序"
      @click.stop
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="4" cy="3" r="1.1" />
        <circle cx="10" cy="3" r="1.1" />
        <circle cx="4" cy="7" r="1.1" />
        <circle cx="10" cy="7" r="1.1" />
        <circle cx="4" cy="11" r="1.1" />
        <circle cx="10" cy="11" r="1.1" />
      </svg>
    </button>
    <div class="task-checkbox" :class="{ done: task.done }" @click.stop="$emit('toggle')" role="checkbox" :aria-checked="task.done">
      <svg v-if="task.done" class="check-icon" width="9" height="9" viewBox="0 0 9 9" fill="none">
        <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <div class="task-content">
      <div class="task-title-row">
        <div v-if="isEditing" class="inline-edit-wrap">
          <input
            ref="editInput"
            v-model="editValue"
            class="inline-edit-input"
            @keydown.enter="confirmEdit"
            @keydown.escape="cancelEdit"
            @blur="confirmEdit"
          />
        </div>
        <div v-else class="task-title" @dblclick.stop="startEdit">{{ task.title || '未命名任务' }}</div>
        <div v-if="task.syncStatus === 'pending'" class="task-state state-pending">待同步</div>
        <div v-else-if="task.syncStatus === 'conflict'" class="task-state state-conflict">冲突</div>
      </div>
      <div v-if="task.syncStatus === 'conflict'" class="task-alert">本地修改与服务端版本冲突，当前保留本地内容</div>
      <div v-if="!compact && (task.due || task.tag || task.updatedAt)" class="task-meta">
        <span v-if="task.due" class="task-due" :class="{ overdue: isOverdue }">{{ formatDate(task.due) }}</span>
        <span v-if="task.tag" class="task-tag">{{ task.tag }}</span>
        <span v-if="task.syncStatus === 'pending' && task.updatedAt" class="task-sync-time">刚刚修改</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import type { Task } from '@/stores/taskStore'
import { formatRelativeDue, isOverdueDateTime } from '@/utils/dateTime'

const props = defineProps<{
  task: Task
  quadrant: number
  selected: boolean
  compact?: boolean
}>()

const emit = defineEmits(['select', 'toggle', 'contextmenu', 'dblclick-title'])

const isOverdue = computed(() => {
  if (!props.task.due || props.task.done) return false
  return isOverdueDateTime(props.task.due)
})

function formatDate(dateStr: string) {
  return formatRelativeDue(dateStr)
}

// ─── Inline Edit ───
const isEditing = ref(false)
const editValue = ref('')
const editInput = ref<HTMLInputElement | null>(null)

async function startEdit() {
  isEditing.value = true
  editValue.value = props.task.title || ''
  await nextTick()
  editInput.value?.focus()
  editInput.value?.select()
}

function confirmEdit() {
  if (!isEditing.value) return
  const newTitle = editValue.value.trim()
  isEditing.value = false
  if (newTitle && newTitle !== props.task.title) {
    emit('dblclick-title', props.task.clientId, newTitle)
  }
}

function cancelEdit() {
  isEditing.value = false
}
</script>

<style scoped>
.task-item {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 5px 6px; border-radius: var(--radius-sm);
  cursor: pointer; transition: background var(--transition);
  position: relative;
}

.task-item.task-new {
  animation: taskIn 0.2s ease-out;
}

.task-drag-handle {
  width: 16px;
  height: 18px;
  margin: -1px -2px 0 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  color: var(--text-muted);
  background: transparent;
  cursor: grab;
  opacity: 0.48;
  transition: opacity var(--transition), background var(--transition), color var(--transition);
}
.task-drag-handle svg {
  display: block;
  fill: currentColor;
}
.task-drag-handle:hover,
.task-drag-handle:focus-visible {
  opacity: 0.9;
  background: oklch(100% 0 0 / 0.72);
  outline: none;
}
.task-drag-handle:active {
  cursor: grabbing;
}

/* Quadrant-specific hover */
.q1 .task-item:hover { background: var(--q1-item-hover); }
.q2 .task-item:hover { background: var(--q2-item-hover); }
.q3 .task-item:hover { background: var(--q3-item-hover); }
.q4 .task-item:hover { background: var(--q4-item-hover); }

/* Selected indicator */
.task-item.selected::before {
  content: ''; position: absolute;
  left: 0; top: 4px; bottom: 4px;
  width: 2.5px; border-radius: 2px;
}
.q1 .task-item.selected::before { background: var(--q1-header); }
.q2 .task-item.selected::before { background: var(--q2-header); }
.q3 .task-item.selected::before { background: var(--q3-header); }
.q4 .task-item.selected::before { background: var(--q4-header); }
.task-item.selected { padding-left: 12px; }

/* Checkbox */
.task-checkbox {
  width: 15px; height: 15px; border-radius: 50%;
  border: 1.5px solid; flex-shrink: 0; cursor: pointer;
  transition: all var(--transition); margin-top: 1px;
  display: grid; place-items: center; background: var(--surface);
}
.q1 .task-checkbox { border-color: var(--q1-header); }
.q2 .task-checkbox { border-color: var(--q2-header); }
.q3 .task-checkbox { border-color: var(--q3-header); }
.q4 .task-checkbox { border-color: var(--q4-header); }

.q1 .task-checkbox:hover { background: var(--q1-header); }
.q2 .task-checkbox:hover { background: var(--q2-header); }
.q3 .task-checkbox:hover { background: var(--q3-header); }
.q4 .task-checkbox:hover { background: var(--q4-header); }

.task-checkbox.done { opacity: 1; animation: checkPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.q1 .task-checkbox.done { background: var(--q1-header); border-color: var(--q1-header); }
.q2 .task-checkbox.done { background: var(--q2-header); border-color: var(--q2-header); }
.q3 .task-checkbox.done { background: var(--q3-header); border-color: var(--q3-header); }
.q4 .task-checkbox.done { background: var(--q4-header); border-color: var(--q4-header); }

@keyframes checkPop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.3); }
  60%  { transform: scale(0.95); }
  100% { transform: scale(1); }
}

.check-icon { display: block; }

/* Content */
.task-content { flex: 1; min-width: 0; text-align: left; }
.task-title-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}
.task-title {
  font-size: 14px; font-weight: 500; color: var(--text-primary);
  line-height: 1.4; word-break: break-word; text-align: left;
  flex: 1;
  min-width: 0;
}
.task-item.done .task-title {
  text-decoration: line-through;
  color: var(--text-muted);
  animation: strikeIn 0.35s ease-out;
}
.task-state {
  flex-shrink: 0;
  margin-top: 1px;
  border-radius: 999px;
  padding: 1px 7px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.03em;
}
.state-pending {
  background: oklch(96% 0.018 240);
  color: oklch(47% 0.11 240);
}
.state-conflict {
  background: oklch(96% 0.03 25);
  color: oklch(52% 0.16 25);
}
.task-alert {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.35;
  color: oklch(50% 0.14 25);
}

@keyframes strikeIn {
  0%   { opacity: 1; color: var(--text-primary); }
  50%  { opacity: 0.6; }
  100% { opacity: 1; color: var(--text-muted); }
}

.task-meta { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
.task-due { font-size: 12px; color: var(--text-muted); }
.task-due.overdue { color: oklch(55% 0.18 20); font-weight: 500; }
.task-sync-time {
  font-size: 11px;
  color: var(--text-muted);
}
.task-tag { font-size: 11px; font-weight: 500; border-radius: 3px; padding: 1px 5px; }
.q1 .task-tag { background: var(--q1-tag-bg); color: var(--q1-header); }
.q2 .task-tag { background: var(--q2-tag-bg); color: var(--q2-header); }
.q3 .task-tag { background: var(--q3-tag-bg); color: var(--q3-header); }
.q4 .task-tag { background: var(--q4-tag-bg); color: var(--q4-header); }
.task-item.pending {
  background-image: linear-gradient(to right, transparent, oklch(98% 0.012 240));
}
.task-item.conflict {
  background-image: linear-gradient(to right, transparent, oklch(98% 0.02 20));
}

/* Compact mode (list views) */
.task-item.compact {
  padding: 3px 6px;
}
.task-item.compact .task-drag-handle {
  height: 16px;
  margin-top: -1px;
}
.task-item.compact .task-title {
  font-size: 13px;
  line-height: 1.35;
}
.task-item.compact .task-checkbox {
  width: 13px; height: 13px;
  margin-top: 2px;
}

@keyframes taskIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ─── Inline Edit ─── */
.inline-edit-wrap {
  flex: 1;
  min-width: 0;
}
.inline-edit-input {
  width: 100%;
  background: var(--surface);
  border: 1px solid oklch(60% 0.12 240);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  font: inherit;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  box-shadow: 0 0 0 3px oklch(60% 0.12 240 / 0.12);
}

/* ─── Focus Visible ─── */
.task-item:focus-visible {
  outline: 2px solid oklch(60% 0.12 240);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
</style>
