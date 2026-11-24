/**
 * Bộ điều khiển Thanh kéo chia đôi khung nhìn (js/resizer.js)
 * Hỗ trợ kéo chuột, nhấp đúp đặt lại 50/50 và điều hướng bàn phím cho chế độ Song song.
 */
window.SplitResizer = (function () {
  function init(onResizeCallback) {
    const workspace = document.getElementById('workspaceContainer');
    const hResizer = document.getElementById('paneResizer');
    const ideArea = document.getElementById('ideSplitArea');
    const vResizer = document.getElementById('verticalResizer');

    if (!workspace || !hResizer || !ideArea || !vResizer) return;

    let draggingH = false;
    let draggingV = false;

    hResizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      draggingH = true;
      document.body.style.cursor = 'col-resize';
    });

    hResizer.addEventListener('dblclick', () => {
      document.documentElement.style.setProperty('--left-pane-width', '50%');
      if (onResizeCallback) onResizeCallback();
    });

    hResizer.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const cur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--left-pane-width')) || 50;
      const next = Math.min(72, Math.max(28, cur + (e.key === 'ArrowRight' ? 3 : -3)));
      document.documentElement.style.setProperty('--left-pane-width', `${next}%`);
      if (onResizeCallback) onResizeCallback();
    });

    vResizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      draggingV = true;
      document.body.style.cursor = 'row-resize';
    });

    vResizer.addEventListener('dblclick', () => {
      document.documentElement.style.setProperty('--editor-height', '55%');
      if (onResizeCallback) onResizeCallback();
    });

    window.addEventListener('mousemove', (e) => {
      if (draggingH) {
        const rect = workspace.getBoundingClientRect();
        const pct = ((e.clientX - rect.left) / rect.width) * 100;
        const clamped = Math.min(72, Math.max(28, pct));
        document.documentElement.style.setProperty('--left-pane-width', `${clamped.toFixed(1)}%`);
        if (onResizeCallback) onResizeCallback();
      } else if (draggingV) {
        const rect = ideArea.getBoundingClientRect();
        const pct = ((e.clientY - rect.top) / rect.height) * 100;
        const clamped = Math.min(78, Math.max(20, pct));
        document.documentElement.style.setProperty('--editor-height', `${clamped.toFixed(1)}%`);
        if (onResizeCallback) onResizeCallback();
      }
    });

    window.addEventListener('mouseup', () => {
      if (draggingH || draggingV) {
        draggingH = false;
        draggingV = false;
        document.body.style.cursor = '';
      }
    });
  }

  return { init };
})();
