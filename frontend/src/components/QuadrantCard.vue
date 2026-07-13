<template>
  <div
    class="quadrant"
    :class="['q' + quadrant, { 'q-dimmed': isDimmed }, { 'celebrate': celebrating }]"
    role="region"
    :aria-label="title"
  >
    <div class="quadrant-header">
      <div class="quadrant-dot"></div>
      <span class="quadrant-title">{{ title }}</span>
      <span class="quadrant-count">{{ undoneCount }}</span>
      <button class="quadrant-add" @click="showInlineAdd" title="添加任务">+</button>
    </div>
    <div ref="sortableEl" class="task-list">
      <TaskItem
        v-for="task in localList"
        :key="task.clientId"
        :task="task"
        :quadrant="quadrant"
        :selected="task.clientId === store.selectedTaskId"
        compact
        @select="store.selectTask(task.clientId)"
        @toggle="store.toggleDone(task.clientId)"
        @contextmenu="onItemContext($event, task.clientId)"
        @dblclick-title="onDblClickTitle"
      />
      <div v-if="visibleTasks.length === 0" class="empty-state visible">
        <div class="empty-state-icon">
          <!-- Q1: target -->
          <svg v-if="quadrant === 1" width="22" height="22" viewBox="0 0 24 24" fill="none" :stroke="q1Color" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
          </svg>
          <!-- Q2: chart -->
          <svg v-else-if="quadrant === 2" width="22" height="22" viewBox="0 0 24 24" fill="none" :stroke="q2Color" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="3"/><line x1="2" y1="16" x2="22" y2="16"/><polyline points="10,16 10,10 14,10 14,6 18,6"/>
          </svg>
          <!-- Q3: inbox -->
          <svg v-else-if="quadrant === 3" width="22" height="22" viewBox="0 0 24 24" fill="none" :stroke="q3Color" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22,12 16,12 14,15 10,15 8,12 2,12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A1 1 0 0 0 17.67 5H6.33a1 1 0 0 0-.88.55z"/>
          </svg>
          <!-- Q4: leaf -->
          <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" :stroke="q4Color" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 18c4 0 7-3.5 7-7.5 0-2-1.5-3.5-3.5-3.5H13v-3c0-1.1-.9-2-2-2H8v4h2l-4 10a5 5 0 0 0 5 2z"/>
          </svg>
        </div>
        <p>{{ emptyText }}</p>
      </div>
    </div>
    <!-- Inline Add -->
    <div v-if="addVisible" class="inline-add visible">
      <div class="inline-add-dot"></div>
      <input
        ref="addInputEl"
        v-model="addTitle"
        class="inline-add-input"
        placeholder="添加任务，回车确认…"
        @input="onAddInput"
        @keydown.enter="confirmAdd"
        @keydown.escape="cancelAdd"
        @blur="cancelAdd"
      />
    </div>
    <!-- Footer bar: always visible, provides bottom cap like the header -->
    <div class="quadrant-footer"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, inject, watch, onMounted, onBeforeUnmount } from 'vue'
import { useTaskStore, type Task } from '@/stores/taskStore'
import { useTaskFilter } from '@/composables/useTaskFilter'
import Sortable from 'sortablejs'
import TaskItem from './TaskItem.vue'

const props = defineProps<{ quadrant: number }>()
const store = useTaskStore()
const { filterForQuadrant } = useTaskFilter()
const showContextMenu: any = inject('showContextMenu', () => {})

const addVisible = ref(false)
const addTitle = ref('')
const addInputEl = ref<HTMLInputElement | null>(null)
const celebrating = ref(false)

const titles: Record<number, string> = {
  1: '重要 · 紧急', 2: '重要 · 不紧急', 3: '紧急 · 不重要', 4: '不重要 · 不紧急',
}
const emptyTexts: Record<number, string> = {
  1: '立即处理的要事', 2: '规划未来的重要事项', 3: '可委托他人的事务', 4: '可考虑删除的事项',
}

