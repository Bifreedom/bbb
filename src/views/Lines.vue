<template>
  <section class="page">
    <h2>五子连珠（Lines）</h2>

    <div class="toolbar">
  <button @click="reset()">重开</button>
  <button @click="undo()" :disabled="historyStack.length===0">撤销</button>
      <span>分数：<b>{{ score }}</b></span>
      <span>剩余空位：{{ emptyCount }}</span>
      <span>下三个：</span>
      <div class="next">
        <span v-for="(c,i) in nextColors" :key="i" class="dot" :class="colorClass(c)" :style="dotStyle(c)"></span>
      </div>
    </div>

    <div class="board" :style="{ gridTemplateColumns: 'repeat(' + size + ', var(--cell))' }">
      <button
        v-for="cell in flatBoard"
        :key="cell.id"
        class="cell"
        :class="cellClasses(cell)"
        @click="onCellClick(cell)"
        :disabled="gameOver"
        :aria-label="ariaLabel(cell)"
      />
    </div>

    <p v-if="gameOver" class="over">棋盘已满，游戏结束。</p>
  </section>
</template>

<script setup>
import { computed, reactive, ref, onMounted, nextTick } from 'vue'

// 配置
const size = 9
const COLORS = [0,1,2,3,4,5] // 6 种颜色，用 0..5 表示
const SPAWN_EACH_TURN = 3
const INITIAL_BALLS = 5

// 状态
const board = reactive([]) // board[y][x] = -1 空; 0..5 颜色
const selected = ref(null) // {x,y,color}
const nextColors = ref([]) // 下一轮要生成的颜色数组
const score = ref(0)
const gameOver = ref(false)
const historyStack = reactive([]) // 存档撤销栈，元素为快照
const clearingSet = reactive(new Set()) // 待清除高亮动画坐标编码
const lastMoved = ref(null) // {x,y} 刚移动到的坐标用于动画

function initBoard() {
  board.length = 0
  for (let y = 0; y < size; y++) {
    const row = []
    for (let x = 0; x < size; x++) row.push(-1)
    board.push(row)
  }
}

function emptyCells() {
  const res = []
  for (let y = 0; y < size; y++) {
    const row = board[y]
    if (!row) continue
    const maxX = Math.min(size, row.length)
    for (let x = 0; x < maxX; x++) if (row[x] === -1) res.push({ x, y })
  }
  return res
}

const emptyCount = computed(() => emptyCells().length)

function randChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function rollNextColors(n = SPAWN_EACH_TURN) {
  const arr = []
  for (let i = 0; i < n; i++) arr.push(randChoice(COLORS))
  nextColors.value = arr
}

function spawnBalls(colors) {
  const empties = emptyCells()
  if (empties.length === 0) return []
  const placed = []
  // 洗牌空位
  for (let i = empties.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[empties[i], empties[j]] = [empties[j], empties[i]]
  }
  const count = Math.min(colors.length, empties.length)
  for (let i = 0; i < count; i++) {
    const pos = empties[i]
    board[pos.y][pos.x] = colors[i]
    placed.push(pos)
  }
  return placed
}

function reset() {
  score.value = 0
  gameOver.value = false
  selected.value = null
  clearingSet.clear()
  lastMoved.value = null
  historyStack.length = 0
  initBoard()
  rollNextColors()
  // 初始生成一些球
  spawnBalls(Array.from({length: INITIAL_BALLS}, () => randChoice(COLORS)))
  saveGame()
}

// 计算连线：返回应清除的坐标集合（长度>=5）
// 返回以 (x,y) 为中心在四个方向上形成的所有“线”，每条线是一个坐标数组
function findLinesAtLines(x, y) {
  const color = board[y][x]
  if (color < 0) return []
  const dirs = [ [1,0], [0,1], [1,1], [1,-1] ]
  const lines = []
  for (const [dx,dy] of dirs) {
    const line = [{x,y}]
    let nx = x + dx, ny = y + dy
    while (nx>=0 && nx<size && ny>=0 && ny<size && board[ny][nx] === color) { line.push({x:nx,y:ny}); nx+=dx; ny+=dy }
    nx = x - dx; ny = y - dy
    while (nx>=0 && nx<size && ny>=0 && ny<size && board[ny][nx] === color) { line.push({x:nx,y:ny}); nx-=dx; ny-=dy }
    if (line.length >= 5) lines.push(line)
  }
  return lines
}

function clearCells(cells) {
  for (const {x,y} of cells) board[y][x] = -1
}

