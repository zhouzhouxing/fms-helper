# FMS Helper - Frame.ManagementSystem 测试脚本配置文件生成器

## TL;DR

> **Quick Summary**: 开发一个Electron桌面软件，通过表单填写替代手动操作Frame.ManagementSystem，自动生成DBC666和CFG666 JSON文件，将5-6小时的手动配置缩短到几分钟。支持OBC+DCDC脚本、逆变脚本、自由组合脚本三种模式。
> 
> **Deliverables**:
> - Electron桌面应用（可打包为.exe，支持桌面快捷方式）
> - DBC666 JSON文件生成功能
> - CFG666 JSON文件生成功能（支持13种TempletType）
> - 自动计算电压/电流范围（标称值±误差→上下限）
> - 模板加载功能（导入已有配置文件作为起点）
> - 测试项拖拽排序
> - 脚本类型选择（OBC+DCDC / 逆变 / 自由组合）
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: T1(Electron骨架) → T4(TempletValue解析器) → T6-T7(UI+脚本类型) → T8-T11(表单) → T16(文件导出) → T19(端到端验证)

---

## Context

### Original Request
用户在汽车行业从事OBC/DCDC/逆变器的CAN总线测试工作，使用公司内部工具Frame.ManagementSystem编写测试脚本。目前手动编写一个脚本需要5-6小时且容易出错，需要开发一个工具自动生成DBC666和CFG666配置文件。

### Interview Summary
**Key Discussions**:
- 输入源：DBC文件（公司内部格式）+ Excel测试方案（格式不固定）
- 用户希望手动输入/粘贴数据到工具中，V1不做Excel自动解析
- 支持OBC + DCDC + 逆变器三种产品类型
- **脚本类型组合**：
  - OBC + DCDC 写成**一个**测试脚本（一个CFG666）
  - 逆变是**单独的**一个测试脚本
  - 有时只写OBC、有时只写DCDC、有时什么都不写，看项目需求
  - 工具应让用户选择"这次创建什么类型的脚本"
- Frame.ManagementSystem的2个子工具都有导入导出功能
- ~10人团队使用，不需要登录
- 用户选择**桌面软件**（Electron），而非浏览器版

**Research Findings**:
- DBC666 = JSON文件（UTF-8无BOM），含SignParaInfo[]数组映射CAN信号
- CFG666 = JSON文件（UTF-8有BOM），含ConfigPara[]数组定义测试序列
- TempletValue格式：`Key∥Value‖Bool‖Index`，使用`§`分隔参数组
- 不同TempletType有不同字段数（3/4/5字段），GlobalVariableConfig的TempletValue是原始JSON数组
- 发现13种TempletType，V1先支持最常见的6种，其余提供"原始编辑器"

### Metis Review
**Identified Gaps** (addressed):
- 编码是UTF-8而非GB2312 → 简化了文件处理
- 分隔符是`§`/`∥`/`‖`而非`¶` → 修正了解析逻辑
- TempletValue格式因TempletType而异 → 采用类型专属格式化器
- CFG666需要UTF-8 BOM，DBC666不需要 → 文件导出需处理BOM
- GlobalVariableConfig的TempletValue是JSON数组 → 需特殊表单

---

## Work Objectives

### Core Objective
构建一个Electron桌面应用，让用户通过选择脚本类型+填写表单来替代在Frame.ManagementSystem中5-6小时的手动配置，自动生成可直接导入的DBC666和CFG666文件。

### Concrete Deliverables
- Electron桌面应用（可打包为.exe，双击运行，支持桌面快捷方式）
- 新建脚本时选择类型：OBC+DCDC / 逆变 / 自由组合（自由勾选OBC/DCDC/逆变）
- 根据选择的类型自动预置对应的测试项模板
- DBC666文件生成器（JSON格式，UTF-8无BOM）
- CFG666文件生成器（JSON格式，UTF-8有BOM）
- 6种核心TempletType的专用表单
- 7种高级TempletType的原始编辑器（fallback）
- 电压/电流自动范围计算（标称值±误差/百分比）
- 测试项拖拽排序
- 模板加载（导入已有配置文件）
- 直接读写本地文件（无需手动选文件，像正常软件一样）

