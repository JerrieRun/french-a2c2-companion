import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA：注册 Service Worker，首次访问后支持离线使用
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => {
        // 首次安装：等 SW 接管页面后自动刷新一次，把当前资源缓存好，之后断网也能用
        if (!navigator.serviceWorker.controller) {
          navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
        }
      })
      .catch(err => console.warn('Service Worker 注册失败：', err));
  });
}
