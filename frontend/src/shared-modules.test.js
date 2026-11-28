// gameRules.js and bodyPhysics.js are CommonJS so the backend can require
// them (codexCatalog/codexPreview: tools/feedback requires or loads them). If the production Babel build injects helper imports into them,
// webpack treats them as ES modules and `module.exports` throws at startup.
const babel=require('@babel/core');
test.each(['gameRules','bodyPhysics','hazardGeometry','codexCatalog','codexPreview'])('%s needs no Babel helpers in production',name=>{
  const previous=[process.env.BABEL_ENV,process.env.BROWSERSLIST_ENV];process.env.BABEL_ENV=process.env.BROWSERSLIST_ENV='production';
  try {
    const {code}=babel.transformFileSync(require.resolve(`./${name}`),{presets:[require.resolve('babel-preset-react-app')],babelrc:false,configFile:false});
    expect(code).not.toMatch(/@babel\/runtime\/helpers/);
  } finally {[process.env.BABEL_ENV,process.env.BROWSERSLIST_ENV]=previous;}
});