### Definition of Done
- [ ] 用生成的DBC666文件导入Frame.ManagementSystem成功
- [ ] 用生成的CFG666文件导入Frame.ManagementSystem成功
- [ ] 中文字符在Frame.ManagementSystem中显示正确无乱码
- [ ] 自动计算的电压/电流范围值正确
- [ ] 选择"OBC+DCDC"后预置正确的测试项模板
- [ ] 选择"逆变"后预置正确的测试项模板
- [ ] 应用可打包为.exe，双击运行

### Must Have
- Electron桌面应用，可打包为.exe
- 新建脚本时选择脚本类型（OBC+DCDC / 逆变 / 自由组合）
- 根据脚本类型预置对应测试项模板
- 正确处理TempletValue中`§`/`∥`/`‖`分隔符
- CFG666生成时带UTF-8 BOM（EF BB BF），DBC666不带BOM
- 直接读写本地文件（Node.js fs模块，非浏览器File API）
- 每种TempletType有对应的表单或原始编辑器
- 测试项支持添加、删除、排序
- 支持从已有配置文件加载作为模板
- 中文界面
- 所有输入有校验（数值类型、必填字段等）
- 标称值±误差自动计算上下限（支持绝对值和百分比）

### Must NOT Have (Guardrails)
- ❌ 不做Excel自动解析（V1，以后可加）
- ❌ 不做DBC文件自动读取
- ❌ 不做测试执行功能
- ❌ 不做云端同步/分享
- ❌ 不做用户登录/权限系统
- ❌ 不做GB2312编码转换（文件实际是UTF-8）
- ❌ 不做自动生成RPN表达式（GlobalVariableCalculate的复杂表达式由用户手动输入）
- ❌ 不做模板市场/模板库
- ❌ 不假设所有TempletValue都是4字段格式
- ❌ 不硬编码TempletType到表单的映射（要可扩展）

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: None（V1不做单元测试，以QA场景为主）
- **Framework**: none

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Electron UI**: Use Playwright (playwright skill) - Navigate, interact, assert DOM, screenshot
- **File Generation**: Use Bash - Generate files, validate JSON, check BOM, verify content

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - 6 tasks parallel):
├── T1: Electron项目骨架搭建 [unspecified-high]
├── T2: DBC666 Schema + 类型定义 [quick]
├── T3: CFG666 Schema + 类型定义 + 脚本类型模板 [deep]
├── T4: TempletValue解析/格式化引擎 [deep]
└── T5: 文件读写工具（Node.js fs + BOM处理） [quick]

Wave 2 (Core UI - 6 tasks parallel):
├── T6: 主界面布局（含脚本类型选择） [visual-engineering]
├── T7: 测试项列表管理器（增删排序） [unspecified-high]
├── T8: OBCDeviceConfig表单 [unspecified-high]
├── T9: InvertDeviceConfig + DCDCDeviceConfig表单 [unspecified-high]
├── T10: ProductConfig表单（含FuncDesc子类型） [deep]
└── T11: DelayConfig + PowerMeterAdvancedConfig表单 [unspecified-high]

Wave 3 (Advanced Features - 5 tasks parallel):
├── T12: PowerResult表单（含min/max自动计算） [deep]
├── T13: GlobalVariable*系列表单（4种类型） [deep]
├── T14: 原始TempletValue编辑器（fallback） [unspecified-high]
├── T15: 模板加载器（导入已有配置文件） [deep]
└── T16: 文件导出管道（完整DBC666+CFG666生成） [deep]

Wave 4 (Polish + Verification - 4 tasks):
├── T17: 输入校验引擎 + 错误提示 [unspecified-high]
├── T18: 端到端验证（round-trip test） [deep]
├── T19: UI打磨 + 可用性优化 [visual-engineering]
└── T20: 使用说明 + Electron打包分发 [writing]

Wave FINAL (4 parallel reviews):
├── F1: 计划合规审计 (oracle)
├── F2: 代码质量审查 (unspecified-high)
├── F3: 实际手动QA (unspecified-high + playwright)
└── F4: 范围一致性检查 (deep)

