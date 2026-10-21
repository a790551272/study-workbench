/*
 * 家长企微群推送脚本（命令行，绕过浏览器跨域限制）
 * 用法：
 *   node tools/wecom_push.js "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx" "小结内容（支持 markdown）"
 *   node tools/wecom_push.js                    # 读取 push.txt 后推送（webhook 写在 webhook.txt）
 * 说明：网页里点"复制小结"后，把内容保存成 push.txt，再运行本脚本即可真正推送到企微群。
 */
const https = require('https');

function send(webhook, content) {
  const body = JSON.stringify({ msgtype: 'markdown', markdown: { content } });
  const url = new URL(webhook);
  const req = https.request({
    hostname: url.hostname, path: url.pathname + url.search, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try {
        const j = JSON.parse(data);
        if (j.errcode === 0) console.log('✅ 推送成功');
        else console.log('❌ 推送失败：', data);
      } catch (e) { console.log('返回内容：', data); }
    });
  });
  req.on('error', e => console.log('❌ 网络错误：', e.message));
  req.write(body);
  req.end();
}

const fs = require('fs');
const args = process.argv.slice(2);
let webhook = args[0], content = args[1];
if (!webhook && fs.existsSync(__dirname + '/webhook.txt')) webhook = fs.readFileSync(__dirname + '/webhook.txt', 'utf8').trim();
if (!content && fs.existsSync(__dirname + '/push.txt')) content = fs.readFileSync(__dirname + '/push.txt', 'utf8');
if (!webhook || !content) {
  console.log('用法：node tools/wecom_push.js <webhook地址> <小结内容>');
  console.log('或者：把 webhook 地址存到 tools/webhook.txt，把小结存到 tools/push.txt，然后直接运行 node tools/wecom_push.js');
  process.exit(1);
}
send(webhook, content);
