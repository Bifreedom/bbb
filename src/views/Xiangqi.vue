<template>
  <div class="xiangqi-page">
    <h2>中国象棋</h2>
    <div class="controls">
      <label>
        人类执子：
        <select v-model="humanSide" @change="onSideChanged">
          <option value="r">红方</option>
          <option value="b">黑方</option>
        </select>
      </label>
      <label>
        AI难度：
        <select v-model.number="aiLevel">
          <option :value="1">1 - 随机</option>
          <option :value="2">2 - 贪心</option>
          <option :value="3">3 - 浅层搜索</option>
          <option :value="4">4 - 加强(迭代加深)</option>
            <option :value="5">5 - xqbase(外部引擎)</option>
        </select>
      </label>
      <button @click="resetGame">重新开始</button>
      <span class="sep">|</span>
      <button @click="undo" :disabled="plyPtr===0 || isReplaying">悔棋</button>
      <button @click="redo" :disabled="plyPtr===history.length || isReplaying">前进</button>
      <span class="sep">|</span>
      <button @click="toggleReplay" :disabled="history.length===0">{{ isReplaying ? '暂停复盘' : '开始复盘' }}</button>
      <label class="speed" title="复盘速度">
        ×
        <select v-model.number="replaySpeed">
          <option :value="1200">0.5x</option>
          <option :value="800">0.75x</option>
          <option :value="600">1x</option>
          <option :value="350">1.5x</option>
          <option :value="220">2x</option>
        </select>
      </label>
    </div>

    <div class="status">
      <span>轮到：{{ currentSide === 'r' ? '红方' : '黑方' }}</span>
      <span v-if="inCheckNow && !gameOver" class="check"> | 将军！</span>
      <span v-if="gameOver"> | {{ resultText }}</span>
    </div>

    <div class="board" :class="{ flipped: humanSide === 'b' }">
      <div
        v-for="(sq, idx) in 90"
        :key="idx"
        class="square"
        :class="squareClass(idx)"
        @click="onSquareClick(idx)"
      >
        <div v-if="board[idx]" class="piece" :class="board[idx].side">
          {{ pieceText(board[idx]) }}
        </div>
      </div>
    </div>

    <div class="overlay" v-if="gameOver">
      <div class="result-card">
        <div class="title">对局结束</div>
        <div class="result">{{ resultText }}</div>
        <div class="actions">
          <button @click="resetGame">再来一局</button>
          <button @click="toggleReplay" :disabled="history.length===0">复盘</button>
        </div>
      </div>
    </div>

    <div class="tips">
      小提示：AI为简易实现，3 级为浅层 Alpha-Beta 搜索（慢一点）。规则包含马脚、象眼、将帅不见面、过河兵、炮打等常见规则。
    </div>
  </div>
  
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { getBestMove as xqBestMove, initEngine as xqInit } from '../ai/engine-adapter.js'

// 数据结构
// piece = { side: 'r'|'b', type: 'K'|'A'|'E'|'H'|'R'|'C'|'P' }

const humanSide = ref('r') // 人类默认红方
const currentSide = ref('r')
const selected = ref(null) // 选中格索引
const legalTargets = ref(new Set()) // 可走到的目标格
const gameOver = ref(false)
const winner = ref(null) // 'r' | 'b' | 'draw' | null
const aiLevel = ref(2)

const board = ref(makeInitialBoard())
// 历史与复盘
const initialBoard = ref(cloneBoard(board.value))
const history = ref([]) // [{ move, board }]
const plyPtr = ref(0)   // 指向“已走的步数”
const isReplaying = ref(false)
const replayTimer = ref(null)
const replaySpeed = ref(600)

function resetGame () {
  board.value = makeInitialBoard()
  initialBoard.value = cloneBoard(board.value)
  history.value = []
  plyPtr.value = 0
  currentSide.value = 'r'
  selected.value = null
  legalTargets.value = new Set()
  gameOver.value = false
  winner.value = null
  stopReplay()
  // 如果人类选择黑方，则AI先走一步
  maybeAIMove()
}

function onSideChanged() {
  // 切换执子后从当前局面继续；若轮到AI，则让AI走
  maybeAIMove()
}