// Quadrant stroke colors for empty-state SVG icons
const q1Color = 'oklch(62% 0.14 4)'
const q2Color = 'oklch(54% 0.13 138)'
const q3Color = 'oklch(56% 0.12 205)'
const q4Color = 'oklch(50% 0.01 240)'

const title = computed(() => titles[props.quadrant])
const emptyText = computed(() => emptyTexts[props.quadrant])

const visibleTasks = computed(() => filterForQuadrant(store.quadrantTasks(props.quadrant)))

// ─── Local list for rendering ───
// localList is a mutable ref synced from visibleTasks.
// SortableJS modifies DOM directly; we update localList manually on drag end.
// isDragging flag (set synchronously by SortableJS onStart) prevents watch sync during drag.
const localList = ref<Task[]>([])
let isDragging = false

function syncLocalList() {
  if (!isDragging) {
    localList.value = [...visibleTasks.value]
  }
}

watch(visibleTasks, syncLocalList, { immediate: true })

const undoneCount = computed(() => visibleTasks.value.filter(t => !t.done).length)

const isDimmed = computed(() => {
  const fq = store.filterQuadrant
  return fq !== null && fq !== undefined && fq !== props.quadrant
})

// ─── Celebration: when all tasks in quadrant are completed ───
watch(undoneCount, (newVal, oldVal) => {
  if (oldVal > 0 && newVal === 0 && visibleTasks.value.length > 0) {
    celebrating.value = true
    setTimeout(() => { celebrating.value = false }, 2000)
  }
})

// ─── SortableJS (direct, no vuedraggable wrapper) ───
const sortableEl = ref<HTMLElement | null>(null)
let sortableInstance: Sortable | null = null

function getQuadrantFromContainer(el: HTMLElement): number {
  // Each .task-list is inside a .quadrant.qX element
  // We also store data-qid on each TaskItem for identification
  const qEl = el.closest('.quadrant')
  if (!qEl) return props.quadrant
  for (const cls of qEl.classList) {
    if (cls.startsWith('q') && cls.length <= 2) {
      const n = parseInt(cls.substring(1))
      if (n >= 1 && n <= 4) return n
    }
  }
  return props.quadrant
}

onMounted(() => {
  if (!sortableEl.value) return
  sortableInstance = Sortable.create(sortableEl.value, {
    animation: 180,
    group: {
      name: 'tasks',
      pull: true,
      put: true,
    },
    ghostClass: 'task-ghost',
    chosenClass: 'task-chosen',
    dragClass: 'task-dragging',
    draggable: '.task-item',   // only TaskItem elements are sortable
    handle: '.task-drag-handle',
    filter: '.empty-state, .inline-add',  // ignore empty state and inline add
    preventOnFilter: true,     // prevent default on filtered elements
    forceFallback: true,
    fallbackOnBody: true,
    fallbackTolerance: 4,
    emptyInsertThreshold: 30,
    // ─── SortableJS callbacks are SYNCHRONOUS ───
    // This is the key advantage over vuedraggable:
    // onStart fires immediately, so isDragging=true is set before any Vue re-render
    onStart: () => {
      isDragging = true
    },
    onEnd: (evt: Sortable.SortableEvent) => {
      // SortableJS always provides oldIndex/newIndex for same-container moves
      // Cross-container moves also provide them, but we guard against undefined
      handleSortEnd(evt)
    },
  })
})

onBeforeUnmount(() => {
  sortableInstance?.destroy()
})

