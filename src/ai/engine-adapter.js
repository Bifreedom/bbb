// 统一外部引擎适配层：暴露 initEngine() 与 getBestMove(board, side)
// 这里以 xqbase 为目标，假定在 window.XQBASE 提供接口：
//   init() -> Promise<void>
//   bestMove(fen, side) -> { from: idx, to: idx }
// 实际上 xqbase 的真实 API 可能不同；若你提供原始文件，我会对应调整解析与调用。

let engineReady = false

export async function initEngine() {
  if (engineReady) return true
  // 若页面上已注入 window.XQBASE 并具备 init 方法，则调用之
  if (typeof window !== 'undefined' && window.XQBASE && typeof window.XQBASE.init === 'function') {
    await window.XQBASE.init()
    engineReady = true
    return true
  }
  // 回退：找不到引擎
  return false
}

// 将我们内部 board(长度90) 转为简易 FEN-like（xqbase 若有自定义格式需改造）
function boardToSimpleFen(board) {
  let fen = ''
  for (let r = 0; r < 10; r++) {
    let empty = 0
    for (let c = 0; c < 9; c++) {
      const p = board[r*9+c]
      if (!p) { empty++ } else {
        if (empty>0) { fen += empty; empty = 0 }
        fen += pieceToChar(p)
      }
    }
    if (empty>0) fen += empty
    if (r !== 9) fen += '/'
  }
  return fen
}

function pieceToChar(p){
  const map = { K:'k', A:'a', E:'e', H:'h', R:'r', C:'c', P:'p' }
  const ch = map[p.type] || 'x'
  return p.side==='r' ? ch.toUpperCase() : ch
}

export async function getBestMove(board, side) {
  const ok = await initEngine()
  if (!ok) return null
  try {
    const fen = boardToSimpleFen(board)
    if (!window.XQBASE || typeof window.XQBASE.bestMove !== 'function') return null
    const ans = await window.XQBASE.bestMove(fen, side)
    if (!ans) return null
    const { from, to } = ans
    if (typeof from === 'number' && typeof to === 'number') {
      return { from, to }
    }
    return null
  } catch (e) {
    console.warn('xqbase getBestMove error:', e)
    return null
  }
}