const resultText = computed(() => {
  if (!gameOver.value) return ''
  if (winner.value === 'draw') return '和棋'
  return winner.value === 'r' ? '红方胜' : '黑方胜'
})

const inCheckNow = computed(() => isInCheck(board.value, currentSide.value))

function pieceText(p) {
  const mapR = { K: '帅', A: '仕', E: '相', H: '马', R: '车', C: '炮', P: '兵' }
  const mapB = { K: '将', A: '士', E: '象', H: '馬', R: '車', C: '炮', P: '卒' }
  return p.side === 'r' ? mapR[p.type] : mapB[p.type]
}

function idxToRC(idx){ return { r: Math.floor(idx/9), c: idx%9 } }
function rcToIdx(r,c){ return r*9+c }

function inPalace(side, r, c) {
  if (c < 3 || c > 5) return false
  if (side === 'r') return r >= 7 && r <= 9
  return r >= 0 && r <= 2
}

function sameSide(a, b){ return a && b && a.side === b.side }

function cloneBoard(src){
  return src.map(p => p ? { side: p.side, type: p.type } : null)
}

function makeInitialBoard(){
  const b = Array(90).fill(null)
  // 黑方（上）
  const place = (r,c,side,type)=>{ b[rcToIdx(r,c)] = { side, type } }
  place(0,0,'b','R'); place(0,8,'b','R')
  place(0,1,'b','H'); place(0,7,'b','H')
  place(0,2,'b','E'); place(0,6,'b','E')
  place(0,3,'b','A'); place(0,5,'b','A')
  place(0,4,'b','K')
  place(2,1,'b','C'); place(2,7,'b','C')
  for (let c=0;c<9;c+=2) place(3,c,'b','P')
  // 红方（下）
  place(9,0,'r','R'); place(9,8,'r','R')
  place(9,1,'r','H'); place(9,7,'r','H')
  place(9,2,'r','E'); place(9,6,'r','E')
  place(9,3,'r','A'); place(9,5,'r','A')
  place(9,4,'r','K')
  place(7,1,'r','C'); place(7,7,'r','C')
  for (let c=0;c<9;c+=2) place(6,c,'r','P')
  return b
}

function squareClass(idx){
  const s = []
  const { r, c } = idxToRC(idx)
  if ((r + c) % 2 === 0) s.push('light')
  else s.push('dark')
  if (selected.value === idx) s.push('selected')
  if (legalTargets.value.has(idx)) s.push('target')
  // 将军高亮
  const kIdx = findGeneral(board.value, currentSide.value)
  if (inCheckNow.value && idx === kIdx) s.push('check-king')
  return s
}

function onSquareClick(idx){
  if (gameOver.value) return
  const p = board.value[idx]
  const isHumanTurn = currentSide.value === humanSide.value
  if (!isHumanTurn) return

  if (selected.value == null) {
    if (p && p.side === currentSide.value) {
      selected.value = idx
      legalTargets.value = new Set(generateLegalMoves(board.value, idx).map(m => m.to))
    }
  } else {
    if (idx === selected.value) {
      selected.value = null
      legalTargets.value = new Set()
      return
    }
    const moves = generateLegalMoves(board.value, selected.value)
    const mv = moves.find(m => m.to === idx)
    if (mv) {
      applyMove(mv)
    } else {
      // 切换选择
      if (p && p.side === currentSide.value) {
        selected.value = idx
        legalTargets.value = new Set(generateLegalMoves(board.value, idx).map(m => m.to))
      } else {
        selected.value = null
        legalTargets.value = new Set()
      }
    }
  }
}

function afterStateUpdated(){
  // 更新当前走子方：奇偶与步数对应
  currentSide.value = (plyPtr.value % 2 === 0) ? 'r' : 'b'
  // 判胜负/和棋（当前走子方是否无合法步）
  const side = currentSide.value
  const moves = allLegalMoves(board.value, side)
  const inChk = isInCheck(board.value, side)
  if (moves.length === 0) {
    gameOver.value = true
    winner.value = inChk ? (side === 'r' ? 'b' : 'r') : 'draw'
  } else {
    gameOver.value = false
    winner.value = null
  }
}

