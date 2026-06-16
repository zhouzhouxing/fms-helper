# Decisions - V2 OBC Generator

## 2026-06-03 初始化

### 架构决策
1. **V2目录结构**: `src/js/v2/` 下新建calculator、steps、ui子目录
2. **V2 HTML**: 替换`src/index.html`，不保留V1 DOM
3. **模块导出**: 使用ES Module（import/export），与V1保持一致
4. **零依赖**: 不引入任何npm包或CDN

### 界面布局决策
- 三列布局：左侧点位表格、中间参数区、右侧预览区
- 从上到下：标题→模式选择→点位表格→误差参数→操作按钮→预览→导出

### 步骤编号决策
- 单相15步，三相16步
- 三相在步骤10后插入TriphasePowerResult，后续步骤+1偏移
