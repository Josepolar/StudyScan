import assert from 'node:assert/strict';
import { passages } from '../lib/learning.ts';
const electricity={title:'Ohm’s Law & Parallel Circuits',topic:'Electricity',content:'Ohm’s Law\nVoltage, current, and resistance are related by V = IR.\n\nParallel circuits\nEach branch connects across the same two source points.\n\nCurrent\nThe total current is the sum of branch currents.'};
let count=0;
for(const question of ['Explain Electricity in simpler terms.','What are the main ideas in Ohm’s Law & Parallel Circuits?','Help me understand this lesson.','Summarize this module.']) {
 const found=passages(electricity,question);assert.equal(found.length,3,question);assert.equal(found[0].text,electricity.content.split('\n\n')[0]);count++;
}
for(const question of ['Who won the presidential election?','Explain electricity and presidential elections.','What are the main ideas in the presidential election?','Explain Science in simpler terms.']) {
 assert.deepEqual(passages(electricity,question),[],question);count++;
}
const targeted=passages(electricity,'Why is the voltage the same in parallel circuits?');assert.ok(targeted.length>0);assert.match(targeted[0].text,/Parallel circuits/);count++;
const algebra={title:'Understanding Linear Equations',topic:'Algebra',content:'A linear equation has a variable with a power of one.\n\nUse inverse operations to isolate the variable.'};
assert.equal(passages(algebra,'Explain Algebra in simpler terms.').length,2);count++;
assert.deepEqual(passages({...electricity,content:''},'Explain Electricity in simpler terms.'),[]);count++;
assert.equal(passages({...electricity,content:'One\n\nTwo\n\nThree\n\nFour\n\nFive'},'Explain Electricity in simpler terms.').length,4);count++;
console.log(`${count} retrieval regression checks passed.`);