function applyMove(mv){
  if (gameOver.value || isReplaying.value) return
  // 新走子会截断未来分支
  if (plyPtr.value < history.value.length) history.value.splice(plyPtr.value)
  makeMoveInPlace(board.value, mv)
  history.value.push({ move: mv, board: cloneBoard(board.value) })
  plyPtr.value++
  selected.value = null
  legalTargets.value = new Set()
  afterStateUpdated()
  maybeAIMove()
}

function restoreToPly(ply){
  if (ply <= 0){
    board.value = cloneBoard(initialBoard.value)
  } else {
    board.value = cloneBoard(history.value[ply-1].board)
  }
  selected.value = null
  legalTargets.value = new Set()
  gameOver.value = false
  winner.value = null
  plyPtr.value = Math.max(0, Math.min(ply, history.value.length))
  afterStateUpdated()
}

function undo(){
  if (plyPtr.value === 0) return
  stopReplay()
  restoreToPly(plyPtr.value - 1)
}

function redo(){
  if (plyPtr.value >= history.value.length) return
  stopReplay()
  restoreToPly(plyPtr.value + 1)
}

function toggleReplay(){
  if (isReplaying.value){
    stopReplay()
  } else {
    startReplay()
  }
}

function startReplay(){
  if (history.value.length===0) return
  stopReplay()
  isReplaying.value = true
  restoreToPly(0)
  replayTimer.value = setInterval(() => {
    if (plyPtr.value < history.value.length){
      restoreToPly(plyPtr.value + 1)
    } else {
      stopReplay()
    }
  }, replaySpeed.value)
}

function stopReplay(){
  if (replayTimer.value){
    clearInterval(replayTimer.value)
    replayTimer.value = null
  }
  isReplaying.value = false
}

async function maybeAIMove(){
  await nextTick()
  if (gameOver.value) return
  const isAITurn = currentSide.value !== humanSide.value
  if (!isAITurn) return
  // 简短延时，提升体验
  setTimeout(() => {
  const move = chooseAIMove(board.value, currentSide.value, aiLevel.value)
    if (move) {
      // 直接复用 applyMove 以记录历史与更新状态
      applyMove(move)
    }
  }, 200)
}

// 走子与生成
function generateLegalMoves(bd, fromIdx){
  const piece = bd[fromIdx]
  if (!piece) return []
  if (piece.side !== currentSide.value) return []
  const pseudo = generatePseudoMoves(bd, fromIdx)
  const res = []
  for (const m of pseudo) {
    const nb = simulateMove(bd, m)
    if (isFacing(nb)) continue
    if (isInCheck(nb, piece.side)) continue
    res.push(m)
  }
  return res
}

function allLegalMoves(bd, side){
  const res = []
  for (let i=0;i<90;i++){
    const p = bd[i]
    if (!p || p.side !== side) continue
    const pseudo = generatePseudoMoves(bd, i)
    for (const m of pseudo){
      const nb = simulateMove(bd, m)
      if (isFacing(nb)) continue
      if (isInCheck(nb, side)) continue
      res.push(m)
    }
  }
  return res
}

