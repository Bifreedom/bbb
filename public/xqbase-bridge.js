// xqbase / XQWLight 引擎桥接
// 暴露全局接口：
//   window.XQBASE.init(): Promise<void>
//   window.XQBASE.bestMove(fen, side): Promise<{ from:number, to:number } | null>
// 其中 fen 为 9x10 的棋子布局（不含行棋方），side 为 'r' | 'b'
// 本桥接负责：
//   1) 动态加载 /public/xqwlight-master/JavaScript/position.js 与 search.js
//   2) 将 fen 与 side 合成 XQWLight 期望的 FEN（附加 " w"/" b"）
//   3) 用 Position + Search 搜索，返回 {from,to}（0..89）给上层适配层

(function(){
  let loaded = false
  let loadingPromise = null

  function loadScript(src){
    return new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = src
      s.async = true
      s.onload = resolve
      s.onerror = () => reject(new Error('Failed to load '+src))
      document.head.appendChild(s)
    })
  }

  function sq256ToIdx90(sq){
    // 基于 position.js 的 0x88 坐标：FILE_LEFT=3, RANK_TOP=3
    const FILE_LEFT = 3, RANK_TOP = 3
    const x = window.FILE_X ? window.FILE_X(sq) : (sq & 15)
    const y = window.RANK_Y ? window.RANK_Y(sq) : (sq >> 4)
    const c = x - FILE_LEFT
    const r = y - RANK_TOP
    return r * 9 + c
  }

  function ensureSideSuffix(fen, side){
    // XQWLight 的 FEN 需要在末尾加空格+行棋方 ' w' 或 ' b'
    // 我们内部 side: 'r' 表示红走 => ' w'；'b' 表示黑走 => ' b'
    const s = side === 'r' ? ' w' : ' b'
    // 如果传入 fen 已经有空格和行棋方，这里简单覆盖掉
    const sp = fen.indexOf(' ')
    if (sp >= 0) return fen.slice(0, sp) + s
    return fen + s
  }

  async function ensureLoaded(){
    if (loaded) return
    if (loadingPromise) return loadingPromise
    loadingPromise = (async () => {
      // 严格按顺序加载
      await loadScript('/xqwlight-master/JavaScript/position.js')
      await loadScript('/xqwlight-master/JavaScript/search.js')
      // 可选：开局库
      // await loadScript('/xqwlight-master/JavaScript/book.js')
      loaded = true
    })()
    return loadingPromise
  }

  window.XQBASE = {
    async init(){
      await ensureLoaded()
    },
    async bestMove(fen, side){
      await ensureLoaded()
      try {
        if (!window.Position || !window.Search){
          throw new Error('XQWLight not available')
        }
        const pos = new window.Position()
        const fenFull = ensureSideSuffix(fen, side)
        pos.fromFen(fenFull)
        // hashLevel 决定置换表大小：2^level 份条目，此处适中
        const hashLevel = 15
        const search = new window.Search(pos, hashLevel)
        // 迭代加深到超时为止
        const millis = 900
        const depth = 64
        const mv = search.searchMain(depth, millis) // 返回 0x88 mv
        if (!mv || mv === 0) return null
        const SRC = window.SRC, DST = window.DST
        const from = sq256ToIdx90(SRC(mv))
        const to = sq256ToIdx90(DST(mv))
        if (from < 0 || from >= 90 || to < 0 || to >= 90) return null
        return { from, to }
      } catch (e) {
        console.warn('XQBASE.bestMove error:', e)
        return null
      }
    }
  }
})();
