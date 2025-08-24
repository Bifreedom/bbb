<template>
  <section class="page">
    <h2>扫雷 Minesweeper</h2>
    <div class="controls">
      <div class="btns">
        <button :disabled="inGame && !gameOver && !won" @click="setPreset('easy')">新手 9x9·10</button>
        <button :disabled="inGame && !gameOver && !won" @click="setPreset('medium')">中级 16x16·40</button>
        <button :disabled="inGame && !gameOver && !won" @click="setPreset('hard')">专家 16x30·99</button>
        <button @click="reset()">重开</button>
      </div>
      <div class="stats">
        <span>大小: {{ height }}×{{ width }}</span>
        <span>地雷: {{ mines }}</span>
        <span>旗子: {{ flagsCount }}/{{ mines }}</span>
        <span v-if="time > 0">用时: {{ time }}s</span>
        <span v-if="won" class="won">通关!</span>
        <span v-else-if="gameOver" class="lost">踩雷了…</span>
      </div>
    </div>

    <div class="board" :style="{ gridTemplateColumns: 'repeat(' + width + ', var(--cell))' }">
      <button
        v-for="cell in flatBoard"
        :key="cell.id"
        class="cell"
        :class="cellClasses(cell)"
        @click="reveal(cell)"
        @contextmenu.prevent="toggleFlag(cell)"
        :disabled="gameOver || won"
      >
        <span v-if="cell.isRevealed && !cell.isMine && cell.neighborMines > 0" :class="'n' + cell.neighborMines">{{ cell.neighborMines }}</span>
        <span v-if="cell.isRevealed && cell.isMine">💣</span>
        <span v-if="!cell.isRevealed && cell.isFlagged">🚩</span>
      </button>
    </div>
  </section>
  
</template>

<script setup>
import { computed, reactive, ref, watch, onMounted, onBeforeUnmount } from 'vue'

// 数据结构: 单元格
function makeCell(x, y) {
  return {
    id: `${x}-${y}`,
    x, y,
    isMine: false,
    isRevealed: false,
    isFlagged: false,
    neighborMines: 0,
  }
}

const width = ref(9)
const height = ref(9)
const mines = ref(10)

const board = reactive([]) // 2D: [y][x]
const firstClickPlaced = ref(false)
const gameOver = ref(false)
const won = ref(false)
const inGame = ref(false)

const timer = ref(null)
const time = ref(0)

function startTimer() {
  stopTimer()
  time.value = 0
  timer.value = setInterval(() => { time.value++ }, 1000)
}
function stopTimer() {
  if (timer.value) { clearInterval(timer.value); timer.value = null }
}

function buildEmptyBoard() {
  board.length = 0
  for (let y = 0; y < height.value; y++) {
    const row = []
    for (let x = 0; x < width.value; x++) row.push(makeCell(x, y))
    board.push(row)
  }
  firstClickPlaced.value = false
  gameOver.value = false
  won.value = false
  inGame.value = true
  startTimer()
}

function neighbors(x, y) {
  const res = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx, ny = y + dy
      if (nx >= 0 && nx < width.value && ny >= 0 && ny < height.value) res.push(board[ny][nx])
    }
  }
  return res
}

function placeMinesAvoiding(safeCell) {
  const total = width.value * height.value
  const mineCount = Math.min(mines.value, total - 1)
  const safeId = safeCell ? safeCell.id : null
  const ids = []
  for (let y = 0; y < height.value; y++) {
    for (let x = 0; x < width.value; x++) {
      const id = `${x}-${y}`
      if (id !== safeId) ids.push(id)
    }
  }
  // 洗牌
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  const minesSet = new Set(ids.slice(0, mineCount))
  for (let y = 0; y < height.value; y++) {
    for (let x = 0; x < width.value; x++) {
      const c = board[y][x]
      c.isMine = minesSet.has(c.id)
    }
  }
  // 计算周围雷数
  for (let y = 0; y < height.value; y++) {
    for (let x = 0; x < width.value; x++) {
      const c = board[y][x]
      c.neighborMines = neighbors(x, y).filter(n => n.isMine).length
    }
  }
  firstClickPlaced.value = true
}

