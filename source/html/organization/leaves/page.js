(function(root){
 'use strict';
  function vacationRows(context){
    const {state,user,P,member,leaveSearch}=context;
    return state.leaves.filter(leave=>(P.canManage(state,user.name)||member(leave.owner)?.team===user.team)&&
      (!leaveSearch||(leave.owner+' '+(member(leave.owner)?.team||'')+' '+leave.type+' '+leave.note).toLocaleLowerCase().includes(leaveSearch.toLocaleLowerCase())));
  }
  function vacationPage(context){
    const {state,user,C,P,D,Icons,esc,button,view,leaveMonth,leaveWeekDate,leaveSelectedDay,leaveView,leaveSearch,annualLeavePanel,leaveTypeCards,vacationRows,BoardBriefingCalendar,BoardLeaveCalendar}=context;
    const days=BoardBriefingCalendar.weeks(leaveMonth),week=BoardLeaveCalendar.week(leaveWeekDate);
    const start=leaveView==='calendar'?days[0][0]:week[0],end=leaveView==='calendar'?days.at(-1)[6]:week[6];
    const rows=vacationRows().filter(leave=>leave.start<=end&&leave.end>=start);
    const views=[['table','주차별'],['calendar','월별']].map(([view,label])=>button('leaveView',label,leaveView===view?'active':'',
      'data-view="'+view+'" aria-pressed="'+(leaveView===view)+'"')).join('');
    const weekNav=button('leaveWeek',Icons.arrow('left'),'','data-step="-1" aria-label="이전 주"')+
      '<strong>'+week[0]+' ~ '+week[6]+'</strong>'+button('leaveWeek',Icons.arrow('refresh'),'leave-period-reset','data-step="today" aria-label="이번 주로 초기화" title="이번 주"')+
      button('leaveWeek',Icons.arrow('right'),'','data-step="1" aria-label="다음 주"');
    const monthNav=button('leaveMonth',Icons.arrow('left'),'','data-step="-1" aria-label="이전 달"')+
      '<strong>'+esc(leaveMonth.replace('-','년 '))+'월</strong>'+button('leaveMonth',Icons.arrow('refresh'),'leave-period-reset','data-step="today" aria-label="이번 달로 초기화" title="이번 달"')+
      button('leaveMonth',Icons.arrow('right'),'','data-step="1" aria-label="다음 달"');
    const search='<form id="leaveSearchForm" class="leave-search-form"><div class="leave-search-input">'+
      '<input type="search" name="query" aria-label="휴가 검색" placeholder="팀, 이름, 휴가 내용 검색" value="'+esc(leaveSearch)+'">'+
      '<button type="submit" aria-label="휴가 검색" title="검색">'+Icons.arrow('search')+'</button></div></form>';
    const controls='<div class="leave-schedule-toolbar">'+
      '<div class="leave-view-controls"><div class="tabs" role="group" aria-label="휴가 보기">'+views+'</div></div>'+
      '<div class="leave-month-nav'+(leaveView==='table'?' weekly':'')+'">'+(leaveView==='table'?weekNav:monthNav)+'</div>'+
      '<div class="leave-toolbar-right">'+search+button('newLeave','＋ 휴가 등록')+'</div></div>';
    const content=leaveView==='calendar'?BoardLeaveCalendar.render({rows,month:leaveMonth,C,Calendar:BoardBriefingCalendar,esc,button,
      orderNames:names=>P.orderNames(state,names)}):D.leaves(state,user,rows.filter(leave=>!leaveSelectedDay||leave.start<=leaveSelectedDay&&leave.end>=leaveSelectedDay),'date');
    const overview=leaveView==='table'?BoardLeaveCalendar.weekOverview({rows,date:leaveWeekDate,selected:leaveSelectedDay,today:C.today(),esc,button}):'';
    return '<div class="leave-workspace">'+annualLeavePanel()+leaveTypeCards()+'<section class="card leave-schedule-panel" aria-label="휴가 일정">'+controls+overview+content+
      '</section></div>';
  }
  function annualLeavePanel(context){
    const {state,user,C,P,W,N,D,esc,button,options,member,displayProfile,activeMembers,leaveOwner,leaveYear,BoardLeavePolicy}=context;
    const allowed=activeMembers().filter(person=>person.name===user.name||P.canManage(state,user.name));
    const ledger=W.leaveLedger(state,leaveOwner,leaveYear),number=value=>value===null?'미설정':value+'일';
    const years=Array.from(new Set([Number(leaveYear),Number(C.today().slice(0,4))-1,Number(C.today().slice(0,4)),Number(C.today().slice(0,4))+1])).sort((a,b)=>b-a);
    const hire=BoardLeavePolicy.read(state).hires[leaveOwner]||member(leaveOwner)?.hireDate;
    const tenure=BoardLeavePolicy.tenure(hire,C.today());
    const tiles=[['잔여 연차',ledger.remaining],['사용 연차',ledger.used],['총 연차',ledger.allowance],['근속연수',tenure?tenure.years+'년 '+tenure.months+'개월':'입사일 미설정']];
    const total=ledger.allowance||0,used=ledger.used;
    const profile=displayProfile(member(leaveOwner));
    return '<section class="card annual-panel"><div class="sectionhead"><h2>연차 현황</h2><div class="actions">'+
      '<select id="leaveYear" aria-label="연차 조회 연도">'+years.map(year=>'<option value="'+year+'" '+(String(year)===leaveYear?'selected':'')+'>'+year+'년</option>').join('')+'</select>'+
      '<select id="leaveOwner" aria-label="연차 조회 인원">'+options(allowed.map(person=>person.name),leaveOwner)+'</select>'+
      (P.isOverallAdmin(state,user?.name)?button('leavePolicy','연차 정책 설정'):'')+
      button('leaveAllowance','연차 총수 설정')+'</div></div>'+
      '<div class="annual-overview"><div class="annual-person">'+
      '<div class="annual-person-line">'+D.avatar(profile,false)+'<div class="annual-identity"><strong>'+esc(leaveOwner)+'</strong>'+
      '<span>'+esc(N.teamLabel(profile.team))+(profile.rank?' · '+esc(profile.rank):'')+'</span>'+
      '<small>'+esc(ledger.period.start)+' — '+esc(ledger.period.end)+'</small></div></div>'+
      '<div class="annual-progress-caption"><span>'+(used?used+'일 사용':'사용한 연차 없음')+'</span><strong>'+number(ledger.remaining)+' 남음</strong></div>'+
      '<progress max="'+Math.max(1,total)+'" value="'+Math.max(0,total-used)+'" aria-label="잔여 연차"></progress>'+
      '</div>'+
      '<div class="annual-totals">'+tiles.map(([label,value],index)=>'<div><small>'+label+'</small><strong>'+(index===3?value:number(value))+'</strong></div>').join('')+'</div></div>'+
      '<p class="leave-allowance-mode">'+(ledger.allowanceMode==='manual'?'수동 총수 적용 중 · 연차 총수 설정에서 자동 계산으로 변경할 수 있습니다.':ledger.allowance===null?'입사일 등록 및 연차 정책의 자동 적용 여부를 확인하세요.':'입사일·근속연수 기준 자동 계산')+'</p>'+
      (!ledger.calendarSupported?'<p class="error leave-calendar-warning" role="alert">'+leaveYear+'년 공휴일 자료가 없어 주말만 제외한 잠정 일수입니다.</p>':'')+'</section>';
  }
  function leaveTypeCards(context){
    const {state,user,P,esc,button,BoardLeaveTypes}=context;
    const editable=P.isOverallAdmin(state,user?.name);
    const cards=BoardLeaveTypes.active(state).map(type=>'<article class="leave-type-card">'+
      button('leaveTypeRequest','<strong><span class="tossface" aria-hidden="true">'+esc(type.icon)+'</span>'+esc(type.name)+'</strong>'+
        '<span>'+esc(type.description)+'</span><small>'+type.units+'일 차감</small>',
        'leave-type-request','data-id="'+esc(type.id)+'"')+'</article>').join('');
    return '<section class="leave-types-section" aria-label="휴가 신청"><h2>휴가 신청</h2><div class="leave-types-row">'+
      '<div class="leave-type-scroll" tabindex="0" role="region" aria-label="휴가 종류 카드">'+(cards||'<p class="muted">등록된 휴가 종류가 없습니다.</p>')+
      (editable?button('leaveTypeAdd','＋','leave-type-add','aria-label="휴가 종류 추가" title="휴가 종류 추가"'):'')+'</div></div></section>';
  }
  function leaveTypeEditor(context,id,draft){
    const {state,esc,button,showDialog,BoardLeaveTypes}=context;
    const saved=BoardLeaveTypes.all(state).find(item=>item.id===id);
    const type=draft?{...draft,units:Number(draft.units),active:draft.active!=='off',paid:draft.paid!=='off'}:saved;
    if(id&&!type)throw Error('휴가 종류를 찾을 수 없습니다.');
    const status=(name,value,yes,no)=>'<select name="'+name+'"><option value="on" '+(value!==false?'selected':'')+'>'+yes+'</option><option value="off" '+(value===false?'selected':'')+'>'+no+'</option></select>';
    const types=BoardLeaveTypes.all(state);
    const list=types.map(item=>'<div class="leave-type-list-row">'+button('leaveTypeEdit','<strong><span class="tossface" aria-hidden="true">'+esc(item.icon)+'</span> '+esc(item.name)+'</strong>'+
      '<small>'+esc(item.description)+(item.active===false?' · 사용 안 함':'')+'</small>','leave-type-list-item'+(id===item.id?' active':''),
      'data-id="'+esc(item.id)+'" aria-pressed="'+(id===item.id)+'"')+'</div>').join('');
    showDialog('<div class="modal-head"><h2>휴가 유형 관리</h2>'+button('close','닫기')+'</div><div class="leave-type-editor">'+
      '<aside class="leave-type-list"><strong>휴가 유형 목록</strong>'+list+button('leaveTypeAdd','＋','leave-type-add leave-type-list-add','aria-label="휴가 유형 추가"')+'</aside>'+
      '<form id="leaveTypeForm"><div class="modal-body"><h3>'+(id?'휴가 유형 수정':'휴가 유형 추가')+'</h3><input type="hidden" name="id" value="'+esc(id)+'">'+
      '<label class="field">목록 순서<select name="position">'+Array.from({length:types.length+(id?0:1)},(_,index)=>'<option value="'+index+'" '+(index===(id?types.findIndex(item=>item.id===id):types.length)?'selected':'')+'>'+(index+1)+'번째</option>').join('')+'</select></label>'+
      '<label class="field">사용 여부'+status('active',type?.active,'사용','사용 안 함')+'</label>'+
      '<div class="leave-type-basic"><label class="field">휴가 유형명<input name="name" maxlength="40" required value="'+esc(type?.name)+'"></label>'+
      '<label class="field">아이콘<input name="icon" maxlength="12" value="'+esc(type?.icon||'📅')+'"></label></div>'+
      '<label class="field">휴가 유형 코드<input name="code" maxlength="40" value="'+esc(type?.code)+'" placeholder="예: special"></label>'+
      '<label class="field">설명<input name="description" maxlength="160" value="'+esc(type?.description)+'"></label>'+
      '<h4>신청 설정</h4><div class="leave-type-basic"><label class="field">최소 신청 일수<input type="number" name="minDays" min="0" max="366" step=".5" value="'+esc(type?.minDays)+'" placeholder="제한 없음"></label>'+
      '<label class="field">최대 신청 일수<input type="number" name="maxDays" min=".5" max="366" step=".5" value="'+esc(type?.maxDays)+'" placeholder="제한 없음"></label></div>'+
      '<p class="muted">신청 일수는 주말을 제외한 기간 기준입니다. 반차는 0.5일로 계산합니다.</p>'+
      '<label class="field">하루당 연차 차감<select name="units">'+[0,.5,1].map(units=>'<option value="'+units+'" '+(units===(type?.units??0)?'selected':'')+'>'+units+'일</option>').join('')+'</select></label>'+
      '<label class="field">유급 휴가'+status('paid',type?.paid,'유급','무급')+'</label>'+
      '<p class="error" id="leaveTypeError" role="alert"></p></div><div class="modal-foot">'+
      (id?button('leaveTypeDelete','삭제','danger','data-id="'+esc(id)+'"'):'')+button('close','취소')+'<button type="submit" class="primary">저장</button></div></form></div>');
  }
  function leavePolicyEditor(context,policy){
    const {N,Icons,esc,button,activeMembers,showDialog}=context;
    const members=activeMembers();
    const grants=policy.grants.map((row,index)=>'<div class="leave-policy-grant">'+
      '<label><input name="from'+index+'" type="number" min="1" max="80" required aria-label="시작 근속연수" value="'+esc(row.from)+'">~'+
      '<input name="to'+index+'" type="number" min="1" max="80" required aria-label="종료 근속연수" value="'+esc(row.to)+'">년</label>'+
      '<label><input name="days'+index+'" type="number" min="0" max="366" step=".5" required aria-label="부여 일수" value="'+esc(row.days)+'">일</label>'+
      button('leavePolicyRemove',Icons.arrow('trash'),'people-icon-button','data-index="'+index+'" aria-label="'+(index+1)+'번째 범위 삭제"')+'</div>').join('');
    showDialog('<div class="modal-head"><h2>연차 정책 설정</h2>'+button('close','닫기')+'</div><form id="leavePolicyForm"><div class="modal-body">'+
      '<input name="count" type="hidden" value="'+policy.grants.length+'"><input name="members" type="hidden" value="'+members.length+'">'+
      '<div class="leave-policy-types">'+button('leaveTypeManage','휴가 유형 관리')+'</div>'+
      '<label class="remember-check"><input type="checkbox" name="enabled" '+(policy.enabled?'checked':'')+'>근속연수별 연차 자동 적용</label>'+
      '<p class="muted">입사일을 기준으로 부여합니다. 1년 미만은 매월 개근 시 1일씩 최대 11일, 1년간 출근율 80% 이상이면 15일을 별도로 부여합니다.</p>'+
      '<div class="leave-first-year"><h3>1년 미만 부여 방식</h3><label class="field">발생 방식<select name="firstYearMode"><option value="monthly" '+(policy.firstYear?.mode!=='annual'?'selected':'')+'>매월 개근 시 1일 (최대 11일)</option><option value="annual" '+(policy.firstYear?.mode==='annual'?'selected':'')+'>입사 시 연 n일 선부여</option></select></label><label class="field">연간 선부여 일수<input name="firstYearDays" type="number" min="11" max="366" step=".5" value="'+(policy.firstYear?.days??11)+'"></label><p class="muted">선부여도 개근으로 발생한 법정 월차보다 적게 계산하지 않습니다.</p></div>'+
      '<div class="sectionhead"><h3>근속연수별 부여 범위</h3><div class="actions">'+button('leavePolicyStatutory','법정 기본값 적용')+button('leavePolicyAdd','＋ 범위 추가')+'</div></div>'+
      '<div class="leave-policy-grants">'+grants+'</div>'+
      '<div class="leave-policy-cap"><strong>최대 부여 구간</strong><label><input name="capFrom" type="number" min="1" max="80" required value="'+esc(policy.cap.from)+'">년 이상</label>'+
      '<label><input name="capDays" type="number" min="0" max="366" step=".5" required value="'+esc(policy.cap.days)+'">일 부여</label></div>'+
      '<p class="muted">법정 기본값은 1~2년 15일, 3~4년 16일이며 이후 2년마다 1일씩 가산해 21년 이상 25일입니다. 개인별 계산 방식을 직접 입력으로 선택한 경우에만 수동 총수를 우선합니다.</p>'+
      '<h3>적용 멤버와 입사일</h3><div class="leave-policy-members">'+members.map((person,index)=>'<label><span>'+esc(N.teamLabel(person.team))+' · '+esc(person.name)+
        '</span><input type="hidden" name="hireName'+index+'" value="'+esc(person.name)+'"><input type="date" name="hire'+index+'" aria-label="'+esc(person.name)+' 입사일" value="'+esc(policy.hires[person.name]||'')+'"></label>').join('')+'</div>'+
      '<p class="muted">자동 계산은 출근율 80% 이상·매월 개근을 전제로 합니다. 근태 예외는 개인별 연차 총수로 반영하세요.</p>'+
      '<section class="leave-policy-calculation"><h3>연차 계산 기준</h3><p>휴가 유형에 설정된 일수만큼 차감합니다. 기본값은 연차 1일, 오전·오후반차 0.5일, 특별휴가 0일입니다.</p>'+
      '<p>주말과 등록된 공휴일은 차감에서 제외합니다. 내년 연차 선사용은 실제 휴가일의 다음 연도 연차에서 차감합니다.</p>'+
      '<p>근거 · 근로기준법 제60조. 출근율 미달·단시간 근로·휴직·소멸 등 개별 조건은 확인 후 총수에 반영해야 합니다.</p></section>'+
      '<p class="error" id="leavePolicyError" role="alert"></p></div>'+
      '<div class="modal-foot">'+button('close','취소')+'<button type="submit" class="primary">저장</button></div></form>');
  }
  function openLeave(context,id,typeId,borrowNextYear=false,owner=user.name){
    const {state,user,C,P,esc,button,options,activeMembers,showDialog,leaveOwner,BoardLeaveTypes}=context;const selectedType=BoardLeaveTypes.active(state).find(type=>type.id===typeId);const i=state.leaves.find(l=>l.id===id)||{id:'',owner,start:C.today(),end:C.today(),type:selectedType?.name||BoardLeaveTypes.active(state)[0]?.name||'',note:'',borrowNextYear},leader=P.isLeader(state,user.name)||P.canManage(state,user.name);if(!P.canEditLeave(state,user.name,i.owner))throw new Error('이 팀원의 휴가를 변경할 권한이 없습니다.');showDialog(`<div class="modal-head"><h2>${i.id?'휴가 수정':'휴가 등록'}</h2>${button('close','닫기')}</div><form id="leaveForm"><div class="modal-body"><input name="id" type="hidden" value="${esc(i.id)}"><div class="field"><label for="leaveOwner">이름</label><select name="owner" id="leaveOwner">${options(activeMembers().filter(m=>P.canEditLeave(state,user.name,m.name)).map(m=>m.name),i.owner)}</select></div><div class="field"><label for="leaveType">휴가 종류</label><select name="type" id="leaveType">${options([...new Set([...BoardLeaveTypes.active(state).map(type=>type.name),...(i.id?[i.type]:[])])],i.type)}</select></div><div class="form-grid"><div class="field"><label for="leaveStart">시작일</label><input name="start" id="leaveStart" type="date" required value="${esc(i.start)}"></div><div class="field"><label for="leaveEnd">종료일</label><input name="end" id="leaveEnd" type="date" required value="${esc(i.end)}"></div></div><div class="field" ${i.type==='추가 사용'?'':'hidden'}><label for="leaveUnits">추가 사용 시 하루 차감량</label><select id="leaveUnits" name="dailyUnits">${options(['1','0.5'],String(i.dailyUnits||1))}</select></div><label class="remember-check leave-borrow-toggle"><input name="borrowNextYear" type="checkbox" ${i.borrowNextYear?'checked':''}> 내년 연차 사용</label><p class="muted">체크하면 휴가일이 속한 입사일 기준 주기의 다음 주기 연차에서 차감합니다.</p><div class="field"><label for="leaveNote">메모 (선택)</label><textarea name="note" id="leaveNote" maxlength="300">${esc(i.note)}</textarea></div><p class="muted">${P.canManage(state,user.name)?'모든 재직자의 휴가를 등록·수정할 수 있습니다.':leader?'소속 팀원의 휴가를 등록·수정할 수 있습니다.':'본인의 휴가를 등록·수정할 수 있습니다.'} 등록한 휴가는 팀 일정에 표시됩니다.</p><div id="leaveError" class="error" role="alert"></div></div><div class="modal-foot">${i.id?button('deleteLeave','휴가 삭제','danger',`data-id="${esc(i.id)}"`):''}${button('close','취소')}<button class="primary">휴가 저장</button></div></form>`);}
  function leaveList(context){
    const {state,user,P,esc,button,member,showDialog}=context;const leader=P.isLeader(state,user.name)||P.canManage(state,user.name),team=member(user.name).team;const items=state.leaves.filter(l=>P.canEditLeave(state,user.name,l.owner)).slice().sort((a,b)=>b.start.localeCompare(a.start));showDialog(`<div class="modal-head"><h2>${P.canManage(state,user.name)?'전체':leader?'우리 팀':'나의'} 휴가 관리</h2>${button('close','닫기')}</div><div class="modal-body"><div class="agenda-list">${items.map(l=>`<article class="agenda-item"><strong>${esc(l.owner)} · ${esc(l.type)}</strong><small>${esc(l.start)} ~ ${esc(l.end)}</small>${P.canEditLeave(state,user.name,l.owner)?button('editLeave','편집','',`data-id="${esc(l.id)}"`):''}</article>`).join('')||'<p class="empty">등록된 휴가가 없습니다.</p>'}</div></div><div class="modal-foot">${button('newLeave','＋ 휴가 등록','primary')}${button('close','닫기')}</div>`);}
 const api={vacationRows,vacationPage,annualLeavePanel,leaveTypeCards,leaveTypeEditor,leavePolicyEditor,openLeave,leaveList};if(typeof module!=='undefined')module.exports=api;else (root.BoardFeaturePages??={})['organization/leaves']=api;
})(typeof window!=='undefined'?window:globalThis);