function generatePseudoMoves(bd, fromIdx){
  const res = []
  const p = bd[fromIdx]
  if (!p) return res
  const { r, c } = idxToRC(fromIdx)
  const add = (toIdx)=>{
    if (toIdx<0||toIdx>=90) return
    const t = bd[toIdx]
  if (!t || t.side !== p.side) res.push({ from: fromIdx, to: toIdx })
  }
  const dir = p.side === 'r' ? -1 : 1 // 行号向下为+1，红方在下，前进为-1
  if (p.type === 'K'){
    const steps = [[1,0],[-1,0],[0,1],[0,-1]]
    for (const [dr,dc] of steps){
      const nr=r+dr, nc=c+dc
      if (inPalace(p.side,nr,nc)){
        const to = rcToIdx(nr,nc)
        add(to)
      }
    }
  } else if (p.type === 'A'){
    const steps = [[1,1],[1,-1],[-1,1],[-1,-1]]
    for (const [dr,dc] of steps){
      const nr=r+dr, nc=c+dc
      if (inPalace(p.side,nr,nc)){
        add(rcToIdx(nr,nc))
      }
    }
  } else if (p.type === 'E'){
    const steps = [[2,2],[2,-2],[-2,2],[-2,-2]]
    for (const [dr,dc] of steps){
      const nr=r+dr, nc=c+dc
      // 不得过河
      if (p.side==='r' && nr<5) continue
      if (p.side==='b' && nr>4) continue
      const eye = rcToIdx(r+dr/2, c+dc/2)
      if (bd[eye]) continue
      if (nr>=0&&nr<10&&nc>=0&&nc<9) add(rcToIdx(nr,nc))
    }
  } else if (p.type === 'H'){
    const jumps = [
      [2,1,1,0],[2,-1,1,0],[-2,1,-1,0],[-2,-1,-1,0],
      [1,2,0,1],[1,-2,0,-1],[-1,2,0,1],[-1,-2,0,-1]
    ]
    for (const [dr,dc,br,bc] of jumps){
      const leg = rcToIdx(r+br, c+bc)
      if (r+dr<0||r+dr>=10||c+dc<0||c+dc>=9) continue
      if (bd[leg]) continue
      add(rcToIdx(r+dr,c+dc))
    }
  } else if (p.type === 'R' || p.type === 'C'){
    // 直线四方向
    const rays = [[1,0],[-1,0],[0,1],[0,-1]]
    for (const [dr,dc] of rays){
      let nr=r+dr, nc=c+dc
      if (p.type==='R'){
        while (nr>=0&&nr<10&&nc>=0&&nc<9){
          const to = rcToIdx(nr,nc)
          if (!bd[to]){ res.push({from:fromIdx,to}) }
          else { if (bd[to].side!==p.side) res.push({from:fromIdx,to}); break }
          nr+=dr; nc+=dc
        }
      } else { // Cannon
        // 非吃子走法：直到被挡
        while (nr>=0&&nr<10&&nc>=0&&nc<9){
          const to = rcToIdx(nr,nc)
          if (!bd[to]){ res.push({from:fromIdx,to}) }
          else { // 找到炮架
            nr+=dr; nc+=dc
            // 继续直到遇到第一个子，若为对方则可吃
            while (nr>=0&&nr<10&&nc>=0&&nc<9){
              const to2 = rcToIdx(nr,nc)
              if (bd[to2]){ if (bd[to2].side!==p.side) res.push({from:fromIdx,to:to2}); break }
              nr+=dr; nc+=dc
            }
            break
          }
          nr+=dr; nc+=dc
        }
      }
    }
  } else if (p.type === 'P'){
    const f = rcToIdx(r+dir,c)
    if (r+dir>=0&&r+dir<10) add(f)
    const crossed = (p.side==='r' ? r<=4 : r>=5)
    if (crossed){
      if (c-1>=0) add(rcToIdx(r, c-1))
      if (c+1<9) add(rcToIdx(r, c+1))
    }
  }
  return res
}

function simulateMove(bd, move){
  const nb = cloneBoard(bd)
  nb[move.to] = nb[move.from]
  nb[move.from] = null
  return nb
}

function makeMoveInPlace(bd, move){
  bd[move.to] = bd[move.from]
  bd[move.from] = null
}

function findGeneral(bd, side){
  for (let i=0;i<90;i++){
    const p = bd[i]
    if (p && p.side===side && p.type==='K') return i
  }
  return -1
}

function isFacing(bd){
  const rk = findGeneral(bd,'r')
  const bk = findGeneral(bd,'b')
  if (rk<0||bk<0) return false
  const { c: rc } = idxToRC(rk)
  const { c: bc } = idxToRC(bk)
  if (rc !== bc) return false
  const r1 = Math.min(Math.floor(rk/9), Math.floor(bk/9))
  const r2 = Math.max(Math.floor(rk/9), Math.floor(bk/9))
  for (let r=r1+1; r<r2; r++){
    if (bd[rcToIdx(r, rc)]) return false
  }
  return true
}