Critical Path: T1 → T4 → T6-T7 → T8-T11 → T12-T13 → T16 → T18 → F1-F4
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 6 (Wave 2)
```

### Dependency Matrix

| Task | Blocked By | Blocks |
|------|-----------|--------|
| T1 | - | T2-T7 |
| T2 | T1 | T15, T16 |
| T3 | T1 | T6, T15, T16 |
| T4 | T1 | T8-T14, T16 |
| T5 | T1 | T15, T16 |
| T6 | T1, T3 | T7, T8-T14, T19 |
| T7 | T6 | T8-T14, T17 |
| T8 | T4, T6 | T16 |
| T9 | T4, T6 | T16 |
| T10 | T4, T6 | T16 |
| T11 | T4, T6 | T16 |
| T12 | T4, T7 | T16 |
| T13 | T4, T7 | T16 |
| T14 | T4, T7 | T16 |
| T15 | T2, T3, T5, T7 | T18 |
| T16 | T2, T3, T5, T8-T14 | T18 |
| T17 | T7, T16 | T18 |
| T18 | T15, T16, T17 | F3 |
| T19 | T16, T17 | - |
| T20 | T18 | - |

### Agent Dispatch Summary

- **Wave 1**: 5 tasks - T1 → `unspecified-high`, T2 → `quick`, T3 → `deep`, T4 → `deep`, T5 → `quick`
- **Wave 2**: 6 tasks - T6 → `visual-engineering`, T7 → `unspecified-high`, T8, T9, T11 → `unspecified-high`, T10 → `deep`
- **Wave 3**: 5 tasks - T12, T13, T15, T16 → `deep`, T14 → `unspecified-high`
- **Wave 4**: 4 tasks - T17 → `unspecified-high`, T18 → `deep`, T19 → `visual-engineering`, T20 → `writing`
- **FINAL**: 4 tasks - F1 → `oracle`, F2, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.
> **A task WITHOUT QA Scenarios is INCOMPLETE. No exceptions.**

- [ ] 1. Electron项目骨架搭建

  **What to do**:
  - 在 `D:\脚本合集\Open code\fms-helper\` 下初始化项目：
    - `npm init` 生成 package.json
    - 安装 Electron：`npm install electron --save-dev`
    - 创建 Electron 主进程文件 `main.js`（创建窗口、加载渲染页面）
    - 创建 `preload.js`（安全的IPC桥接，让渲染进程可以调用fs等Node.js API）
  - 创建渲染进程文件：
    - `src/index.html`（主页面）
    - `src/css/style.css`（样式）
    - `src/js/main.js`（前端入口，ES模块）
  - Electron窗口配置：
    - 标题："FMS Helper - 测试脚本配置工具"
    - 大小：1200x800，可调整
    - 无菜单栏（自定义工具栏）
    - 中文字体（微软雅黑）
  - 配置 `package.json` scripts：
    - `"start": "electron ."` — 开发运行
    - `"build": "electron-builder"` — 打包exe

  **Must NOT do**:
  - 不引入前端框架（React/Vue等）
  - 不使用TypeScript
  - 不使用构建工具（webpack/vite等），Electron原生加载

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Electron项目搭建涉及主进程/渲染进程/preload.js的配置，有一定复杂度
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (foundation task)
  - **Blocks**: T2, T3, T4, T5, T6, T7
  - **Blocked By**: None (can start immediately)

  **References**:

  **External References**:
  - Electron官方文档：BrowserWindow、ipcMain/ipcRenderer、contextBridge
  - 项目路径：`D:\脚本合集\Open code\fms-helper\`

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Electron应用正常启动
    Tool: Bash
    Preconditions: 项目已初始化，Electron已安装
    Steps:
      1. 在项目目录运行 npm start
      2. 验证Electron窗口打开
      3. 验证窗口标题包含"FMS Helper"
      4. 验证窗口大小约1200x800
      5. 关闭窗口，验证进程正常退出
    Expected Result: 窗口正常显示中文标题，无报错
    Evidence: .sisyphus/evidence/task-1-electron-start.png

  Scenario: 渲染进程能调用Node.js API
    Tool: Bash
    Steps:
      1. 在渲染进程中通过preload.js调用fs.readdir
      2. 验证能读取到项目目录下的文件列表
    Expected Result: Node.js API通过IPC桥接可用
    Evidence: .sisyphus/evidence/task-1-preload-test.txt
  ```

  **Commit**: YES
  - Message: `feat: init Electron project skeleton with main/preload/renderer`
  - Files: `main.js, preload.js, package.json, src/index.html, src/css/style.css, src/js/main.js`
  - Pre-commit: none

