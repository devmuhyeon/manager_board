const test=require('node:test'),assert=require('node:assert/strict');
const C=require('./core-fixture.cjs'),P=require('./people-fixture.cjs'),Preview=require('./preview-data.js');
test('검토용 샘플은 독립된 자료로 모든 업무 단계와 게시판·메모·휴가를 채운다',()=>{
 const s=Preview.create(C,P),next=Preview.create(C,P);
 assert.equal(Object.keys(s.accounts).length,0);
 assert.equal(new Set(s.members.map(member=>member.avatar)).size,s.members.length);
 assert.equal(new Set(s.teamPosts.map(post=>post.author)).size,s.members.length);
 const workflow=s.projects.filter(project=>project.workflowFixture);
 assert.equal(workflow.length,12);
 assert.ok(workflow.every(project=>project.raw&&project.id==='source:'+project.raw.id));
 assert.ok(new Set(workflow.map(project=>C.effective(project).status)).size>=6);
 assert.equal(s.teamPosts.filter(post=>post.type!=='일반글').length,3);assert.equal(s.teamPosts.filter(post=>post.type==='일반글').length,12);assert.ok(s.leaves.length);assert.equal(s.personal['김무현'].length,12);
 s.projects[0].title='수정';assert.notEqual(s.projects[0].title,next.projects[0].title);
 assert.ok(P.schedule(s,'김무현',P.weekRanges()[0]).some(row=>row.projectId));
 assert.doesNotThrow(()=>C.validateState(s));
});
