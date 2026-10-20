import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync(new URL('../../resources/js/lib/analytics-sections.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
const {pack,compatible,defaultSections,moveWidget,normalize,supportedSizes,resizePreset,ROW_HEIGHT,GRID_GAP}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
test('all supported footprints pack without overlap or crossing boundaries',()=>{
 for(const columns of [1,2,3]) for(let seed=0;seed<40;seed++){
  const widgets=Object.entries(supportedSizes).map(([id,sizes],i)=>({id,size:sizes[(seed+i)%sizes.length],order:i}));
  const result=pack(widgets,columns);const occupied=new Set();let previous=-1;
  assert.deepEqual(result,pack(widgets,columns));
  for(const c of result){assert.ok(c.x+c.w<=columns);assert.ok(c.y*columns+c.x>previous);previous=c.y*columns+c.x;
   for(let y=c.y;y<c.y+c.h;y++)for(let x=c.x;x<c.x+c.w;x++){const key=`${x},${y}`;assert.ok(!occupied.has(key));occupied.add(key);}
  }
 }
});
test('narrow conversion follows documented rule without changing saved desktop layout',()=>{
 const layout=defaultSections();const before=JSON.stringify(layout);layout.sections.forEach(s=>pack(s.widgets,1));assert.equal(JSON.stringify(layout),before);
 assert.equal(compatible('broadcast','wide',1),'small');assert.equal(compatible('age','large',1),'medium');assert.equal(compatible('categories','wide',1),'small');
});
test('cross section move keeps identities and order, changes only source and target',()=>{
 const layout=defaultSections();const next=moveWidget(layout,'age','publishing','broadcast');
 assert.deepEqual(next.sections[2].widgets.map(w=>w.id),['categories','age','broadcast']);
 assert.equal(next.sections.flatMap(s=>s.widgets).filter(w=>w.id==='age').length,1);
 assert.deepEqual(next.sections[4],layout.sections[4]);assert.equal(layout.sections[1].widgets[0].id,'age');
});
test('cancel snapshot and reset draft do not mutate saved layout',()=>{
 const saved=defaultSections();const snapshot=structuredClone(saved);const draft=moveWidget(saved,'age','publishing');
 draft.sections[0].title='Changed';assert.deepEqual(saved,snapshot);assert.notDeepEqual(draft,saved);
 assert.deepEqual(normalize(defaultSections()),saved);
});

test('all widgets share four presets and resize clamps at 2 by 2',()=>{
 for(const sizes of Object.values(supportedSizes)) assert.deepEqual([...sizes].sort(),['large','medium','small','wide']);
 for(const size of ['small','medium','wide','large']) {
  assert.equal(resizePreset(size,10000,10000,300,3),'large');
  assert.equal(resizePreset(size,-10000,-10000,300,3),'small');
  assert.equal(resizePreset(size,10000,10000,300,1),'medium');
 }
 assert.equal(ROW_HEIGHT,260); assert.equal(ROW_HEIGHT*2+GRID_GAP,536);
 assert.equal(resizePreset('small',100,100,300,2),'small');
 assert.equal(resizePreset('small',180,150,300,2),'large');
});
