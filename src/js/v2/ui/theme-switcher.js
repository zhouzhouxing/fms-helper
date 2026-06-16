/**
 * 主题切换器
 * 管理暗色主题的切换、持久化和UI渲染
 */

const THEME_KEY = 'fms-helper-theme';
const THEMES = [
  { id: 'i', label: '暗红科技',  color: '#e94560' },
  { id: 'h', label: '蓝白简约',  color: '#007bff' },
  { id: 'j', label: 'GitHub暗色', color: '#f78166' },
  { id: 'k', label: '紫色毛玻璃', color: '#8b5cf6' },
  { id: 'l', label: '终端绿',    color: '#7ee787' },
  { id: 'm', label: '青紫渐变',  color: '#06b6d4' },
  { id: 'n', label: '灰锌',      color: '#06b6d4' },
  { id: 'o', label: '亮白清爽',  color: '#2563eb' },
];

// 当前主题
let currentTheme = 'o';

/**
 * 初始化主题系统
 */
export function initThemeSwitcher() {
  // 从localStorage读取保存的主题
  const saved = localStorage.getItem(THEME_KEY);
  if (saved && THEMES.some(t => t.id === saved)) {
    currentTheme = saved;
  }

  // 应用主题
  applyTheme(currentTheme);

  // 创建切换器UI
  createThemeSwitcher();
}

/**
 * 应用主题到DOM
 */
function applyTheme(themeId) {
  currentTheme = themeId;
  document.documentElement.setAttribute('data-theme', themeId);
  localStorage.setItem(THEME_KEY, themeId);

  // 更新切换器中的选中状态
  const items = document.querySelectorAll('.theme-item');
  items.forEach(item => {
    item.classList.toggle('active', item.dataset.theme === themeId);
  });
}

/**
 * 创建主题切换器UI（工具栏中的按钮 + 下拉面板）
 */
function createThemeSwitcher() {
  // 找到工具栏右侧区域
  const toolbar = document.querySelector('.v2-toolbar');
  if (!toolbar) return;

  // 创建主题按钮容器
  const themeBtn = document.createElement('button');
  themeBtn.className = 'btn-theme-toggle';
  themeBtn.title = '切换主题';
  themeBtn.innerHTML = '🎨';

  // 创建下拉面板
  const dropdown = document.createElement('div');
  dropdown.className = 'theme-dropdown';

  // 标题
  const dropdownTitle = document.createElement('div');
  dropdownTitle.className = 'theme-dropdown-title';
  dropdownTitle.textContent = '选择主题';
  dropdown.appendChild(dropdownTitle);

  // 主题列表
  const list = document.createElement('div');
  list.className = 'theme-list';

  THEMES.forEach(theme => {
    const item = document.createElement('div');
    item.className = 'theme-item' + (theme.id === currentTheme ? ' active' : '');
    item.dataset.theme = theme.id;

    // 颜色圆点
    const dot = document.createElement('span');
    dot.className = 'theme-dot';
    dot.style.background = theme.color;

    // 主题名
    const label = document.createElement('span');
    label.className = 'theme-label';
    label.textContent = theme.label;

    // 选中标记
    const check = document.createElement('span');
    check.className = 'theme-check';
    check.textContent = '✓';

    item.appendChild(dot);
    item.appendChild(label);
    item.appendChild(check);

    // 点击切换
    item.addEventListener('click', () => {
      applyTheme(theme.id);
      // 关闭面板
      dropdown.classList.remove('show');
    });

    list.appendChild(item);
  });

  dropdown.appendChild(list);

  // 按钮点击切换面板显隐
  themeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('show');
  });

  // 点击其他地方关闭面板
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== themeBtn) {
      dropdown.classList.remove('show');
    }
  });

  // 将按钮和面板添加到工具栏
  const wrapper = document.createElement('div');
  wrapper.className = 'theme-wrapper';
  wrapper.appendChild(themeBtn);
  wrapper.appendChild(dropdown);

  // 插入到工具栏末尾
  toolbar.appendChild(wrapper);
}

/**
 * 获取当前主题ID
 */
export function getCurrentTheme() {
  return currentTheme;
}
