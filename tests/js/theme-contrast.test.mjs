import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const css=fs.readFileSync('resources/css/app.css','utf8');
const palette=Object.fromEntries([...css.matchAll(/(--[\w-]+):\s*(#[\da-f]{6});/gi)].map(m=>[m[1],m[2]]));
const light=css.slice(css.indexOf('/* 2.'),css.indexOf('\n.dark,'));
const values={...palette,...Object.fromEntries([...light.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m=>[m[1],m[2]]))};
const resolve=k=>values[k]?.startsWith('var(')?resolve(values[k].slice(4,-1)):values[k];
const luminance=hex=>hex.slice(1).match(/../g).map(h=>parseInt(h,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
for(const [fg,bg,min] of [['primary-foreground','primary',4.5],['muted-foreground','background',4.5],['muted-foreground','surface-tertiary',4.5],['destructive-foreground','destructive',4.5],['input','field-background',3]]){
 test(`light ${fg} against ${bg} remains legible`,()=>assert.ok(contrast(resolve('--'+fg),resolve('--'+bg))>=min));
}
test('solid brand buttons support white text',()=>assert.ok(contrast(palette['--white'],palette['--brand-700'])>=4.5));