function handleSortEnd(evt: Sortable.SortableEvent) {
  const fromQ = getQuadrantFromContainer(evt.from)
  const toQ = getQuadrantFromContainer(evt.to)
  const oldIdx = evt.oldIndex ?? 0
  const newIdx = evt.newIndex ?? 0
  const clientId = evt.item.getAttribute('data-client-id')

  if (fromQ === toQ) {
    // ─── Same quadrant reorder ───
    const newOrder = orderedTasksFromContainer(evt.to)
    const hasDomOrder = newOrder.length === localList.value.length
    const previousIds = localList.value.map(t => t.clientId).join('|')
    const nextIds = newOrder.map(t => t.clientId).join('|')

    if ((hasDomOrder && previousIds === nextIds) || (!hasDomOrder && oldIdx === newIdx)) {
      isDragging = false
      return
    }

    if (!hasDomOrder) {
      const fallbackOrder = [...localList.value]
      const [moved] = fallbackOrder.splice(oldIdx, 1)
      fallbackOrder.splice(newIdx, 0, moved)
      localList.value = fallbackOrder
      void persistReorder(fallbackOrder)
      isDragging = false
      return
    }

    // Persist the actual DOM order the user sees after dropping.
    localList.value = newOrder
    void persistReorder(newOrder)

    // Release drag lock
    isDragging = false
    // visibleTasks will recompute (sortOrders changed), watch will sync —
    // but since localList already has the correct order, the sync is harmless
  } else {
    // ─── Cross-quadrant move ───
    const destinationIds = clientId ? orderedClientIdsFromContainer(evt.to) : []
    const destinationIndex = clientId ? destinationIds.indexOf(clientId) : -1

    // SortableJS has physically moved the DOM element to the destination container.
    // We MUST undo this move before Vue re-renders to avoid DOM reconciliation conflicts.
    // Undo: move the element back to its original position in the source container.
    const fromChildren = [...evt.from.children]
    const refNode = fromChildren[oldIdx] || null
    if (refNode) {
      evt.from.insertBefore(evt.item, refNode)
    } else {
      evt.from.appendChild(evt.item)
    }

    if (clientId) {
      void persistCrossQuadrantMove(clientId, fromQ, toQ, destinationIndex >= 0 ? destinationIndex : newIdx)
    }

    // Release drag lock — watch will sync localList for both source and destination
    isDragging = false
    syncLocalList()
  }
}

function orderedClientIdsFromContainer(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('.task-item')]
    .map(el => el.dataset.clientId)
    .filter((id): id is string => Boolean(id))
}

function orderedTasksFromContainer(container: HTMLElement): Task[] {
  const taskById = new Map<string, Task>()
  for (const task of [...localList.value, ...visibleTasks.value, ...store.tasks]) {
    taskById.set(task.clientId, task)
  }

  return orderedClientIdsFromContainer(container)
    .map(id => taskById.get(id))
    .filter((task): task is Task => Boolean(task))
}

async function persistReorder(order: Task[]) {
  const items = order.map((t, i) => ({
    clientId: t.clientId,
    sortOrder: i
  }))
  await store.reorderTasks(items)
}

async function persistCrossQuadrantMove(clientId: string, fromQ: number, toQ: number, newIdx: number) {
  const moved = store.tasks.find(t => t.clientId === clientId)
  if (!moved) return

  const destination = store
    .quadrantTasks(toQ)
    .filter(t => t.clientId !== clientId)
  destination.splice(Math.max(0, newIdx), 0, moved)

  const source = store
    .quadrantTasks(fromQ)
    .filter(t => t.clientId !== clientId)

  await store.updateTask(clientId, { quadrant: toQ })
  await store.reorderTasks([
    ...source.map((t, i) => ({ clientId: t.clientId, sortOrder: i })),
    ...destination.map((t, i) => ({ clientId: t.clientId, sortOrder: i })),
  ])
}

// ─── Inline Add ───
let draftId: string | null = null

async function showInlineAdd() {
  addVisible.value = true
  const task = await store.addTask(props.quadrant, '')
  draftId = task.clientId
  store.selectTask(task.clientId)
  await nextTick()
  addInputEl.value?.focus()
}

function onAddInput() {
  if (!draftId) return
  const task = store.tasks.find(t => t.clientId === draftId)
  if (task) {
    task.title = addTitle.value
  }
}

async function confirmAdd() {
  if (draftId) {
    const title = addTitle.value.trim()
    if (title) {
      await store.updateTask(draftId, { title })
    } else {
      await store.removeTask(draftId)
    }
  }
  addTitle.value = ''
  addVisible.value = false
  draftId = null
}

