(function(root){
function create(user,members){if(!user)return [];const others=members.filter(m=>m.active!==false&&m.name!==user.name),names=others.map(m=>m.name),from=names[0]||user.name,design=others.find(m=>m.team==='디자인')?.name||from,content=others.find(m=>m.team==='콘텐츠')?.name||from,now=Date.now(),day=86400000;
const event=(id,from,to,title,body,ago,parentId='')=>({version:1,id:'sample-request-'+id,rootId:'sample-request-'+(parentId?'1':id),parentId:parentId?'sample-request-'+parentId:'',from,to,title,body,createdAt:now-ago,sample:true});
const rows=[event('1',from,[user.name],'[샘플] 메인 배너 디자인 검토 요청','새 메인 배너 시안을 확인해 주세요.\n\n• 제목과 버튼 정렬 확인\n• 모바일에서 이미지 잘림 확인\n• 검토 의견은 전달 시 추가 내용에 남겨 주세요.',day*3),event('2',user.name,[design],'[샘플] 메인 배너 디자인 검토 요청','퍼블리싱 검토를 마쳤습니다. 디자인팀에서 색상과 여백을 최종 확인해 주세요.',day*2,'1'),event('3',design,[user.name,from],'[샘플] 메인 배너 디자인 검토 요청','버튼 여백 16px, 제목 굵기 700으로 조정 부탁드립니다. 첨부할 추가 의견은 없습니다.',day,'2'),event('4',content,[user.name],'[샘플] 11월 콘텐츠 문구 반영','전달드린 콘텐츠 문구를 이번 주 페이지에 반영해 주세요. 최종 확인은 목요일 오후까지 부탁드립니다.',day/2),event('5',user.name,[design,content],'[샘플] 오픈 전 공동 확인','담당 파트별로 링크와 문구를 확인해 주세요. 디자인과 콘텐츠 담당자에게 함께 요청드립니다.',day/3),event('6',from,[user.name],'[샘플] 접근성 확인 요청','키보드로 메뉴와 팝업을 사용할 수 있는지 확인 부탁드립니다.',day/5)];
const planner=from,publisher=user.name;
const chain=[
 [planner,[design],'작업 요청','기획 작업을 마쳤습니다. 디자인 작업 부탁드립니다.'],
 [design,[planner],'확인 요청','디자인 중 안내 문구의 조건을 확인하고 싶습니다.'],
 [planner,[design],'수정 전달','안내 조건을 정리했습니다. 수정된 기획 내용으로 진행해 주세요.'],
 [design,[publisher],'작업 요청','디자인을 완료했습니다. 퍼블리싱 부탁드립니다.'],
 [publisher,[planner,design],'확인 요청','모바일 오류 안내의 노출 조건과 간격을 각각 확인해 주세요.'],
 [planner,[publisher],'수정 전달','기획 조건을 수정했습니다. 입력 실패 시에만 표시합니다.'],
 [design,[publisher],'수정 전달','디자인 간격을 16px로 정리했습니다.'],
 [publisher,[planner,design],'확인 요청','작업을 마쳤습니다. 로컬 확인 URL에서 최종 검토 부탁드립니다.'],
 [planner,[publisher],'확인 완료','기획 검토 완료. 추가 수정사항 없습니다.'],
 [design,[publisher],'확인 완료','디자인 검토 완료. 추가 수정사항 없습니다.'],
 [publisher,[planner,design],'고객 전달','최종 검토를 마쳐 고객에게 파일을 전달했습니다.']];
chain.forEach(([sender,to,type,body],i)=>rows.push({...event('flow-'+i,sender,to,'[샘플] 신청서 개선 · 기획 → 디자인 → 퍼블',body,day*(12-i)/4),rootId:'sample-request-flow-0',parentId:i?'sample-request-flow-'+(i===6?4:i===9?7:i-1):'',type,url:i===7?'http://localhost:49271/source/html/index.html':''}));return rows;}

if(typeof module!=='undefined')module.exports={create};else root.BoardRequestSamples={create};
})(typeof window!=='undefined'?window:globalThis);