- [ ] 2. DBC666 Schema + 类型定义

  **What to do**:
  - 创建 `src/js/schema/dbc666-schema.js`
  - 定义DBC666的完整JSON结构（参考桌面上的DBC666文件）：
    - 顶层字段：DbcFileGUID, TraceInfomation, CommuncationMode, BaudRate, ProtocolVersion, ConfigName, CrcCheckType, CrcCheckInfo, SignParaInfo, TrigParaInfo
    - SignParaInfo条目：SignType(0/1/2/3), TempletName, ControlName, ParaName, DBCMsgID, DBCSignName, DBCValueDesc
  - 导出创建空DBC666对象的工厂函数`createEmptyDBC666(configName)`
  - 导出验证DBC666 JSON结构的函数`validateDBC666(json)`

  **Must NOT do**:
  - 不实现解析功能（T15做）
  - 不硬编码所有405个SignParaInfo条目

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 纯数据结构定义
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T3, T4, T5)
  - **Blocks**: T15, T16
  - **Blocked By**: T1

  **References**:

  **Pattern References**:
  - 桌面DBC666文件 - 完整的JSON结构参考：
    - SignType有0/1/2/3四种值
    - TempletName有"OBC功能检查"、"总接收"、"产品配置"、"功能结果"、"功率结果"、"全局变量读取"、"全局变量写入"等
    - ControlName命名规律：lbl前缀+功能名+编号
    - DBCMsgID格式为"0x"开头的十六进制字符串

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 创建空DBC666对象结构正确
    Tool: Bash (node)
    Steps:
      1. import { createEmptyDBC666 } from './src/js/schema/dbc666-schema.js'
      2. const obj = createEmptyDBC666('测试配置')
      3. 验证输出包含所有顶层字段
      4. 验证SignParaInfo是空数组
    Expected Result: 输出有效JSON，包含所有必需字段
    Evidence: .sisyphus/evidence/task-2-empty-dbc666.json
  ```

  **Commit**: YES (groups with T3)
  - Message: `feat: add DBC666 and CFG666 schema definitions`
  - Files: `src/js/schema/dbc666-schema.js`

- [ ] 3. CFG666 Schema + 类型定义 + 脚本类型模板

  **What to do**:
  - 创建 `src/js/schema/cfg666-schema.js`
  - 定义CFG666的完整JSON结构（同原计划，13种TempletType参数模板）
  - **新增：脚本类型模板定义**
    - 创建 `src/js/schema/script-templates.js`
    - 定义三种脚本类型及其预置测试项：
      - **"OBC + DCDC"模式**：预置 PowerMeterAdvancedConfig → OBCDeviceConfig(辅电) → ProductConfig(唤醒) → OBCDeviceConfig(HVAC) → OBCDeviceConfig(模拟电池) → ProductConfig(启机) → ... → DCDC相关测试项 → PowerResult → ...
      - **"逆变"模式**：预置 PowerMeterAdvancedConfig → InvertDeviceConfig → ProductConfig → ... → PowerResult → ...
      - **"自由组合"模式**：空列表，用户自己添加
    - 每种模式的预置测试项顺序、TempletType、FuncDesc、默认参数值
    - 导出函数 `getScriptTemplate(type)` 返回预置的ConfigPara数组

  **Must NOT do**:
  - 不实现TempletValue的解析（T4做）
  - 不硬编码参数值，只定义结构和默认值

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 需要从2个实际CFG666文件中提取模板，新增脚本类型模板定义
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T2, T4, T5)
  - **Blocks**: T6, T15, T16
  - **Blocked By**: T1

  **References**:

  **Pattern References**:
  - 桌面小米CFG666（57项）= OBC+DCDC模式的参考
  - 桌面Renault CFG666（137项）= 逆变模式的参考
  - 两种文件的测试项顺序和类型需要提取为模板

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 每种脚本类型都能生成预置模板
    Tool: Bash (node)
    Steps:
      1. 调用getScriptTemplate('obc-dcdc')，验证返回包含OBCDeviceConfig和DCDCDeviceConfig测试项
      2. 调用getScriptTemplate('inverter')，验证返回包含InvertDeviceConfig测试项
      3. 调用getScriptTemplate('custom')，验证返回空数组
    Expected Result: 三种模式都返回正确的预置项
    Evidence: .sisyphus/evidence/task-3-script-templates.json
  ```

  **Commit**: YES (groups with T2)
  - Message: `feat: add DBC666 and CFG666 schema definitions with script templates`
  - Files: `src/js/schema/cfg666-schema.js, src/js/schema/script-templates.js`

