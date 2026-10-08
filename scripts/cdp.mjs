import WebSocket from 'ws';
const target = process.argv[2];
const expr = process.argv[3];
const shotPath = process.argv[4];
const ws = new WebSocket(target, {perMessageDeflate:false});
let id = 0; const pend = new Map();
const send = (method, params={}) => new Promise(res => {
  const i = ++id; pend.set(i, res);
  ws.send(JSON.stringify({id:i, method, params}));
});
ws.on('message', d => {
  const m = JSON.parse(d);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
});
ws.on('open', async () => {
  try {
    if (shotPath) { await send('Page.enable'); await send('Emulation.setDeviceMetricsOverride', {width:400, height:850, deviceScaleFactor:2, mobile:true}); const r = await send('Page.captureScreenshot', {format:'png'}); const b = Buffer.from(r.result.data, 'base64'); (await import('fs')).writeFileSync(shotPath, b); console.log('SHOT:'+shotPath+' '+b.length); }
    if (expr) { const r = await send('Runtime.evaluate', {expression: expr, awaitPromise: true, returnByValue: true}); console.log('EVAL:' + JSON.stringify(r.result.result && r.result.result.value !== undefined ? r.result.result.value : r.result)); }
    ws.close();
  } catch(e) { console.log('ERR:' + e.message); ws.close(); }
});
