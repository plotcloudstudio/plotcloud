import test from 'node:test';
import assert from 'node:assert/strict';
import {compareEvidence} from '../mvp/js/comparison-evidence.js';
import {buildComparisonReport, latestEngineRun, metricsCSV, pairedFieldData} from '../mvp/js/comparison-report-data.js';

const versions = [{id:'A',n:1,model:{}}, {id:'B',n:2,model:{}}];
const studies = [{id:'sunhours',name:'Sun hours',metrics:[['ground','Ground mean','h',2]]}];
function run(id, versionId, source, value, settings = {day:'03-21',step:15}) {
  return {
    id, versionId, simId:'sunhours', source,
    created:'2026-11-19T12:00:00Z', settings,
    results:{ground:value,field:{label:'Sun hours',unit:'h',step:1,pts:[0,0,value]}}
  };
}
function report(runs) {
  return buildComparisonReport({id:'project',name:'Workspace comparison',runs}, ...versions, studies);
}

test('saved Workspace runs enter the same report, maps and CSV as standalone and batch runs', () => {
  const a = run('rA','A','workspace',2);
  const b = run('rB','B','workspace',3.5);
  const section = report([a,b]).sections[0];
  assert.equal(section.a.id,'rA');
  assert.equal(section.b.id,'rB');
  assert.equal(section.evidence.status,'match');
  assert.equal(section.metrics[0].delta,1.5);
  assert.equal(pairedFieldData(section).max,3.5);
  assert.match(metricsCSV(report([a,b])),/rA.*rB/);
  assert.equal(compareEvidence(a,{...b,source:'full-tool'}).status,'match');
  assert.equal(compareEvidence(a,{...b,source:'batch'}).status,'match');
});

test('historical Workspace runs keep missing and differing input evidence explicit', () => {
  const a = run('rA','A','workspace',2,{});
  const b = run('rB','B','workspace',3,{});
  assert.equal(report([a,b]).sections[0].evidence.status,'unknown');
  a.settings = {day:'03-21',step:15};
  b.settings = {day:'06-21',step:15};
  assert.equal(report([a,b]).sections[0].evidence.status,'different');
});

test('a newer Workspace run is selected while illustrative and unknown sources remain excluded', () => {
  const old = run('old','A','full-tool',1);
  const current = {...run('current','A','workspace',2),created:'2026-11-19T13:00:00Z'};
  const previews = ['prototype-mock','illustrative','unrecognized'].map(source => ({
    ...run(source,'A',source,99),created:'2026-11-19T14:00:00Z'
  }));
  assert.equal(latestEngineRun({runs:[old,current,...previews]},'A','sunhours').id,'current');
  for (const preview of previews) {
    assert.equal(compareEvidence(current,preview).status,'unverified');
    assert.throws(()=>report([preview]),/actual engine/);
  }
});

test('a missing paired Workspace result produces a missing delta', () => {
  const section = report([run('rA','A','workspace',0)]).sections[0];
  assert.equal(section.evidence.status,'missing');
  assert.equal(section.metrics[0].a,0);
  assert.equal(section.metrics[0].b,null);
  assert.equal(section.metrics[0].delta,null);
});