- [ ] 4. TempletValue解析/格式化引擎

  **What to do**:
  - 同原计划，创建 `src/js/lib/templet-value.js`
  - 核心解析和格式化功能不变：
    - 分隔符：`§`（U+00A7）、`∥`（U+2225）、`‖`（U+2016）
    - 按TempletType分别处理4字段/5字段/JSON数组/混合格式
    - 注册表模式，可扩展
  - **注意**：路径改为 `src/js/lib/`

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T8-T14, T16
  - **Blocked By**: T1

  **References**: 同原计划

  **Acceptance Criteria**: 同原计划（round-trip测试、中文测试、JSON数组测试）

  **Commit**: YES
  - Message: `feat: implement TempletValue parser and formatter engine`
  - Files: `src/js/lib/templet-value.js`

- [ ] 5. 文件读写工具（Node.js fs + BOM处理）

  **What to do**:
  - 创建 `src/js/lib/file-io.js`
  - **改为Node.js fs模块**（通过preload.js的IPC桥接暴露给渲染进程）：
    - `readFileAsJson(filePath)` - 用fs.readFileSync读取，自动处理BOM，解析JSON
    - `writeJsonFile(filePath, data, withBOM)` - JSON.stringify + BOM处理 + fs.writeFileSync
    - `showOpenDialog(filters)` - 调用dialog.showOpenDialog选择文件
    - `showSaveDialog(defaultPath)` - 调用dialog.showSaveDialog选择保存位置
  - preload.js中暴露文件操作API：
    - `window.api.readFile(path)`
    - `window.api.writeFile(path, content)`
    - `window.api.openDialog(options)`
    - `window.api.saveDialog(options)`
  - BOM处理：CFG666写入时加`\uFEFF`前缀，DBC666不加

  **Must NOT do**:
  - 不使用浏览器File API（已有Node.js fs）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T15, T16
  - **Blocked By**: T1

  **References**:
  - Electron ipcMain/ipcRenderer + contextBridge
  - Electron dialog API

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 通过IPC读写文件
    Tool: Bash
    Steps:
      1. 启动Electron应用
      2. 在渲染进程调用window.api.writeFile(path, '{"test":1}', true)
      3. 用Node.js读取该文件，验证前3字节为EF BB BF（BOM）
      4. 调用window.api.readFile(path)，验证返回正确JSON
    Expected Result: IPC文件读写和BOM处理都正确
    Evidence: .sisyphus/evidence/task-5-file-io.txt
  ```

  **Commit**: YES
  - Message: `feat: add file I/O utilities with Node.js fs and BOM handling`
  - Files: `src/js/lib/file-io.js, preload.js（更新IPC API）`

- [ ] 6. 主界面布局（含脚本类型选择）

  **What to do**:
  - 在 `src/index.html` 和 `src/css/style.css` 中实现完整布局：
    - **新建脚本对话框**（启动时或点击"新建"时弹出）：
      - 三个选项卡片："OBC + DCDC" / "逆变" / "自由组合"
      - 选择后根据T3的模板自动创建预置测试项
    - **主界面**：
      - 顶部工具栏：项目名称输入、导入按钮（DBC666/CFG666）、导出按钮、新建/帮助按钮
      - 左侧面板（300px）：测试项列表
      - 右侧主区域：表单编辑区
      - 底部状态栏：当前脚本类型、文件状态

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T7-T14, T19
  - **Blocked By**: T1, T3

  **References**:
  - script-templates.js（T3）- 脚本类型模板定义

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 新建脚本时选择类型并预置测试项
    Tool: Playwright
    Steps:
      1. 启动应用，弹出新建脚本对话框
      2. 选择"OBC + DCDC"
      3. 验证左侧列表预置了OBC和DCDC相关的测试项
      4. 点击"新建" → 选择"逆变"
      5. 验证左侧列表预置了逆变相关测试项
      6. 点击"新建" → 选择"自由组合"
      7. 验证左侧列表为空
    Expected Result: 三种模式预置正确
    Evidence: .sisyphus/evidence/task-6-script-types.png
  ```

  **Commit**: YES
  - Message: `feat: build main UI layout with script type selection`
  - Files: `src/index.html, src/css/style.css, src/js/ui/layout.js, src/js/ui/new-script-dialog.js`