function reveal(cell) {
  if (gameOver.value || won.value) return
  if (cell.isFlagged || cell.isRevealed) return
  if (!firstClickPlaced.value) placeMinesAvoiding(cell)

  if (cell.isMine) {
    // 游戏结束，展示所有地雷
    cell.isRevealed = true
    gameOver.value = true
    stopTimer()
    for (let y = 0; y < height.value; y++) {
      for (let x = 0; x < width.value; x++) {
        const c = board[y][x]
        if (c.isMine) c.isRevealed = true
      }
    }
    return
  }

  floodReveal(cell)
  checkWin()
}

function floodReveal(startCell) {
  const queue = [startCell]
  while (queue.length) {
    const c = queue.shift()
    if (c.isRevealed || c.isFlagged) continue
    c.isRevealed = true
    if (c.neighborMines === 0) {
      for (const n of neighbors(c.x, c.y)) {
        if (!n.isRevealed && !n.isFlagged && !n.isMine) queue.push(n)
      }
    }
  }
}

function toggleFlag(cell) {
  if (gameOver.value || won.value) return
  if (cell.isRevealed) return
  cell.isFlagged = !cell.isFlagged
}

const flagsCount = computed(() => {
  // 兼容重建棋盘过程中（board 可能暂为空或行未就绪）
  let c = 0
  for (let y = 0; y < height.value; y++) {
    const row = board[y]
    if (!row) continue
    const maxX = Math.min(width.value, row.length)
    for (let x = 0; x < maxX; x++) {
      if (row[x]?.isFlagged) c++
    }
  }
  return c
})

function checkWin() {
  // 所有非雷格子被翻开
  for (let y = 0; y < height.value; y++) {
    for (let x = 0; x < width.value; x++) {
      const c = board[y][x]
      if (!c.isMine && !c.isRevealed) return
    }
  }
  won.value = true
  stopTimer()
}

const flatBoard = computed(() => {
  const out = []
  for (let y = 0; y < height.value; y++) {
    const row = board[y]
    if (!row) continue
    const maxX = Math.min(width.value, row.length)
    for (let x = 0; x < maxX; x++) {
      const c = row[x]
      if (c) out.push(c)
    }
  }
  return out
})

function setPreset(level) {
  if (level === 'easy') { width.value = 9; height.value = 9; mines.value = 10 }
  else if (level === 'medium') { width.value = 16; height.value = 16; mines.value = 40 }
  else if (level === 'hard') { width.value = 30; height.value = 16; mines.value = 99 }
  reset()
}

function reset() {
  buildEmptyBoard()
}

function cellClasses(cell) {
  return {
    revealed: cell.isRevealed,
    mine: cell.isRevealed && cell.isMine,
    flagged: !cell.isRevealed && cell.isFlagged,
  }
}

onMounted(() => {
  buildEmptyBoard()
})
onBeforeUnmount(() => stopTimer())
</script>

<style scoped>
:root { color-scheme: light dark; }
.page { padding: 24px; display: grid; gap: 12px; justify-items: center; }
.controls { display: grid; gap: 8px; justify-items: center; }
.btns { display: flex; gap: 8px; flex-wrap: wrap; }
.stats { display: flex; gap: 12px; flex-wrap: wrap; }
.won { color: #2e7d32; font-weight: 600; }
.lost { color: #c62828; font-weight: 600; }

.board { --cell: 32px; display: grid; gap: 4px; padding: 8px; background: color-mix(in oklab, Canvas, CanvasText 6%); border-radius: 8px; }
.cell { width: var(--cell); height: var(--cell); display: grid; place-items: center; border: 1px solid color-mix(in oklab, CanvasText, transparent 80%); background: color-mix(in oklab, Canvas, CanvasText 4%); cursor: pointer; user-select: none; font-weight: 700; border-radius: 4px; }
.cell.revealed { background: color-mix(in oklab, Canvas, CanvasText 12%); cursor: default; }
.cell.mine.revealed { background: #ffebee; border-color: #ffcdd2; }
.cell.flagged { background: color-mix(in oklab, Canvas, red 6%); }

/* 数字颜色 */
.n1 { color: #1976d2; }
.n2 { color: #388e3c; }
.n3 { color: #d32f2f; }
.n4 { color: #7b1fa2; }
.n5 { color: #ef6c00; }
.n6 { color: #00897b; }
.n7 { color: #5d4037; }
.n8 { color: #455a64; }

button { outline: none; }
</style>
