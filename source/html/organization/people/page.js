(function(root){
 'use strict';
  function organizationChart(context,members){
    const {state,P,O,Icons,esc,button,member,scope,readOrganization}=context;
    const chart=readOrganization(),groups=O.forest(chart,members);
    const columns=chart.levels.map((level,index)=>'<th scope="col"><div class="people-cell-actions">'+esc(level)+
      button('orgLevel',Icons.arrow('edit'),'people-icon-button','data-index="'+index+'" aria-label="'+esc(level)+' 레벨 이름 편집"')+'</div></th>').join('');
    function branchRows(node,level,index,siblings){
      const rows=node.children.flatMap((child,i)=>branchRows(child,level+1,i,node.children));
      if(!rows.length)rows.push(level+1<chart.levels.length?'<td colspan="'+(chart.levels.length-level-1)+'"></td>':'');
      const title=node.person&&node.name!==node.person.name?node.name+' · '+node.person.name:node.name;
      const move=(step,direction,label,disabled)=>button('orgMove',Icons.arrow(direction),'people-icon-button',
        'data-id="'+esc(node.id)+'" data-step="'+step+'" aria-label="'+esc(title+' '+label)+'" title="'+label+'" '+(disabled?'disabled':''));
      const actions='<div class="people-row-actions">'+
        (siblings.length>1?move(-1,'up','위로 이동',index===0)+move(1,'down','아래로 이동',index===siblings.length-1):'')+
        button('orgAdd','＋','people-icon-button','data-parent="'+esc(node.id)+'" aria-label="'+esc(node.name)+' 하위 항목 추가"')+
        button('orgEdit',Icons.arrow('edit'),'people-icon-button','data-id="'+esc(node.id)+'" aria-label="'+esc(node.name)+' 편집"')+'</div>';
      const name='<strong>'+esc(title)+'</strong>';
      const label=node.person?'<div class="people-org-member">'+name+
        (node.person.rank?'<span class="muted">'+esc(node.person.rank)+'</span>':'')+
        (P.isOverallAdmin(state,node.person.name)?'<span class="badge">관리자</span>':'')+'</div>':name;
      rows[0]='<td class="people-org-group" rowspan="'+rows.length+'"><div class="people-cell-actions">'+label+actions+'</div></td>'+rows[0];
      return rows;
    }
    const rows=groups.flatMap((node,index)=>branchRows(node,0,index,groups)).map(row=>'<tr>'+row+'</tr>').join('');
    const toolbar='<div class="actions">'+button('orgAdd','＋ 조직도 항목 추가')+
      button('orgInsertLevel','＋ 레벨 추가')+'</div>';
    return '<div class="card table-wrap people-sheet people-org-sheet"><table><caption class="sr-only">조직도</caption><thead><tr>'+
      columns+'</tr></thead><tbody>'+(rows||'<tr><td colspan="'+chart.levels.length+'" class="muted">등록된 조직도 항목이 없습니다.</td></tr>')+'</tbody></table></div><div class="people-org-footer">'+toolbar+'</div>';
  }
  function peopleRoles(context,members){
    const {state,P,Icons,esc,button,scope}=context;
    const admins=members.filter(m=>P.isOverallAdmin(state,m.name)).map(m=>esc(m.name));
    const ranks=P.ranks(state);
    const controls=(rank,index)=>[
      ['rankUp','up','위로 이동',index===0],['rankDown','down','아래로 이동',index===ranks.length-1],
      ['rankEdit','edit','편집',false],['rankDelete','trash','삭제',false]
    ].map(([action,icon,label,disabled])=>button(action,Icons.arrow(icon),'people-icon-button'+(action==='rankDelete'?' danger':''),
      'data-rank="'+esc(rank)+'" aria-label="'+esc(rank)+' '+label+'" title="'+label+'" '+(disabled?'disabled':''))).join('');
    return '<div class="card table-wrap people-sheet people-rank-sheet"><table><caption class="sr-only">직책과 정렬 순서</caption><thead><tr><th scope="col" colspan="2"><div class="people-cell-actions"><span>직책명</span>'+
      button('rankAdd',Icons.arrow('settings'),'people-icon-button','aria-label="신규 직책 설정" title="신규 직책 추가"')+'</div></th></tr></thead><tbody>'+
      ranks.map((rank,index)=>'<tr><td>'+esc(rank)+'</td><td><div class="people-row-actions">'+controls(rank,index)+'</div></td></tr>').join('')+
      (!ranks.length?'<tr><td colspan="2" class="muted">등록된 직책이 없습니다.</td></tr>':'')+'</tbody></table>'+
      '</div>'+
      '<section class="card people-admin-panel"><div class="sectionhead"><h2>관리자 지정</h2><div class="actions">'+
      button('adminSettings',Icons.arrow('settings'),'people-icon-button','aria-label="관리자 등록·해제 설정" title="관리자 설정"')+'</div></div><dl class="people-role-list">'+
      '<div><dt>WorkLog 관리자</dt><dd>'+(admins.join(', ')||'미지정')+'</dd></div>'+
      '</dl></section>';
  }
  function personnelPanel(context,members){
    const {user,N,esc,button,scope}=context;
    const rows=members.map(m=>{
      const attrs='data-name="'+esc(m.name)+'"';
      const status=m.active===false?'퇴사 · '+(m.retention==='purge'?'개인 자료 삭제':'자료 보관'):'재직';
      const actions='<td><div class="actions">'+button('editMemberRank','수정','',attrs)+
        (m.active===false?button('rehire','재입사','',attrs):button('removeMember','퇴사 처리','danger',
          attrs+(m.name===user.name?' disabled title="본인의 퇴사 처리는 다른 관리자가 진행해 주세요."':'')))+'</div></td>';
      return '<tr><td>'+esc(N.teamLabel(m.team))+'</td><td>'+esc(m.name)+(m.name===user.name?' (본인)':'')+
        '</td><td>'+esc(m.rank||'미지정')+'</td><td>'+esc(m.birthday?m.birthday.slice(5):'미설정')+'</td><td>'+status+'</td>'+actions+'</tr>';
    }).join('');
    const retired=members.filter(m=>m.active===false).length;
    const toolbar='<div class="actions">'+button('passwords','개별 비밀번호 초기화')+
      button('addMember','＋ 인원 추가','primary')+'</div>';
    return '<section class="card people-admin-panel"><div class="sectionhead"><div><h2>입사·퇴사 인원 관리</h2>'+
      '<p class="muted">재직 '+(members.length-retired)+'명 · 퇴사 '+retired+'명</p></div>'+toolbar+
      '</div><div class="table-wrap people-sheet"><table><caption class="sr-only">등록 인원과 재직 상태</caption><thead><tr>'+
      '<th scope="col">팀</th><th scope="col">이름</th><th scope="col">직급</th><th scope="col">생일</th><th scope="col">상태</th>'+
      '<th scope="col">관리</th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
  }
  function peoplePage(context){
    const {state,user,P,W,button,activeMembers,peopleSection,peopleSections,organizationChart,peopleRoles,personnelPanel}=context;
    if(!W.canPersonnel(state,user.name))return '';
    const tabs=Object.entries(peopleSections).map(([section,label])=>button('peopleSection',label,peopleSection===section?'active':'',
      'data-section="'+section+'" aria-pressed="'+(peopleSection===section)+'" aria-controls="peopleSectionContent"')).join('');
    const members=activeMembers();
    const content=peopleSection==='org'?organizationChart(members):peopleSection==='roles'?peopleRoles(members):personnelPanel(P.orderedMembers(state));
    return '<div class="card people-management"><div class="tabs people-tabs" role="group" aria-label="인원관리">'+tabs+
      '</div><section class="people-section" id="peopleSectionContent" aria-label="'+peopleSections[peopleSection]+'">'+content+'</section></div>';
  }
  function rankEditor(context,rank){
    const {state,P,esc,button,showDialog}=context;
    if(rank&&!P.ranks(state).includes(rank))return;
    showDialog('<div class="modal-head"><h2>'+(rank?'직책명 편집':'신규 직책 추가')+'</h2>'+button('close','닫기')+'</div><form id="rankOrderForm">'+
      '<div class="modal-body"><input name="old" type="hidden" value="'+esc(rank)+'"><div class="field"><label for="peopleRankName">직책명</label>'+
      '<input id="peopleRankName" name="name" value="'+esc(rank)+'" maxlength="30" required></div><p id="rankOrderError" class="error" role="alert"></p></div>'+
      '<div class="modal-foot">'+button('close','취소')+'<button class="primary">저장</button></div></form>');
  }
  function organizationEditor(context,id,parent){
    const {O,esc,button,options,member,activeMembers,showDialog,readOrganization}=context;
    const chart=readOrganization(),node=chart.nodes.find(item=>item.id===id);
    if(id&&!node)return;
    const blocked=node?O.descendants(chart,node.id):new Set();
    const nodes=new Map(chart.nodes.map(item=>[item.id,item]));
    const parents='<option value="">최상위</option>'+O.forest(chart,activeMembers()).flatMap(function paths(item){
      if(blocked.has(item.id))return [];
      const path=[item.name];
      for(let key=item.parent;key!==null;key=nodes.get(key).parent)path.unshift(nodes.get(key).name);
      return ['<option value="'+esc(item.id)+'" '+(item.id===(node?node.parent:parent)?'selected':'')+'>'+esc(path.join(' / '))+'</option>',
        ...item.children.flatMap(paths)];
    }).join('');
    const linked=new Set(chart.nodes.map(item=>item.member));
    const available=activeMembers().filter(person=>!linked.has(person.name)).map(person=>person.name);
    const memberField=!node&&available.length?'<div class="field"><label for="orgMember">멤버 연결 (선택)</label><select name="member" id="orgMember">'+
      options(available,'','연결 안 함')+'</select></div>':'';
    const attrs=node?'data-id="'+esc(id)+'"':'';
    showDialog('<div class="modal-head"><h2>'+(node?'조직도 항목 편집':'조직도 항목 추가')+'</h2>'+button('close','닫기')+'</div>'+
      '<form id="organizationForm"><div class="modal-body"><input type="hidden" name="id" value="'+esc(id)+'">'+
      '<div class="field"><label for="orgName">항목 이름</label><input id="orgName" name="name" value="'+esc(node?.name)+'" maxlength="80" required></div>'+
      '<div class="field"><label for="orgParent">상위 항목</label><select id="orgParent" name="parent">'+parents+'</select></div>'+memberField+
      '<p class="error" id="organizationError" role="alert"></p></div><div class="modal-foot">'+
      (node?button('orgDelete','삭제','danger',attrs):'')+button('close','취소')+'<button class="primary">저장</button></div></form>');
  }
  function organizationLevelEditor(context,index){
    const {esc,button,showDialog,readOrganization}=context;
    const chart=readOrganization();
    const exists=Number.isInteger(index)&&index>=0&&index<chart.levels.length;
    const positions=chart.levels.map((label,i)=>'<option value="'+i+'" '+(i===1?'selected':'')+'>'+(i+1)+'레벨 · '+esc(label)+' 위에 삽입</option>').join('')+
      '<option value="'+chart.levels.length+'">'+(chart.levels.length+1)+'레벨 · 마지막에 추가</option>';
    showDialog('<div class="modal-head"><h2>'+(exists?'레벨 이름 편집':'레벨 추가')+'</h2>'+button('close','닫기')+'</div>'+
      '<form id="organizationLevelForm"><div class="modal-body"><input type="hidden" name="mode" value="'+(exists?'rename':'insert')+'">'+
      (exists?'<input type="hidden" name="index" value="'+index+'">':'<div class="field"><label for="orgLevelPosition">추가 위치</label><select name="index" id="orgLevelPosition">'+positions+'</select></div>')+
      '<div class="field"><label for="orgLevelName">레벨 이름</label><input id="orgLevelName" name="name" value="'+esc(exists?chart.levels[index]:'')+
      '" maxlength="80" required placeholder="예: 부서"></div>'+
      (exists?'':'<div class="field"><label for="orgLevelContent">추가할 항목 내용</label><input id="orgLevelContent" name="content" maxlength="80" required placeholder="예: UI·UX 사업부"></div><p class="muted">선택한 위치에 상위 항목이 생기고 기존 항목과 하위 조직은 한 레벨씩 이동합니다. 상위 조직이 여러 개면 각각 추가됩니다.</p>')+
      '<p class="error" id="organizationError" role="alert"></p></div>'+
      '<div class="modal-foot">'+button('close','취소')+'<button class="primary">저장</button></div></form>');
  }
  function editMemberRankDialog(context,name){
    const {state,P,N,esc,button,options,member,showDialog,BoardLeavePolicy}=context;
    const person=member(name);if(!person)throw new Error('인원을 찾을 수 없습니다.');
    showDialog('<div class="modal-head"><h2>멤버 정보 수정</h2>'+button('close','닫기')+'</div><form id="memberRankForm"><div class="modal-body"><p>'+esc(N.teamLabel(person.team))+' · '+esc(person.name)+'</p><input type="hidden" name="name" value="'+esc(person.name)+'"><div class="field"><label for="existingMemberRank">직급</label><input id="existingMemberRank" name="rank" maxlength="30" value="'+esc(person.rank||'')+'"></div><label class="field">팀<select name="team">'+options(P.orderedTeams(state),person.team)+'</select></label><label class="field">입사일<input type="date" name="hireDate" value="'+esc(BoardLeavePolicy.read(state).hires[person.name]||person.hireDate||'')+'"></label><label class="field">생일<input type="date" name="birthday" value="'+esc(person.birthday||'')+'"></label><div id="memberRankError" class="error" role="alert"></div></div><div class="modal-foot">'+button('close','취소')+'<button class="primary">직급 저장</button></div></form>');
  }
  function addMemberDialog(context,name=''){
    const {state,P,esc,button,options,member,showDialog}=context;const old=member(name);showDialog(`<div class="modal-head"><h2>${old?'재입사 등록':'인원 추가'}</h2>${button('close','닫기')}</div><form id="memberForm"><div class="modal-body"><div class="field"><label for="memberTeam">팀</label><select id="memberTeam" name="team">${options(P.orderedTeams(state),old?.team||'기획')}</select></div><div class="field"><label for="memberName">이름</label><input id="memberName" name="name" value="${esc(name)}" required maxlength="40" ${old?'readonly':''}></div><div class="field"><label for="memberRank">직급</label><input id="memberRank" name="rank" maxlength="30" value="${esc(old?.rank||'')}"></div><label class="field">입사일<input name="hireDate" type="date" value="${esc(old?.hireDate||'')}"></label><label class="field">생일<input name="birthday" type="date" value="${esc(old?.birthday||'')}"></label><p class="muted">추가한 인원은 최초 로그인 시 본인의 비밀번호를 설정합니다.</p><div id="memberError" class="error" role="alert"></div></div><div class="modal-foot">${button('close','취소')}<button class="primary">${old?'재입사 등록':'인원 추가'}</button></div></form>`);}
  function removeMemberDialog(context,name){
    const {state,P,esc,button,options,showDialog,projects}=context;const impact=P.removalImpact(state,name);showDialog(`<div class="modal-head"><h2>${esc(name)}님 퇴사 처리</h2>${button('close','닫기')}</div><form id="removeMemberForm"><input name="name" type="hidden" value="${esc(name)}"><div class="modal-body"><p>담당 과업 ${impact.projects}개 · 담당 업무 ${impact.tasks}개 · 작업 내역 ${impact.logs}개 · 개인 메모 ${impact.personal}개</p><fieldset class="retention-options"><legend>기존 자료 처리 방법</legend><label><input type="radio" name="retention" value="keep" checked><span><strong>자료 남기기</strong><small>업무·작업 내역·개인 메모를 보관합니다. 로그인과 신규 담당자 선택에서만 제외합니다.</small></span></label><label><input type="radio" name="retention" value="purge"><span><strong>개인 관련 자료 제거</strong><small>담당 배정, 단독 담당 업무·과업, 작성한 작업 내역과 개인 메모를 제거합니다. 공동 과업과 다른 담당자의 자료는 남깁니다. 원본 파일과 원본에서 가져온 자유 형식 설명·원문 사본은 변경하지 않습니다.</small></span></label></fieldset><label class="remember-check"><input type="checkbox" name="acknowledge" required> 선택한 처리 방식을 확인했습니다.</label><p class="muted">퇴사 계정의 비밀번호 해시는 두 방식 모두 제거됩니다. 자료 제거는 저장 후 되돌릴 수 없으므로 필요한 경우 JSON 백업을 먼저 받으세요.</p>${button('backup','현재 자료 JSON 백업')}<div id="removeError" class="error" role="alert"></div></div><div class="modal-foot">${button('close','취소')}<button class="primary">퇴사 처리 적용</button></div></form>`);}
  function adminSettings(context){
    const {state,P,N,esc,button,activeMembers,showDialog}=context;
    const choices=activeMembers().map(person=>'<label class="remember-check"><input type="checkbox" name="admins" value="'+esc(person.name)+'" '+
      (P.isOverallAdmin(state,person.name)?'checked':'')+'> '+esc(N.teamLabel(person.team))+' · '+esc(person.name)+'</label>').join('');
    showDialog('<div class="modal-head"><h2>WorkLog 관리자 등록·해제</h2>'+button('close','닫기')+'</div><form id="adminsForm">'+
      '<div class="modal-body"><p>관리자로 등록할 재직자를 선택하세요. 권한을 해제하려면 선택을 풀어 주세요.</p>'+choices+
      '<div id="adminsError" class="error" role="alert"></div></div><div class="modal-foot">'+button('close','취소')+'<button class="primary">저장</button></div></form>');
  }
 const api={organizationChart,peopleRoles,personnelPanel,peoplePage,rankEditor,organizationEditor,organizationLevelEditor,editMemberRankDialog,addMemberDialog,removeMemberDialog,adminSettings};if(typeof module!=='undefined')module.exports=api;else (root.BoardFeaturePages??={})['organization/people']=api;
})(typeof window!=='undefined'?window:globalThis);