- [ ] 7. 测试项列表管理器（增删排序）

  **同原计划**，路径改为 `src/js/ui/test-item-manager.js`

  **Commit**: YES
  - Message: `feat: implement test item list manager with drag-and-drop`
  - Files: `src/js/ui/test-item-manager.js`

- [ ] 8. OBCDeviceConfig表单

  **同原计划**，路径改为 `src/js/forms/`

  **Commit**: YES (groups with T9-T11)
  - Files: `src/js/forms/obc-device-config.js`

- [ ] 9. InvertDeviceConfig + DCDCDeviceConfig表单

  **同原计划**，路径改为 `src/js/forms/`

  **Commit**: YES (groups with T8, T10, T11)
  - Files: `src/js/forms/invert-device-config.js, src/js/forms/dcdc-device-config.js`

- [ ] 10. ProductConfig表单（含FuncDesc子类型）

  **同原计划**，路径改为 `src/js/forms/`

  **Commit**: YES (groups with T8, T9, T11)
  - Files: `src/js/forms/product-config.js`

- [ ] 11. DelayConfig + PowerMeterAdvancedConfig表单

  **同原计划**，路径改为 `src/js/forms/`

  **Commit**: YES (groups with T8-T10)
  - Files: `src/js/forms/delay-config.js, src/js/forms/power-meter-config.js`

- [ ] 12. PowerResult表单（含min/max自动计算）

  **同原计划**，路径改为 `src/js/`

  **Commit**: YES
  - Files: `src/js/forms/power-result.js, src/js/lib/auto-calc.js`

- [ ] 13. GlobalVariable*系列表单（4种类型）

  **同原计划**，路径改为 `src/js/forms/`

  **Commit**: YES
  - Files: `src/js/forms/global-variable.js`

- [ ] 14. 原始TempletValue编辑器（fallback）

  **同原计划**，路径改为 `src/js/forms/`

  **Commit**: YES
  - Files: `src/js/forms/raw-editor.js`

- [ ] 15. 模板加载器（导入已有配置文件）

  **同原计划**，但文件读取改为通过 `window.api` IPC调用（T5）

  **Commit**: YES
  - Files: `src/js/lib/template-loader.js`

