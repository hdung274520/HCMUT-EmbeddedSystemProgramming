/**
 * Cấu hình Tailwind CSS CDN (js/config/tailwind-config.js)
 * Tối ưu cho giao diện kỹ thuật Dark-first (Emerald + Deep Slate) & hỗ trợ Light Mode.
 */
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      colors: {
        surface: {
          950: '#0a0f14',
          900: '#0e141b',
          850: '#131b24',
          800: '#18222d',
          700: '#243242'
        }
      }
    }
  }
};
