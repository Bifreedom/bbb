<template>
  <section class="page">
    <h2>首页</h2>
    <p>这是 Home 页面。</p>
    <div class="links">
      <RouterLink to="/about">前往 About →</RouterLink>
      <RouterLink to="/minesweeper">玩扫雷 →</RouterLink>
    </div>
  </section>
</template>
<script setup>
</script>
<style scoped>
.page { padding: 24px; }
.links { display: flex; gap: 12px; margin-top: 8px; }
</style>