- [ ] 16. 文件导出管道（完整DBC666+CFG666生成）

  **What to do**:
  - 同原计划的核心逻辑
  - **改为Electron方式**：
    - 导出时调用 `window.api.saveDialog()` 选择保存位置（默认文件名含项目名+日期）
    - 通过 `window.api.writeFile()` 直接写入文件（无需浏览器下载）
    - CFG666带BOM，DBC666不带BOM
    - 成功后显示中文提示"文件已保存到 xxx"

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: T17, T18
  - **Blocked By**: T2, T3, T5, T8-T14

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 导出文件直接保存到磁盘
    Tool: Bash
    Steps:
      1. 在应用中创建测试项并填写参数
      2. 点击"导出CFG666"
      3. 在保存对话框中选择路径
      4. 验证文件已保存到指定路径
      5. 验证文件前3字节为EF BB BF（BOM）
      6. 验证JSON.parse成功
    Expected Result: 文件直接保存到磁盘，格式正确
    Evidence: .sisyphus/evidence/task-16-export-file.txt
  ```

  **Commit**: YES
  - Files: `src/js/lib/exporter.js`

- [ ] 17. 输入校验引擎 + 错误提示

  **同原计划**，路径改为 `src/js/lib/`

  **Commit**: YES
  - Files: `src/js/lib/validator.js`

- [ ] 18. 端到端验证（round-trip test）

  **同原计划**

  **Commit**: NO (纯测试任务)

- [ ] 19. UI打磨 + 可用性优化

  **同原计划**

  **Commit**: YES
  - Files: 多个UI文件

- [ ] 20. 使用说明 + Electron打包分发

  **What to do**:
  - 同原计划的中文使用说明
  - **Electron打包**：
    - 安装 `electron-builder`
    - 配置 `package.json` 的 build 字段：
      - appId: `com.fms-helper.app`
      - productName: `FMS Helper`
      - directories.output: `dist`
      - win.target: `portable`（免安装的portable exe）+ `nsis`（安装包）
      - file associations: `.dbc666` / `.cfg666`
    - 运行 `npm run build` 生成.exe
  - 分发方式：将 `dist/` 下的.exe放在共享目录，团队成员直接复制使用

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 打包生成可运行的.exe
    Tool: Bash
    Steps:
      1. 运行 npm run build
      2. 验证 dist/ 目录下生成了 .exe 文件
      3. 双击 .exe，验证应用正常启动
    Expected Result: 独立.exe可正常运行
    Evidence: .sisyphus/evidence/task-20-build-exe.txt
  ```

  **Commit**: YES
  - Message: `docs: add usage guide and configure Electron builder for .exe distribution`
  - Files: `src/js/ui/help.js, package.json（build配置）`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Review all JS files for: console.log in prod, commented-out code, unused variables, missing error handling. Verify: Electron security best practices (contextIsolation, no nodeIntegration). Chinese comments.
  Output: `Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Run `npm start`. Test EVERY QA scenario. Test script type selection (OBC+DCDC / Inverter / Custom). Round-trip with real files. Save evidence.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: verify 1:1 implementation vs spec. Check "Must NOT do" compliance. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **T1**: `feat: init Electron project skeleton` - main.js, preload.js, package.json, src/
- **T2-T3**: `feat: add DBC666 and CFG666 schema definitions with script templates` - src/js/schema/
- **T4**: `feat: implement TempletValue parser and formatter engine` - src/js/lib/templet-value.js
- **T5**: `feat: add file I/O utilities with Node.js fs and BOM handling` - src/js/lib/file-io.js
- **T6**: `feat: build main UI layout with script type selection` - src/index.html, src/css/, src/js/ui/
- **T7**: `feat: implement test item list manager` - src/js/ui/test-item-manager.js
- **T8-T11**: `feat: add core TempletType forms` - src/js/forms/
- **T12-T13**: `feat: add PowerResult and GlobalVariable forms` - src/js/forms/
- **T14**: `feat: add raw TempletValue editor` - src/js/forms/raw-editor.js
- **T15-T16**: `feat: implement template loader and file export pipeline` - src/js/lib/
- **T17-T19**: `feat: add validation, E2E verification, and UI polish` - src/js/
- **T20**: `docs: add usage guide and configure Electron builder` - package.json, src/js/ui/help.js

---

## Success Criteria

### Verification Commands
```bash
# 在项目目录下
cd "D:\脚本合集\Open code\fms-helper"

# 启动应用
npm start

# 打包
npm run build

# 检查生成的文件
node -e "JSON.parse(require('fs').readFileSync('test-output.cfg666','utf8').replace(/^\uFEFF/,'')); console.log('CFG666 OK')"
node -e "const b=Buffer.from(require('fs').readFileSync('test-output.cfg666')); console.log('CFG BOM:', b[0]===0xEF && b[1]===0xBB && b[2]===0xBF ? 'CORRECT' : 'MISSING')"
node -e "const b=Buffer.from(require('fs').readFileSync('test-output.dbc666')); console.log('DBC BOM:', b[0]===0x7B ? 'NONE (CORRECT)' : 'UNEXPECTED')"
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] 应用可打包为.exe，双击运行
- [ ] 新建时可选择脚本类型（OBC+DCDC / 逆变 / 自由组合）
- [ ] Generated DBC666 imports into Frame.ManagementSystem
- [ ] Generated CFG666 imports into Frame.ManagementSystem
- [ ] Chinese characters display correctly
- [ ] All 13 TempletTypes have form or raw editor
- [ ] Auto-calculation produces correct min/max
- [ ] Round-trip test passes