function isInCheck(bd, side){
  // 简单实现：生成对手伪合法走子，若能到己方将位置且不违反基本炮规则等即可。
  const king = findGeneral(bd, side)
  if (king<0) return true
  const opp = side === 'r' ? 'b' : 'r'
  // 将帅对面
  if (isFacing(bd)) return true
  for (let i=0;i<90;i++){
    const p = bd[i]
    if (!p || p.side!==opp) continue
    const pseudo = generatePseudoMoves(bd, i)
    if (pseudo.some(m => m.to === king)) return true
  }
  return false
}

// generatePseudoMovesOpponentView 已不再需要，因为 generatePseudoMoves 不依赖 currentSide

// 评估
const pieceVal = { K: 10000, R: 500, H: 300, C: 450, E: 150, A: 150, P: 120 }

function evaluate(bd){
  let score = 0
  for (const p of bd){
    if (!p) continue
    const v = pieceVal[p.type] || 0
    score += (p.side==='r' ? v : -v)
  }
  return score
}

function chooseAIMove(bd, side, level){
  if (level===5) {
    // 外部引擎：异步拉取结果，如果失败则回退到 4
    xqInit().then(async ok => {
      if (!ok) {
        const fallbackMove = chooseAIMove(bd, side, 4)
        if (fallbackMove) applyMove(fallbackMove)
        return
      }
      const mv = await xqBestMove(bd, side)
      if (mv) applyMove(mv)
      else {
        const fallbackMove = chooseAIMove(bd, side, 4)
        if (fallbackMove) applyMove(fallbackMove)
      }
    })
    return null
  }
  const moves = allLegalMoves(bd, side)
  if (moves.length===0) return null
  if (level<=1){
    return moves[Math.floor(Math.random()*moves.length)]
  }
  if (level===2){
    let best = []
    let bestGain = -Infinity
    for (const m of moves){
      const cap = bd[m.to]
      const gain = cap ? (pieceVal[cap.type]||0) : 0
      if (gain>bestGain){ bestGain=gain; best=[m] }
      else if (gain===bestGain){ best.push(m) }
    }
    return best[Math.floor(Math.random()*best.length)]
  }
  // level 3: depth-2 alpha-beta
  const depth = 2
  const me = side
  const alphaBeta = (state, d, a, b, toMove)=>{
    if (d===0){
      const val = evaluate(state)
      return me==='r' ? val : -val
    }
    const ms = allLegalMoves(state, toMove)
    if (ms.length===0){
      // 将死或和棋
      const inChk = isInCheck(state, toMove)
      if (inChk) return -9999 // 当前无子可走且被将军 => 极差
      return 0
    }
    // 简单的吃子优先排序
    ms.sort((a,b)=>{
      const ca = state[a.to] ? (pieceVal[state[a.to].type]||0) : 0
      const cb = state[b.to] ? (pieceVal[state[b.to].type]||0) : 0
      return cb - ca
    })
    if (toMove===me){
      let v = -Infinity
      for (const m of ms){
        const ns = simulateMove(state, m)
        v = Math.max(v, alphaBeta(ns, d-1, a, b, me==='r'?'b':'r'))
        a = Math.max(a, v)
        if (b<=a) break
      }
      return v
    } else {
      let v = Infinity
      for (const m of ms){
        const ns = simulateMove(state, m)
        v = Math.min(v, alphaBeta(ns, d-1, a, b, me))
        b = Math.min(b, v)
        if (b<=a) break
      }
      return v
    }
  }
  let bestMove = moves[0]
  let bestScore = -Infinity
  for (const m of moves){
    const ns = simulateMove(bd, m)
    const sc = alphaBeta(ns, depth-1, -Infinity, Infinity, side==='r'?'b':'r')
    if (sc>bestScore){ bestScore=sc; bestMove=m }
  }
  if (level===3) return bestMove
  // level 4: 迭代加深 + 时间限制
  const timeLimit = 900 // ms
  const endTime = Date.now() + timeLimit
  let globalBest = bestMove
  let lastScore = bestScore
  let d = 3
  while (Date.now() < endTime) {
    let bmv = globalBest
    let bsc = -Infinity
    // 以上一层最佳为首进行排序（启发）
    const sorted = moves.slice()
    sorted.sort((a,b)=>{
      if (a===globalBest) return -1
      if (b===globalBest) return 1
      const ca = bd[a.to] ? (pieceVal[bd[a.to].type]||0) : 0
      const cb = bd[b.to] ? (pieceVal[bd[b.to].type]||0) : 0
      return cb - ca
    })
    let cut = false
    for (const m of sorted){
      if (Date.now() >= endTime) { cut=true; break }
      const ns = simulateMove(bd, m)
      const sc = alphaBeta(ns, d-1, -Infinity, Infinity, side==='r'?'b':'r')
      if (sc > bsc){ bsc = sc; bmv = m }
    }
    if (!cut){ globalBest = bmv; lastScore = bsc; d++ } else break
    if (d > 5) break // 控制最大深度，避免卡顿
  }
  return globalBest
}

