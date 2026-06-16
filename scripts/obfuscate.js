/**
 * 代码混淆脚本
 *
 * 流程：
 *   1. 备份 src/js 到 .src-backup
 *   2. 混淆 src/js 下所有 .js 文件（原地覆盖）
 *   3. 打包由 electron-builder 完成
 *   4. 打包后由 restore-src.js 恢复原始源码
 *
 * 混淆强度：中等（平衡保护强度和性能）
 *   - 变量名混淆（改为无意义短名）
 *   - 字符串不加密（避免性能问题）
 *   - 控制流平坦化（适度）
 *   - 注释全部删除
 */

const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

var SRC_DIR = path.join(__dirname, '..', 'src', 'js');
var BACKUP_DIR = path.join(__dirname, '..', '.src-backup');

// 遍历目录下所有.js文件
function walkDir(dir, callback) {
    var items = fs.readdirSync(dir);
    for (var i = 0; i < items.length; i++) {
        var fullPath = path.join(dir, items[i]);
        var stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walkDir(fullPath, callback);
        } else if (items[i].endsWith('.js')) {
            callback(fullPath);
        }
    }
}

// 复制目录（递归）
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    var items = fs.readdirSync(src);
    for (var i = 0; i < items.length; i++) {
        var srcPath = path.join(src, items[i]);
        var destPath = path.join(dest, items[i]);
        var stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// 删除目录（递归）
function removeDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

// 混淆单个JS文件
function obfuscateFile(filePath) {
    var code = fs.readFileSync(filePath, 'utf8');

    // 跳过空文件或过小的文件
    if (code.trim().length < 10) return false;

    try {
        var result = JavaScriptObfuscator.obfuscate(code, {
            compact: true,
            commentOutput: false,
            // 变量名混淆
            identifierNamesGenerator: 'hexadecimal',
            renameGlobals: false,
            // 保留ES Module语法（import/export）
            sourceMap: false,
            sourceMapMode: 'separate',
            // 字符串不加密（避免性能问题）
            stringArray: false,
            // 控制流平坦化（适度）
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.5,
            // 不混淆顶层声明（避免import问题）
            renameVariables: true,
            // 保留特定标识符
            reservedNames: [
                'require', 'module', 'exports', 'process',
                'window', 'document', 'console', 'localStorage',
                'ipcRenderer', 'ipcMain', 'contextBridge',
                'app', 'BrowserWindow', 'dialog'
            ],
            // 不转换字符串为Unicode（避免中文乱码）
            unicodeEscapeSequence: false,
            // 自我保护（防止格式化）
            selfDefending: false,
            // 禁用console
            disableConsoleOutput: false
        });

        fs.writeFileSync(filePath, result.getObfuscatedCode(), 'utf8');
        return true;
    } catch (e) {
        console.warn('  ⚠ 混淆失败 ' + filePath + ': ' + e.message);
        return false;
    }
}

// ===== 主流程 =====
console.log('=== 代码混淆 ===\n');

// 1. 备份
console.log('1. 备份原始源码到 .src-backup...');
removeDir(BACKUP_DIR);
copyDir(SRC_DIR, BACKUP_DIR);
console.log('   ✅ 备份完成\n');

// 2. 混淆
console.log('2. 混淆 src/js 下的所有JS文件...');
var count = 0;
var failed = 0;
walkDir(SRC_DIR, function (filePath) {
    if (obfuscateFile(filePath)) {
        count++;
    } else {
        failed++;
    }
});
console.log('   ✅ 混淆完成：' + count + '个文件成功' + (failed > 0 ? '，' + failed + '个跳过' : '') + '\n');

// 3. 清理dist
console.log('3. 清理旧构建...');
var distDir = path.join(__dirname, '..', 'dist');
removeDir(distDir);
console.log('   ✅ 清理完成\n');

console.log('=== 混淆准备完成，开始打包 ===\n');
