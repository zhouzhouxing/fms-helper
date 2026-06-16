/**
 * 源码恢复脚本（打包后自动执行）
 *
 * 把 .src-backup 恢复回 src/js，确保源码回到明文状态
 */

const fs = require('fs');
const path = require('path');

var SRC_DIR = path.join(__dirname, '..', 'src', 'js');
var BACKUP_DIR = path.join(__dirname, '..', '.src-backup');

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

function removeDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

console.log('=== 恢复源码 ===');

if (!fs.existsSync(BACKUP_DIR)) {
    console.log('⚠ .src-backup 不存在，无需恢复');
    process.exit(0);
}

// 恢复
copyDir(BACKUP_DIR, SRC_DIR);
removeDir(BACKUP_DIR);
console.log('✅ 源码已恢复到明文状态');
