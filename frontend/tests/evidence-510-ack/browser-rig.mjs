import http from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root = new URL('../../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const port = Number(process.env.PORT || 45183);
http.createServer((req, res) => {
  if (req.url === '/favicon.ico') {res.writeHead(204); return res.end();}
  if (req.url.startsWith('/asset/')) {
    const files = {vue:'vue/dist/vue.global.js', i18n:'vue-i18n/dist/vue-i18n.global.js', bootstrap:'bootstrap/dist/js/bootstrap.js'};
    const file = files[req.url.slice(7)];
    if (!file) {res.writeHead(404); return res.end();}
    res.setHeader('Content-Type', 'text/javascript');
    return res.end(read('frontend/node_modules/' + file));
  }
  const source = process.env.STUDY_MODAL_SOURCE ? readFileSync(process.env.STUDY_MODAL_SOURCE,'utf8') : read('frontend/src/components/study/StudyModal.vue');
  const sources = {'components/study/StudyModal.vue':source,'basic/Modal.vue':read('frontend/src/basic/Modal.vue')};
  let script = read('frontend/tests/study-start-ack.test.js');
  script = script.replace(/^import .*\r?\n/gm, '');
  script = script.replace(/const window = new Window\(\)[\s\S]*?const MESSAGES =/, `const {compile, createApp, h, nextTick} = Vue; const {createI18n} = VueI18n; const BootstrapModal = bootstrap.Modal; const MESSAGES =`);
  script = script.replace(/const source = readFileSync\([^\n]+/, 'const source = sources[path]');
  const prefix = `const sources=${JSON.stringify(sources).replaceAll('<', '\u003c')}; const tests=[]; const cleanup=[]; const test=(name,fn)=>tests.push({name,fn}); const afterEach=fn=>cleanup.push(fn); const wait=ms=>new Promise(r=>setTimeout(r,ms)); const assert={equal(a,b,msg){if(a!==b)throw Error(msg||String(a)+' !== '+String(b))},deepEqual(a,b,msg){if(JSON.stringify(a)!==JSON.stringify(b))throw Error(msg||JSON.stringify(a)+' !== '+JSON.stringify(b))},ok(a,msg){if(!a)throw Error(msg||'assertion failed')},fail(msg){throw Error(msg)}}; window.results=[]; window.pageErrors=[]; window.addEventListener('error',e=>window.pageErrors.push(String(e.error)));`;
  const suffix = `for(const {name,fn} of tests){try{await fn();results.push({name,pass:true})}catch(e){results.push({name,pass:false,error:String(e),stack:e.stack})}finally{for(const fn of cleanup)await fn()}} const pre=document.createElement('pre');pre.textContent=JSON.stringify({results,pageErrors},null,2);document.body.append(pre); window.done=true;`;
  if(req.url === '/run.js'){res.setHeader('Content-Type','text/javascript');return res.end(prefix+script+suffix);} res.setHeader('Content-Type','text/html');
  res.end(`<html><body><pre id="results">Running isolated component cases, not the full participant route</pre><script src="/asset/vue"></script><script src="/asset/i18n"></script><script src="/asset/bootstrap"></script><script type="module" src="/run.js"></script></body></html>`);
}).listen(port,'127.0.0.1',()=>console.log('Isolated browser component rig: http://127.0.0.1:'+port));



