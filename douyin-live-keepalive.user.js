// ==UserScript==
// @name         Douyin Live Keep-Alive | 抖音直播防暂停
// @namespace    https://github.com/yanglouis/douyin-live-keepalive
// @version      1.0.0
// @description  阻止抖音网页版直播因长时间无操作或切后台而自动暂停：伪装页面可见性、模拟用户活动、自动关闭"继续观看"弹窗、自动恢复非人为暂停。Prevent Douyin (douyin.com) live streams from auto-pausing when idle or in background.
// @author       yang'louis
// @match        *://live.douyin.com/*
// @run-at       document-start
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // ==================== 可按需调整的参数 ====================

  // 模拟鼠标移动的间隔（毫秒），用于重置"长时间未操作"的计时
  const IDLE_EVENT_INTERVAL_MS = 30 * 1000;

  // 扫描"继续观看"类弹窗的间隔（毫秒）
  const DIALOG_SCAN_INTERVAL_MS = 2 * 1000;

  // 后台保活的巡检间隔（毫秒）
  const BACKGROUND_RESUME_INTERVAL_MS = 5 * 1000;

  // 检测到非人为暂停后，延迟多久再恢复播放（毫秒）
  const RESUME_DELAY_MS = 1 * 1000;

  // 距上次真实操作在这个时间以内的暂停，视为用户手动暂停，不予恢复
  const MANUAL_GRACE_MS = 10 * 1000;

  // "继续观看"类按钮的文案特征（抖音更新弹窗文案后，在这里补充即可）
  const RESUME_TEXTS = ['继续观看', '继续播放', '仍然观看', '点击继续', 'resume'];
  // 自动点击只考虑文案不超过这个长度的元素，避免误点大容器
  const RESUME_MAX_TEXT_LENGTH = 12;

  const LOG_PREFIX = '[douyin-live-keepalive]';
  const log = (...args) => console.log(LOG_PREFIX, ...args);

  // ==================== 0. 记录真实可见性 ====================
  // 必须在伪装之前拿到原生 getter，否则之后就再也读不到真实状态了
  const nativeHidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
  const readRealHidden = () => {
    try {
      return nativeHidden ? nativeHidden.get.call(document) : false;
    } catch (e) {
      return false;
    }
  };

  let reallyHidden = readRealHidden();

  // 抢在所有页面代码之前监听可见性变化：先记录真实状态，再把事件吞掉，
  // 让抖音的代码感知不到"页面进入了后台"
  const swallowVisibilityChange = (e) => {
    reallyHidden = readRealHidden();
    e.stopImmediatePropagation();
  };
  window.addEventListener('visibilitychange', swallowVisibilityChange, true);
  document.addEventListener('visibilitychange', swallowVisibilityChange, true);

  // ==================== 1. 伪装页面始终可见、有焦点 ====================
  const defineFakeGetter = (obj, prop, value) => {
    try {
      Object.defineProperty(obj, prop, { get: () => value, configurable: true });
    } catch (e) {
      // 个别属性可能不可配置，忽略即可，后面的兜底层会补上
    }
  };

  defineFakeGetter(document, 'hidden', false);
  defineFakeGetter(document, 'visibilityState', 'visible');
  defineFakeGetter(document, 'webkitHidden', false);
  defineFakeGetter(document, 'webkitVisibilityState', 'visible');
  try {
    document.hasFocus = () => true;
  } catch (e) {
    // 同上，忽略
  }

  // 窗口级失焦/聚焦事件也一并吞掉。
  // 只吞 window/document 级别的，不影响输入框等元素级的焦点事件
  const swallowWindowFocus = (e) => {
    if (
      e.target === window ||
      e.target === document ||
      e.target === document.documentElement ||
      e.target === document.body
    ) {
      e.stopImmediatePropagation();
    }
  };
  window.addEventListener('blur', swallowWindowFocus, true);
  window.addEventListener('focus', swallowWindowFocus, true);

  // ==================== 2. 模拟用户活动 ====================
  // 定期派发合成的 mousemove，重置抖音的"长时间未操作"计时。
  // 合成事件的 isTrusted 为 false，如果检测能识别它，
  // 第 3 层（弹窗点击）和第 4 层（暂停恢复）会兜底
  const simulateActivity = () => {
    try {
      const x = 120 + Math.floor(Math.random() * 200);
      const y = 120 + Math.floor(Math.random() * 200);
      document.documentElement.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y,
          screenX: x,
          screenY: y,
        })
      );
    } catch (e) {
      // 静默失败即可
    }
  };
  setInterval(simulateActivity, IDLE_EVENT_INTERVAL_MS);

  // ==================== 3. 自动关闭"继续观看"弹窗 ====================
  const isResumeButton = (el) => {
    const text = (el.textContent || '').trim();
    if (!text || text.length > RESUME_MAX_TEXT_LENGTH) return false;
    const lower = text.toLowerCase();
    return RESUME_TEXTS.some((t) => lower.includes(t.toLowerCase()));
  };

  const clickResumeDialog = () => {
    try {
      const candidates = document.querySelectorAll(
        'button, [role="button"], a, span, div, p'
      );
      let target = null;
      for (const el of candidates) {
        // 跳过大容器：既省性能，也避免点到包着按钮的整个遮罩层
        if (el.childElementCount > 2) continue;
        if (!isResumeButton(el)) continue;
        // 父容器的 textContent 同样会命中，这里始终选最内层的那个
        if (!target || target.contains(el)) target = el;
      }
      if (!target) return;
      const rect = target.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return; // 不可见的跳过
      target.click();
      log('自动点击了弹窗按钮：', JSON.stringify(target.textContent.trim()));
    } catch (e) {
      // 静默失败即可
    }
  };
  setInterval(clickResumeDialog, DIALOG_SCAN_INTERVAL_MS);

  // ==================== 4. 暂停监视器：只恢复"非人为"的暂停 ====================
  // 记录最近一次真实用户输入的时间。合成事件伪造不了 isTrusted，
  // 所以这个判断不会被脚本自己的模拟活动污染
  let lastRealUserActionAt = Date.now();
  const REAL_INPUT_TYPES = ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'wheel'];
  REAL_INPUT_TYPES.forEach((type) => {
    window.addEventListener(
      type,
      () => {
        lastRealUserActionAt = Date.now();
      },
      true
    );
  });

  const tryPlay = (video) => {
    try {
      if (video.paused && !video.ended && typeof video.play === 'function') {
        const p = video.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch (e) {
      // 静默失败即可
    }
  };

  // pause 事件不冒泡，用捕获阶段监听才能覆盖页面上所有 <video>
  document.addEventListener(
    'pause',
    (e) => {
      const video = e.target;
      if (!(video instanceof HTMLVideoElement)) return;
      const isManual = Date.now() - lastRealUserActionAt <= MANUAL_GRACE_MS;
      // 后台里发生的暂停一定是自动的；前台时把最近操作过的让给用户
      if (reallyHidden || !isManual) {
        setTimeout(() => tryPlay(video), RESUME_DELAY_MS);
      }
    },
    true
  );

  // 后台期间的兜底巡检：无论以何种方式被暂停，都拉起来
  setInterval(() => {
    if (!reallyHidden) return;
    document.querySelectorAll('video').forEach(tryPlay);
  }, BACKGROUND_RESUME_INTERVAL_MS);

  log('已启动：可见性伪装 + 活动模拟 + 弹窗点击 + 暂停恢复');
})();
