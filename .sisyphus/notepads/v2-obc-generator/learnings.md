# V2 OBC Generator - 学习笔记

## 2026-06-03: calculator.js 创建完成

### 技术决策
- **导出方式**: 使用 CommonJS (`module.exports`)，与项目 `package.json` 中 `"type": "commonjs"` 保持一致
- **V1 vs V2 calcMinMax 差异**: V1用百分比误差（`nominal × (1 ± %)`），V2用绝对误差（`value ± error`）
- **精度处理**: 统一使用 `Math.round(value * 100) / 100` 保留2位小数，与V1一致
- **除零保护**: 所有涉及除法的函数（calcThreePhaseCurrent, estimateInputCurrent）都有除零检查

### 设计模式
- 纯函数：所有8个函数均为无副作用的纯数学函数
- 零依赖：不依赖任何npm包或DOM API
- 内部工具函数 `round2` 通过闭包共享，不对外暴露

### 函数签名决策
- `decideCurrentErrorMode(iout, errorValue)`: 需要第二个参数，因为返回值中的value来自用户输入
  - 与 `decideVoltageErrorMode(vout)` 不同，后者返回值是固定的（1或5）
- `calcRange` 返回 `'自动'` 字符串而非特殊数字信号，语义清晰

### QA结果
- 28个测试用例全部通过，覆盖正常值、边界值、异常值（除零）
