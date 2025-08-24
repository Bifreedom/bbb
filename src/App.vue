<template>
  <main class="container">
    <img alt="Vue logo" class="logo" src="https://vuejs.org/images/logo.png" />
    <h1>你好，Vue + Vite + Router</h1>
    <nav class="nav">
      <RouterLink to="/">首页</RouterLink>
      <span>·</span>
      <RouterLink to="/about">关于</RouterLink>
    </nav>
    <RouterView />
  </main>
</template>

<script setup>
</script>

<style>
  :root { color-scheme: light dark; font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; }
  .container { display: grid; place-items: center; min-height: 80vh; text-align: center; gap: 16px; }
  .logo { width: 96px; height: 96px; }
  .nav { display: flex; gap: 12px; align-items: center; }
</style>