// 初始如果人类选择黑方，让AI先走
watch(humanSide, () => { maybeAIMove() })
onMounted(() => {
  const script = document.createElement('script')
  // 使用相对路径，兼容 GitHub Pages 的二级路径部署
  script.src = './xqbase-bridge.js'
  script.async = true
  document.head.appendChild(script)
})

// 页面加载后，若应由AI先走（人类黑方），则执行
maybeAIMove()
</script>

<style scoped>
.xiangqi-page { max-width: 900px; margin: 0 auto; }
.controls { display: flex; gap: 12px; align-items: center; justify-content: center; flex-wrap: wrap; }
.controls .sep { opacity: .5; }
.controls .speed select { margin-left: 4px; }
.status { margin: 8px 0; text-align: center; }
.status .check { color: #d84315; font-weight: 600; }
.tips { margin-top: 10px; color: #888; font-size: 12px; text-align: center; }

.board {
  width: min(90vw, 540px);
  aspect-ratio: 9 / 10;
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  grid-template-rows: repeat(10, 1fr);
  gap: 0;
  border: 2px solid #b88a4a;
  background: #f5e6c8;
  margin: 0 auto;
  position: relative;
}
.board.flipped { transform: rotate(180deg); }
.board.flipped .piece { transform: rotate(180deg); }

.square { border: 1px solid #d2b48c; display: flex; align-items: center; justify-content: center; position: relative; }
.square.light { background: #f8efdc; }
.square.dark { background: #f3e8cf; }
.square.selected { outline: 2px solid #4a90e2; outline-offset: -2px; }
.square.target { box-shadow: inset 0 0 0 2px rgba(76,175,80,.9); }
.square.check-king { box-shadow: inset 0 0 0 3px rgba(216,67,21,.95); animation: pulse 0.9s infinite; }

.piece {
  width: 90%; height: 90%;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: bold;
  font-size: clamp(14px, 4.2vw, 28px);
  user-select: none;
  box-shadow: 0 2px 2px rgba(0,0,0,.15) inset, 0 1px 2px rgba(0,0,0,.1);
  border: 2px solid #a58554;
  background: radial-gradient(circle at 30% 30%, #fff, #f7e9cd);
}
.piece.r { color: #c0392b; }
.piece.b { color: #333; }

.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); display: grid; place-items: center; animation: fadeIn .25s ease-out; }
.result-card { background: #fff; color: #333; padding: 18px 22px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.2); text-align: center; min-width: 260px; transform: scale(.9); animation: pop .25s ease-out forwards; }
.result-card .title { font-size: 14px; opacity: .7; margin-bottom: 6px; }
.result-card .result { font-size: 20px; font-weight: 700; margin-bottom: 12px; }
.result-card .actions { display: flex; gap: 10px; justify-content: center; }

@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes pop { from { transform: scale(.9); opacity: .6 } to { transform: scale(1); opacity: 1 } }
@keyframes pulse { 0% { box-shadow: inset 0 0 0 1px rgba(216,67,21,.7) } 50% { box-shadow: inset 0 0 0 3px rgba(216,67,21,1) } 100% { box-shadow: inset 0 0 0 1px rgba(216,67,21,.7) } }
</style>
