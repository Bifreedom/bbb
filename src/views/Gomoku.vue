<template>
  <section class="page">
    <h2>五子连珠（Gomoku）</h2>
    <div class="toolbar">
      <label>
        大小：
        <select v-model.number="size" :disabled="inGame && !winner">
          <option :value="13">13×13</option>
          <option :value="15">15×15</option>
          <option :value="19">19×19</option>
        </select>
      </label>
      <button @click="reset()">重开</button>
      <button @click="undo()" :disabled="history.length===0 || winner">悔棋</button>
    </div>

    <div class="status">
      <span v-if="winner">胜者：<b :class="winner===1?'black':'white'">{{ winner===1 ? '黑' : '白' }}</b></span>
      <span v-else>当前：<b :class="currentPlayer===1?'black':'white'">{{ currentPlayer===1 ? '黑' : '白' }}</b></span>
      <span>步数：{{ moveCount }}</span>
    </div>

    <div
      class="board"
      :style="{ gridTemplateColumns: 'repeat(' + size + ', var(--cell))', gridTemplateRows: 'repeat(' + size + ', var(--cell))' }"
    >
      <button
        v-for="cell in flatBoard"
        :key="cell.id"
        class="cell"
        :class="{ black: cell.v===1, white: cell.v===2 }"
        @click="place(cell.x, cell.y)"
        :disabled="!!winner"
        :aria-label="ariaLabel(cell)"
      />
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'

// 0 空, 1 黑, 2 白
const size = ref(15)
const board = reactive([]) // board[y][x] = 0|1|2
const currentPlayer = ref(1)
const winner = ref(0)
const moveCount = ref(0)
const inGame = ref(false)
const history = reactive([]) // 记录落子历史 [{x,y}]

function initBoard() {
  board.length = 0
  for (let y = 0; y < size.value; y++) {
    const row = []
    for (let x = 0; x < size.value; x++) row.push(0)
    board.push(row)
  }
  currentPlayer.value = 1
  winner.value = 0
  moveCount.value = 0
  history.length = 0
  inGame.value = true
}

function inside(x, y) {
  return x >= 0 && x < size.value && y >= 0 && y < size.value
}

function countDir(x, y, dx, dy, color) {
  let c = 0
  let nx = x + dx, ny = y + dy
  while (inside(nx, ny) && board[ny][nx] === color) {
    c++
    nx += dx
    ny += dy
  }
  return c
}

function checkWin(x, y) {
  const color = board[y][x]
  if (!color) return 0
  // 四个方向：水平、垂直、两条对角
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ]
  for (const [dx, dy] of dirs) {
    const c = 1 + countDir(x, y, dx, dy, color) + countDir(x, y, -dx, -dy, color)
    if (c >= 5) return color
  }
  return 0
}

function place(x, y) {
  if (winner.value) return
  if (!inside(x, y) || board[y][x] !== 0) return
  board[y][x] = currentPlayer.value
  history.push({ x, y })
  moveCount.value++
  const w = checkWin(x, y)
  if (w) { winner.value = w; return }
  currentPlayer.value = currentPlayer.value === 1 ? 2 : 1
}

function undo() {
  if (history.length === 0 || winner.value) return
  const last = history.pop()
  if (!last) return
  const { x, y } = last
  if (inside(x, y)) {
    board[y][x] = 0
    moveCount.value = Math.max(0, moveCount.value - 1)
    currentPlayer.value = currentPlayer.value === 1 ? 2 : 1
  }
}

function reset() {
  initBoard()
}

watch(size, () => initBoard(), { immediate: true })

const flatBoard = computed(() => {
  const out = []
  for (let y = 0; y < size.value; y++) {
    for (let x = 0; x < size.value; x++) {
      out.push({ id: `${x}-${y}`, x, y, v: board[y][x] })
    }
  }
  return out
})

function ariaLabel(cell) {
  const pos = `${cell.x + 1},${cell.y + 1}`
  if (cell.v === 1) return `黑子 ${pos}`
  if (cell.v === 2) return `白子 ${pos}`
  return `空位 ${pos}`
}
</script>

<style scoped>
.page { padding: 24px; display: grid; gap: 12px; justify-items: center; }
.toolbar { display: flex; gap: 12px; align-items: center; }
.status { display: flex; gap: 16px; align-items: center; }
.status b.black { color: #222; }
.status b.white { color: #999; }

.board {
  --cell: 32px;
  display: grid;
  gap: 0; /* 传统棋盘为连续线条 */
  padding: 12px;
  background: #f6e0a6; /* 木色棋盘 */
  border: 2px solid #b48a3e;
  border-radius: 8px;
  position: relative;
}

.cell {
  width: var(--cell);
  height: var(--cell);
  background:
    linear-gradient(#0000, #0000) content-box,
    radial-gradient(circle at center, #0000 11px, #c8a45a 12px) border-box; /* 角落点位可后续增强 */
  box-sizing: border-box;
  position: relative;
  border: 1px solid rgba(0,0,0,0.25); /* 网格线 */
  padding: 0;
  cursor: pointer;
}

.cell.black::after,
.cell.white::after {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.4);
}
.cell.black::after { background: radial-gradient(circle at 35% 30%, #666, #111 60%, #000); }
.cell.white::after { background: radial-gradient(circle at 35% 30%, #fff, #ddd 60%, #bbb); }

button { outline: none; }
</style>