async function cancelAdd() {
  setTimeout(async () => {
    if (draftId) {
      const title = addTitle.value.trim()
      if (!title) {
        await store.removeTask(draftId)
      }
    }
    addTitle.value = ''
    addVisible.value = false
    draftId = null
  }, 150)
}

// ─── Inline Edit (double-click title) ───
function onDblClickTitle(clientId: string, newTitle: string) {
  store.updateTask(clientId, { title: newTitle })
}

// ─── Context Menu ───
function onItemContext(e: MouseEvent, clientId: string) {
  showContextMenu(e, clientId)
}
</script>

<style scoped>
.quadrant {
  border-radius: var(--radius-lg);
  border: 1px solid;
  display: flex;
  flex-direction: column;
  overflow: clip;
  min-height: 0;
  flex: 1;
  transition: box-shadow var(--transition), opacity var(--transition), filter var(--transition), transform var(--transition);
}
.quadrant:hover { box-shadow: 0 18px 36px oklch(0% 0 0 / 0.045); transform: translateY(-1px); }
.q-dimmed { opacity: 0.35; filter: grayscale(30%); }

/* ─── Celebration animation ─── */
.quadrant.celebrate {
  animation: celebrateGlow 2s ease-out, celebrateBg 2s ease-out;
}
@keyframes celebrateGlow {
  0%   { box-shadow: 0 0 0 0 oklch(62% 0.16 145 / 0.6); }
  8%   { box-shadow: 0 0 32px 8px oklch(62% 0.16 145 / 0.45); }
  20%  { box-shadow: 0 0 24px 6px oklch(62% 0.16 145 / 0.3); }
  40%  { box-shadow: 0 0 12px 4px oklch(62% 0.16 145 / 0.15); }
  70%  { box-shadow: 0 0 4px 1px oklch(62% 0.16 145 / 0.06); }
  100% { box-shadow: var(--shadow-card); }
}
@keyframes celebrateBg {
  0%   { background-color: oklch(62% 0.16 145 / 0.08); }
  15%  { background-color: oklch(62% 0.16 145 / 0.12); }
  40%  { background-color: oklch(62% 0.16 145 / 0.05); }
  100% { background-color: revert; }
}
.quadrant.celebrate .quadrant-title {
  animation: celebrateText 2s ease-out;
}
@keyframes celebrateText {
  0%   { transform: scale(1); }
  8%   { transform: scale(1.12); }
  20%  { transform: scale(1); }
  30%  { transform: scale(1.04); }
  45%  { transform: scale(1); }
}

.q1 { background: var(--q1-bg); border-color: var(--q1-border); }
.q2 { background: var(--q2-bg); border-color: var(--q2-border); }
.q3 { background: var(--q3-bg); border-color: var(--q3-border); }
.q4 { background: var(--q4-bg); border-color: var(--q4-border); }

.quadrant-header {
  display: flex; align-items: center;
  padding: 9px 11px 8px; gap: 7px;
  border-bottom: 0.5px solid;
  backdrop-filter: blur(12px);
}
.q1 .quadrant-header { border-color: var(--q1-border); }
.q2 .quadrant-header { border-color: var(--q2-border); }
.q3 .quadrant-header { border-color: var(--q3-border); }
.q4 .quadrant-header { border-color: var(--q4-border); }

.quadrant-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.q1 .quadrant-dot { background: var(--q1-header); }
.q2 .quadrant-dot { background: var(--q2-header); }
.q3 .quadrant-dot { background: var(--q3-header); }
.q4 .quadrant-dot { background: var(--q4-header); }

.quadrant-title { font-size: 14px; font-weight: 600; flex: 1; }
.q1 .quadrant-title { color: var(--q1-header); }
.q2 .quadrant-title { color: var(--q2-header); }
.q3 .quadrant-title { color: var(--q3-header); }
.q4 .quadrant-title { color: var(--q4-header); }

