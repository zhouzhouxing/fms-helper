/**
 * 发布脚本：构建 + 上传到腾讯云COS
 *
 * 用法：
 *   1. 设置环境变量（密钥不写死在代码里，安全）
 *      PowerShell: $env:COS_SECRET_ID="你的ID"; $env:COS_SECRET_KEY="你的KEY"
 *   2. 运行：node publish.js
 *
 * 上传的3个文件：
 *   - FMS-Helper-x.x.x-Setup.exe     （安装包）
 *   - FMS-Helper-x.x.x-Setup.exe.blockmap （差分更新）
 *   - latest.yml                     （版本元数据）
 */

const COS = require('cos-nodejs-sdk-v5');
const path = require('path');
const fs = require('fs');

// ===== 配置 =====
var BUCKET = 'fms-helper-update-1303999607';
var REGION = 'ap-nanjing';

// 从环境变量读取密钥
var SECRET_ID = process.env.COS_SECRET_ID;
var SECRET_KEY = process.env.COS_SECRET_KEY;

if (!SECRET_ID || !SECRET_KEY) {
    console.error('❌ 请先设置环境变量 COS_SECRET_ID 和 COS_SECRET_KEY');
    console.error('   PowerShell: $env:COS_SECRET_ID="你的ID"; $env:COS_SECRET_KEY="你的KEY"');
    process.exit(1);
}

var cos = new COS({ SecretId: SECRET_ID, SecretKey: SECRET_KEY });
var distDir = path.join(__dirname, 'dist');

// 找到dist目录下的文件
function findFiles() {
    var files = fs.readdirSync(distDir);
    var result = {};

    for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (f.endsWith('-Setup.exe') && !f.includes('__uninstaller')) {
            result.exe = f;
        } else if (f.endsWith('-Setup.exe.blockmap')) {
            result.blockmap = f;
        } else if (f === 'latest.yml') {
            result.yml = f;
        }
    }

    return result;
}

// 上传单个文件
function uploadFile(key, filePath) {
    return new Promise(function (resolve, reject) {
        cos.putObject({
            Bucket: BUCKET,
            Region: REGION,
            Key: key,
            Body: fs.createReadStream(filePath)
        }, function (err, data) {
            if (err) reject(err);
            else resolve(data);
        });
    });
}

async function main() {
    console.log('=== FMS Helper 发布脚本 ===\n');

    // 检查dist目录
    if (!fs.existsSync(distDir)) {
        console.error('❌ dist目录不存在，请先运行 npm run build');
        process.exit(1);
    }

    var files = findFiles();
    console.log('找到文件:');
    console.log('  exe:', files.exe || '❌ 未找到');
    console.log('  blockmap:', files.blockmap || '❌ 未找到');
    console.log('  latest.yml:', files.yml || '❌ 未找到');
    console.log('');

    if (!files.exe || !files.yml) {
        console.error('❌ 必需文件缺失，无法发布');
        process.exit(1);
    }

    // 上传安装包
    console.log('1/3 上传安装包...');
    await uploadFile(files.exe, path.join(distDir, files.exe));
    console.log('   ✅ ' + files.exe);

    // 上传blockmap（差分更新用，可选）
    if (files.blockmap) {
        console.log('2/3 上传blockmap...');
        await uploadFile(files.blockmap, path.join(distDir, files.blockmap));
        console.log('   ✅ ' + files.blockmap);
    } else {
        console.log('2/3 blockmap 不存在，跳过');
    }

    // 最后上传latest.yml（原子更新：确保安装包先上传好）
    console.log('3/3 上传latest.yml...');
    await uploadFile('latest.yml', path.join(distDir, 'latest.yml'));
    console.log('   ✅ latest.yml');

    console.log('\n=== 发布完成！ ===');
    console.log('下载地址: https://' + BUCKET + '.cos.' + REGION + '.myqcloud.com/latest.yml');
}

main().catch(function (err) {
    console.error('❌ 发布失败:', err.message || err);
    process.exit(1);
});
