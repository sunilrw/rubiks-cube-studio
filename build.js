/* Builds one self-contained index.html: node build.js */
const fs = require('fs'), path = require('path');
const R = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const order = ['puzzle', 'themes', 'fx', 'scene', 'input', 'coach3', 'coach', 'store', 'hand', 'app'];
const guard = (name, s) => { if (/<\/script/i.test(s)) throw new Error(name + ' contains </script'); return s; };
let js = order.map((n) => guard(n, R('src/' + n + '.js'))).join('\n;\n');
let html = R('src/index.template.html');
const put = (key, val) => { html = html.split(key).join('\u0000' + key + '\u0000').replace('\u0000' + key + '\u0000', () => val).split('\u0000' + key + '\u0000').join(key); };
put('/*__CSS__*/', R('src/style.css'));
put('/*__CUBEJS__*/', guard('cubejs', R('vendor/cubejs.js')));
put('/*__THREE__*/', guard('three', R('vendor/three.min.js')));
put('/*__JS__*/', js);
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html', (html.length / 1024).toFixed(0) + ' KB');
