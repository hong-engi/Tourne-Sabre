const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../src/enemyArt.js'), 'utf8');
const document = {
  createElement() {
    const pixels = [];
    return {pixels, getContext: () => ({
      fillStyle: '',
      fillRect(x, y) { pixels.push([x, y, this.fillStyle]); },
    })};
  },
};
const types = ['bomber', 'spitter', 'splitter', 'mite'];
const render = vm.runInNewContext(source.replace(/^export /gm, '') + '\ncreateEnemySprite;', {document});
process.stdout.write(JSON.stringify(Object.fromEntries(types.map(type => [type, render(type)]))));