.quadrant-count {
  font-size: 12px; font-weight: 600; border-radius: 20px;
  padding: 1px 7px; opacity: 0.7;
}
.q1 .quadrant-count { background: var(--q1-count-bg); color: var(--q1-header); }
.q2 .quadrant-count { background: var(--q2-count-bg); color: var(--q2-header); }
.q3 .quadrant-count { background: var(--q3-count-bg); color: var(--q3-header); }
.q4 .quadrant-count { background: var(--q4-count-bg); color: var(--q4-header); }

.quadrant-add {
  width: 26px; height: 26px; border-radius: 50%;
  border: 1.5px solid; background: transparent;
  cursor: pointer; display: grid; place-items: center;
  font-size: 18px; font-weight: 300;
  transition: all var(--transition); line-height: 1;
}
.q1 .quadrant-add { border-color: var(--q1-border); color: var(--q1-header); }
.q2 .quadrant-add { border-color: var(--q2-border); color: var(--q2-header); }
.q3 .quadrant-add { border-color: var(--q3-border); color: var(--q3-header); }
.q4 .quadrant-add { border-color: var(--q4-border); color: var(--q4-header); }

.q1 .quadrant-add:hover { background: var(--q1-header); color: white; border-color: var(--q1-header); }
.q2 .quadrant-add:hover { background: var(--q2-header); color: white; border-color: var(--q2-header); }
.q3 .quadrant-add:hover { background: var(--q3-header); color: white; border-color: var(--q3-header); }
.q4 .quadrant-add:hover { background: var(--q4-header); color: white; border-color: var(--q4-header); }

/* ─── Task List ─── */
.task-list {
  flex: 1; overflow-y: auto;
  padding: 6px 7px 0;
  display: flex; flex-direction: column; gap: 3px;
  min-height: 0;
}

.quadrant-footer {
  height: 18px;
  flex-shrink: 0;
  border-top: 0.5px solid;
  opacity: 0.42;
  background: transparent;
  margin: 0 12px 12px;
  border-radius: 999px;
}
.q1 .quadrant-footer { border-color: var(--q1-border); }
.q2 .quadrant-footer { border-color: var(--q2-border); }
.q3 .quadrant-footer { border-color: var(--q3-border); }
.q4 .quadrant-footer { border-color: var(--q4-border); }
.task-list::-webkit-scrollbar { width: 4px; }
.task-list::-webkit-scrollbar-track { background: transparent; }
.task-list::-webkit-scrollbar-thumb { background: var(--border-subtle); border-radius: 2px; }

/* ─── Empty State ─── */
.empty-state {
  flex: 1; display: flex; align-items: center; justify-content: center;
  flex-direction: column; gap: 6px; padding: 18px;
  opacity: 0; transition: opacity 0.3s;
  /* Important: empty-state must NOT be a sortable item */
  pointer-events: none;
}
.empty-state.visible { opacity: 1; pointer-events: auto; }
.empty-state-icon { font-size: 22px; margin-bottom: 2px; }
.empty-state p {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.5;
  max-width: 18ch;
}

/* ─── Inline Add ─── */
.inline-add {
  display: none; padding: 6px 8px; gap: 8px; align-items: center;
}
.inline-add.visible { display: flex; }
.inline-add-dot {
  width: 15px; height: 15px; border-radius: 50%;
  border: 1.5px dashed; flex-shrink: 0;
}
.q1 .inline-add-dot { border-color: var(--q1-header); }
.q2 .inline-add-dot { border-color: var(--q2-header); }
.q3 .inline-add-dot { border-color: var(--q3-header); }
.q4 .inline-add-dot { border-color: var(--q4-header); }
.inline-add-input {
  flex: 1; background: none; border: none; outline: none;
  font: inherit; font-size: 14px; color: var(--text-primary);
}
.inline-add-input::placeholder { color: var(--text-muted); }

/* ─── SortableJS ghost ─── */
.task-ghost {
  opacity: 0.35;
  background: oklch(95% 0.02 240);
  border-radius: var(--radius-sm);
}

/* ─── SortableJS chosen (being dragged) ─── */
.task-item.sortable-chosen {
  opacity: 0.8;
  box-shadow: 0 4px 12px oklch(0% 0 0 / 0.12);
}
</style>
