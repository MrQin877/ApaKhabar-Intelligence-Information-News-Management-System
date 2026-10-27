import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';
const source=readFileSync(new URL('../../resources/js/lib/analytics-chart-data.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {groupMetrics,notificationReadRate}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
test('Meta metrics remain separate and preserve dates, zero observations and gaps',()=>{
 const rows=[{label:'2026-10-20 · Reach',value:0},{label:'2026-10-18 · Views',value:90},{label:'2026-10-18 · Reach',value:12}];
 const original=structuredClone(rows);const result=groupMetrics(rows);
 assert.deepEqual(result,[{metric:'Reach',rows:[{label:'2026-10-18',value:12},{label:'2026-10-20',value:0}]},{metric:'Views',rows:[{label:'2026-10-18',value:90}]}]);assert.deepEqual(rows,original);
});
test('empty and single Meta observations are not fabricated',()=>{assert.deepEqual(groupMetrics([]),[]);assert.equal(groupMetrics([{label:'2026-10-20 · Reach',value:4}])[0].rows.length,1);});
test('read rate has an explicit recorded-notification denominator',()=>{assert.equal(notificationReadRate(75,100),75);assert.equal(notificationReadRate(0,100),0);assert.equal(notificationReadRate(0,0),null);});