function bfsPathExists(sx, sy, tx, ty) {
  if (sx===tx && sy===ty) return true
  const q = [{x:sx, y:sy}]
  const visited = Array.from({length:size}, () => Array(size).fill(false))
  visited[sy][sx] = true
  const moves = [[1,0],[-1,0],[0,1],[0,-1]]
  while (q.length) {
    const {x,y} = q.shift()
    for (const [dx,dy] of moves) {
      const nx = x+dx, ny = y+dy
      if (nx<0||nx>=size||ny<0||ny>=size) continue
      if (visited[ny][nx]) continue
      if (nx===tx && ny===ty) return true
      if (board[ny][nx] === -1) { visited[ny][nx] = true; q.push({x:nx,y:ny}) }
    }
  }
  return false
}

async function onCellClick(cell) {
  if (gameOver.value) return
  const {x,y} = cell
  const v = board[y][x]
  // 选中已有球
  if (v >= 0) {
    selected.value = { x, y, color: v }
    return
  }
  // 目标为空且已有选中 → 尝试移动
  if (v === -1 && selected.value) {
    const { x: sx, y: sy, color } = selected.value
    if (bfsPathExists(sx, sy, x, y)) {
      // 记录快照以支持撤销
      pushSnapshot()
      // 执行移动（动画：目标短暂放大）
      board[sy][sx] = -1
      board[y][x] = color
      selected.value = null
      lastMoved.value = { x, y }
      await nextTick()
      // 移动后检查连线
      const lines = findLinesAtLines(x, y)
      if (lines.length) {
        const cells = unionCells(lines)
        animateClear(cells)
        const gain = calcScore(lines)
        await delay(220)
        clearCells(cells)
        score.value += gain
        clearingSet.clear()
        lastMoved.value = null
        saveGame()
        if (emptyCells().length === 0) gameOver.value = true
        return
      }
      // 未清除 → 生成下一组球并检查
      const placed = spawnBalls(nextColors.value)
      // 对新放置的每个点检查
      const allLines = []
      for (const p of placed) allLines.push(...findLinesAtLines(p.x, p.y))
      if (allLines.length) {
        const cells = unionCells(allLines)
        animateClear(cells)
        const gain = calcScore(allLines)
        await delay(220)
        clearCells(cells)
        score.value += gain
        clearingSet.clear()
      }
      rollNextColors()
      lastMoved.value = null
      saveGame()
      if (emptyCells().length === 0) gameOver.value = true
    }
  }
}

const flatBoard = computed(() => {
  const out = []
  for (let y = 0; y < size; y++) {
    const row = board[y]
    for (let x = 0; x < size; x++) {
      const v = row && row[x] !== undefined ? row[x] : -1
      out.push({ id: `${x}-${y}`, x, y, v })
    }
  }
  return out
})

function colorClass(color) {
  return color === 0 ? 'c0' :
         color === 1 ? 'c1' :
         color === 2 ? 'c2' :
         color === 3 ? 'c3' :
         color === 4 ? 'c4' : 'c5'
}

// 预告点颜色的兜底样式，确保显示正确颜色（即使某些 CSS 选择器未生效时）
function dotStyle(c) {
  const bg = c === 0 ? '#e53935'
           : c === 1 ? '#1e88e5'
           : c === 2 ? '#43a047'
           : c === 3 ? '#f9a825'
           : c === 4 ? '#8e24aa'
           : '#212121' // c5 黑色系
  const border = c === 3 ? 'rgba(0,0,0,0.25)'
               : c === 5 ? 'rgba(255,255,255,0.6)'
               : 'rgba(0,0,0,0.2)'
  return { background: bg, border: `1px solid ${border}` }
}

function cellClasses(cell) {
  return {
    selected: selected.value && selected.value.x===cell.x && selected.value.y===cell.y,
  clearing: clearingSet.has(cell.y*100 + cell.x),
  moved: lastMoved.value && lastMoved.value.x===cell.x && lastMoved.value.y===cell.y,
  [colorClass(cell.v)]: cell.v >= 0,
  }
}

function ariaLabel(cell) {
  const pos = `${cell.x+1},${cell.y+1}`
  if (cell.v >= 0) return `彩球 ${pos}`
  return `空位 ${pos}`
}

// 计分规则：基础分=长度，连6/连7加倍（>=6 ×2）
function calcScore(lines) {
  let sum = 0
  for (const line of lines) {
    const len = line.length
    const mul = len >= 6 ? 2 : 1
    sum += len * mul
  }
  return sum
}

function unionCells(lines) {
  const set = new Set()
  for (const line of lines) for (const p of line) set.add(p.y*100 + p.x)
  return Array.from(set).map(v => ({ x: v%100, y: Math.floor(v/100) }))
}

function animateClear(cells) {
  clearingSet.clear()
  for (const c of cells) clearingSet.add(c.y*100 + c.x)
}

function delay(ms) { return new Promise(res => setTimeout(res, ms)) }

// 存档/恢复
const SAVE_KEY = 'lines-save-v1'
function pushSnapshot() {
  historyStack.push({
    board: board.map(r => r.slice()),
    score: score.value,
    nextColors: nextColors.value.slice(),
    gameOver: gameOver.value,
  })
}
function undo() {
  const snap = historyStack.pop()
  if (!snap) return
  restoreSnapshot(snap)
  selected.value = null
  lastMoved.value = null
  clearingSet.clear()
  saveGame()
}
function saveGame() {
  const data = {
    board: board.map(r => r.slice()),
    score: score.value,
    nextColors: nextColors.value.slice(),
    gameOver: gameOver.value,
  }
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)) } catch {}
}
function restoreSnapshot(data) {
  if (!data || !data.board) return
  initBoard()
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) board[y][x] = data.board[y][x]
  score.value = data.score ?? 0
  nextColors.value = Array.isArray(data.nextColors) ? data.nextColors.slice() : []
  gameOver.value = !!data.gameOver
}

onMounted(() => {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      restoreSnapshot(data)
      // 如果没有“下一组”，滚一下
      if (!nextColors.value || nextColors.value.length === 0) rollNextColors()
      return
    }
  } catch {}
  reset()
})
</script>

<style scoped>
.page { padding: 24px; display: grid; gap: 12px; justify-items: center; }
.toolbar { display: flex; gap: 16px; align-items: center; }
.toolbar .next { display: inline-flex; gap: 6px; align-items: center; }
.toolbar .dot { width: 16px; height: 16px; border-radius: 50%; display: inline-block; box-shadow: 0 0 0 1px rgba(0,0,0,0.2) inset; }
.over { color: #c62828; font-weight: 600; }

.board {
  --cell: 40px;
  display: grid;
  gap: 4px;
  padding: 12px;
  background: #faf7ef;
  border: 2px solid #ccb37a;
  border-radius: 8px;
}
.cell {
  width: var(--cell);
  height: var(--cell);
  background: #f4e9c6;
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 6px;
  position: relative;
  padding: 0;
  cursor: pointer;
  transition: transform 120ms ease;
}
.cell.selected { outline: 2px solid #1976d2; outline-offset: -2px; }
.cell.moved { transform: scale(1.05); }

/* 球体表现：根据颜色 class 渲染 */
.cell::after {
  content: '';
  position: absolute;
  inset: 6px;
  border-radius: 50%;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.08);
  opacity: 0;
  transition: opacity 120ms ease;
}
.cell.c0::after { background: radial-gradient(circle at 35% 30%, #ff8a80, #e53935 60%, #b71c1c); border: 2px solid rgba(0,0,0,0.18); }
.cell.c1::after { background: radial-gradient(circle at 35% 30%, #90caf9, #1e88e5 60%, #0d47a1); border: 2px solid rgba(0,0,0,0.18); }
.cell.c2::after { background: radial-gradient(circle at 35% 30%, #a5d6a7, #43a047 60%, #1b5e20); border: 2px solid rgba(0,0,0,0.18); }
.cell.c3::after { background: radial-gradient(circle at 35% 30%, #fff59d, #f9a825 60%, #f57f17); border: 2px solid rgba(0,0,0,0.22); }
.cell.c4::after { background: radial-gradient(circle at 35% 30%, #ce93d8, #8e24aa 60%, #4a148c); border: 2px solid rgba(0,0,0,0.18); }
.cell.c5::after { background: radial-gradient(circle at 35% 30%, #bdbdbd, #424242 60%, #000000); border: 2px solid rgba(255,255,255,0.2); }
.cell.c0::after,
.cell.c1::after,
.cell.c2::after,
.cell.c3::after,
.cell.c4::after,
.cell.c5::after { opacity: 1; }

/* 清除动画：闪烁淡出 */
.cell.clearing::after { animation: vanish 220ms ease forwards; }
@keyframes vanish {
  0% { opacity: 1; transform: scale(1); }
  60% { opacity: 0.4; transform: scale(0.85); }
  100% { opacity: 0; transform: scale(0.7); }
}

/* 预告点颜色与球保持一致（使用中间色更易辨识）*/
.dot.c0 { background: #e53935; border: 1px solid rgba(0,0,0,0.2); }
.dot.c1 { background: #1e88e5; border: 1px solid rgba(0,0,0,0.2); }
.dot.c2 { background: #43a047; border: 1px solid rgba(0,0,0,0.2); }
.dot.c3 { background: #f9a825; border: 1px solid rgba(0,0,0,0.25); }
.dot.c4 { background: #8e24aa; border: 1px solid rgba(0,0,0,0.2); }
.dot.c5 { background: #212121; border: 1px solid rgba(255,255,255,0.6); }

button { outline: none; }
</style>
