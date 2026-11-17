(function(root){
 'use strict';
 const LIMIT=1_000_000_000_000;
 const empty=()=>({cards:[],entries:[]});
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const validMonth=value=>typeof value==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value);
 function validDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+'T00:00:00Z');
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
 }
 const validAmount=value=>Number.isSafeInteger(value)&&value>=0&&value<=LIMIT;
 const validId=value=>typeof value==='string'&&value.length>0&&value.length<=120;
 function unique(items,key){return new Set(items.map(key)).size===items.length;}
 function validate(data){
  if(!data||!Array.isArray(data.cards)||!Array.isArray(data.entries))throw Error('법인카드 자료 형식을 확인하세요.');
  const cardsValid=data.cards.every(card=>card&&validId(card.id)&&typeof card.name==='string'&&card.name.trim()&&card.name.length<=40&&Array.isArray(card.limits)&&card.limits.every(limit=>limit&&validMonth(limit.month)&&validAmount(limit.amount))&&unique(card.limits,limit=>limit.month)&&card.extra&&typeof card.extra==='object'&&!Array.isArray(card.extra)&&Object.entries(card.extra).every(([month,amount])=>validMonth(month)&&validAmount(amount)));
  if(!cardsValid||!unique(data.cards,card=>card.id)||!unique(data.cards,card=>card.name.toLocaleLowerCase('ko')))throw Error('법인카드 종류 또는 월 금액을 확인하세요.');
  const cardIds=new Set(data.cards.map(card=>card.id));
  const entriesValid=data.entries.every(entry=>entry&&validId(entry.id)&&cardIds.has(entry.cardId)&&validDate(entry.date)&&typeof entry.author==='string'&&entry.author.trim()&&typeof entry.purpose==='string'&&entry.purpose.trim()&&entry.purpose.length<=160&&typeof entry.detail==='string'&&entry.detail.length<=2000&&typeof entry.note==='string'&&entry.note.length<=500&&validAmount(entry.amount)&&entry.amount>0&&typeof entry.excluded==='boolean');
  if(!entriesValid||!unique(data.entries,entry=>entry.id))throw Error('법인카드 사용 내역을 확인하세요.');
  return data;
 }
 function amount(value){
  const text=String(value??'').trim(),number=Number(text);
  if(!/^\d+$/.test(text)||!validAmount(number))throw Error('금액은 0원 이상의 정수로 입력하세요.');
  return number;
 }
 function monthly(data,cardId,month){
  const card=data.cards.find(item=>item.id===cardId);
  const limit=card?.limits.filter(item=>item.month<=month).sort((a,b)=>b.month.localeCompare(a.month))[0]?.amount||0;
  const extra=card?.extra[month]||0;
  const entries=data.entries.filter(item=>item.cardId===cardId&&item.date.startsWith(month+'-')).sort((a,b)=>b.date.localeCompare(a.date));
  const used=entries.reduce((total,item)=>total+(item.excluded?0:item.amount),0);
  const excluded=entries.reduce((total,item)=>total+(item.excluded?item.amount:0),0);
  return {limit,extra,used,excluded,balance:limit+extra-used,entries};
 }
 function create({uid,isAdmin}){
  const active=(state,actor)=>state.members?.some(person=>person.name===actor&&person.active!==false);
  const canBudget=(state,actor)=>active(state,actor)&&isAdmin(state,actor);
  const canEdit=(state,actor,entry)=>active(state,actor)&&(entry.author===actor||isAdmin(state,actor));
  function saveCard(state,actor,input){
   if(!canBudget(state,actor))throw Error('전체관리자만 카드와 월 금액을 설정할 수 있습니다.');
   const data=structuredClone(state.cardExpenses||empty());
   let card=data.cards.find(item=>item.id===input.id);
   if(input.id&&!card)throw Error('카드 종류를 찾을 수 없습니다.');
   const name=String(input.name||'').trim();
   if(!name||name.length>40||!validMonth(input.month))throw Error('카드 이름과 적용 월을 확인하세요.');
   if(data.cards.some(item=>item.id!==card?.id&&item.name.toLocaleLowerCase('ko')===name.toLocaleLowerCase('ko')))throw Error('같은 이름의 카드가 있습니다.');
   if(!card){card={id:uid(),name,limits:[],extra:{}};data.cards.push(card);}
   card.name=name;
   const limit=amount(input.limit),extra=amount(input.extra);
   const current=monthly(data,card.id,input.month).limit;
   if(!card.limits.length||current!==limit){card.limits=card.limits.filter(item=>item.month<input.month);card.limits.push({month:input.month,amount:limit});}
   if(extra)card.extra[input.month]=extra;else delete card.extra[input.month];
   return {state:{...state,cardExpenses:validate(data)},id:card.id};
  }
  function saveEntry(state,actor,input){
   if(!active(state,actor))throw Error('로그인이 필요합니다.');
   const data=structuredClone(state.cardExpenses||empty());
   const index=data.entries.findIndex(item=>item.id===input.id),old=data.entries[index];
   if(input.id&&(!old||!canEdit(state,actor,old)))throw Error('이 사용 내역을 수정할 수 없습니다.');
   const entry={id:old?.id||uid(),cardId:input.cardId,date:input.date,purpose:String(input.purpose||'').trim(),detail:String(input.detail||'').trim(),author:old?.author||actor,amount:amount(input.amount),note:String(input.note||'').trim(),excluded:input.excluded===true||input.excluded==='on'};
   if(index<0)data.entries.push(entry);else data.entries[index]=entry;
   return {...state,cardExpenses:validate(data)};
  }
  function removeEntry(state,actor,id){
   const data=state.cardExpenses,entry=data?.entries.find(item=>item.id===id);
   if(!entry||!canEdit(state,actor,entry))throw Error('이 사용 내역을 삭제할 수 없습니다.');
   return {...state,cardExpenses:{...data,entries:data.entries.filter(item=>item.id!==id)}};
  }
  return {canBudget,canEdit,saveCard,saveEntry,removeEntry};
 }
 const won=value=>new Intl.NumberFormat('ko-KR').format(value)+'원';
 function balances(data,{id,cardId,date,amount:input,excluded}){
  if(!validDate(date)||!data.cards.some(card=>card.id===cardId))return null;
  const charge=String(input??'').trim()===''?0:Number(input);
  if(!validAmount(charge))return null;
  const month=date.slice(0,7),current=monthly(data,cardId,month).balance;
  const old=data.entries.find(entry=>entry.id===id);
  const previous=old&&old.cardId===cardId&&old.date.startsWith(month+'-')&&!old.excluded?old.amount:0;
  return {current,final:current+previous-(excluded?0:charge)};
 }
 function updateBalances(form,data){
  const fields=form.elements;
  const result=balances(data,{id:fields.namedItem('id').value,cardId:fields.cardId.value,date:fields.date.value,amount:fields.amount.value,excluded:fields.excluded.checked});
  form.querySelector('[data-expense-current]').textContent=result?won(result.current):'—';
  form.querySelector('[data-expense-final]').textContent=result?won(result.final):'—';
 }
 const tableHeader=['사용일자','사용목적 및 내역','상세','작성자','사용금액','비고'];
 function render({state,actor,cardId,month,service,esc,button,sampleData}){
  const data=state.cardExpenses||sampleData||empty(),sampleOnly=Boolean(sampleData&&!state.cardExpenses);
  const card=data.cards.find(item=>item.id===cardId)||data.cards[0],canBudget=service.canBudget(state,actor);
  const addCard=canBudget?button('expenseAddCard','＋ 카드 종류 추가'):'';
  const addEntry=button('expenseAddEntry','＋ 사용 내역 추가','primary',card&&!sampleOnly?'data-id="'+esc(card.id)+'"':'');
  if(!card)return '<section class="card card-expenses"><div class="expense-toolbar"><p>등록된 법인카드가 없습니다.</p><div class="actions">'+addCard+addEntry+'</div></div></section>';
  const current=today().slice(0,7),m=monthly(data,card.id,month),live=monthly(data,card.id,current);
  const tabs=data.cards.map(item=>button('expenseSelectCard',esc(item.name),item.id===card.id?'active':'','data-id="'+esc(item.id)+'" aria-pressed="'+(item.id===card.id)+'"')).join('');
  const settings=canBudget&&!sampleOnly?button('expenseEditBudget','월 금액 설정','','data-id="'+esc(card.id)+'"'):'';
  const year=Number(month.slice(0,4));
  const years=[...new Set([year,year-1,year+1,...card.limits.map(item=>Number(item.month.slice(0,4))),...Object.keys(card.extra).map(value=>Number(value.slice(0,4))),...data.entries.filter(item=>item.cardId===card.id).map(item=>Number(item.date.slice(0,4)))])].sort((a,b)=>b-a);
  const yearOptions=years.map(value=>'<option value="'+value+'"'+(value===year?' selected':'')+'>'+value+'년</option>').join('');
  const monthOptions=Array.from({length:12},(_,i)=>String(i+1).padStart(2,'0')).map(value=>'<option value="'+value+'"'+(value===month.slice(5)?' selected':'')+'>'+Number(value)+'월</option>').join('');
  const metric=(label,value)=>'<div><span>'+label+'</span><strong>'+won(value)+'</strong></div>';
  const rows=m.entries.map(item=>{
   const detail=esc(item.detail||'—');
   const edit=!sampleOnly&&service.canEdit(state,actor,item)?button('expenseEditEntry',esc(item.purpose),'project-button','data-id="'+esc(item.id)+'"'):esc(item.purpose);
   return '<tr><td><time datetime="'+esc(item.date)+'">'+esc(item.date)+'</time></td><td>'+edit+'</td><td>'+detail+'</td><td>'+esc(item.author)+'</td><td class="expense-amount">'+won(item.amount)+(item.excluded?'<span class="expense-excluded">합계 제외</span>':'')+'</td><td>'+esc(item.note||'—')+'</td></tr>';
  }).join('');
  return '<section class="card card-expenses"><div class="expense-toolbar"><div class="tabs" role="group" aria-label="법인카드 종류">'+tabs+'</div>'+addCard+'</div>'
   +'<div class="expense-toolbar"><div class="expense-period"><select id="expenseYear" aria-label="조회 연도">'+yearOptions+'</select><select id="expenseMonth" aria-label="조회 월">'+monthOptions+'</select></div><div class="actions">'+(sampleOnly?'<span class="muted">샘플 내역</span>':settings)+addEntry+'</div></div>'
   +'<div class="expense-metrics">'+metric('월 기본 금액',m.limit)+metric('월 추가 금액',m.extra)+metric('월 총사용금액',m.used)+metric('월 잔여금액',m.balance)+metric('실시간 잔여금액 · '+esc(current.slice(5))+'월',live.balance)+'</div>'
   +(m.excluded?'<p class="expense-excluded-total">합계 제외 금액 '+won(m.excluded)+'</p>':'')
   +'<div class="table-wrap" tabindex="0" aria-label="법인카드 사용 내역"><table><caption class="sr-only">'+esc(card.name+' '+month+' 사용 내역')+'</caption><thead><tr>'+tableHeader.map(label=>'<th scope="col">'+label+'</th>').join('')+'</tr></thead><tbody>'+(rows||'<tr><td colspan="6" class="empty">이 달에 등록된 사용 내역이 없습니다.</td></tr>')+'</tbody></table></div></section>';
 }
 function cardForm({data,card,month,esc,button,addEntryAfter=false}){
  const m=monthly(data,card?.id,month);
  return '<div class="modal-head"><h2>'+(card?'월 금액 설정':'카드 종류 추가')+'</h2>'+button('close','닫기')+'</div><form id="expenseCardForm"><div class="modal-body expense-form"><input type="hidden" name="id" value="'+esc(card?.id||'')+'">'+(addEntryAfter?'<input type="hidden" name="addEntryAfter" value="yes"><p class="muted">카드 종류를 먼저 등록하면 사용 내역 추가로 이동합니다.</p>':'')+'<label class="field">카드 이름<input name="name" maxlength="40" required value="'+esc(card?.name||'')+'"></label><label class="field">적용 연월<input type="month" name="month" required '+(card?'readonly ':'')+'value="'+esc(month)+'"></label><label class="field">월 기본 금액(원)<input type="number" name="limit" min="0" max="'+LIMIT+'" step="1" required value="'+m.limit+'"></label><p class="muted">기본 금액을 바꾸면 적용 월부터 이후 모든 달에 반영됩니다. 추가 금액은 해당 월에만 더합니다.</p><label class="field">해당 월 추가 금액(원)<input type="number" name="extra" min="0" max="'+LIMIT+'" step="1" required value="'+m.extra+'"></label><p id="expenseFormError" class="error" role="alert"></p></div><div class="modal-foot">'+button('close','취소')+'<button class="primary" type="submit">'+(addEntryAfter?'저장하고 다음':'저장')+'</button></div></form>';
 }
 function entryForm({data,entry,cardId,month,actor,esc,button}){
  const date=today(),last=data.entries.findLast(item=>item.author===actor);
  const selected=entry?.cardId||last?.cardId||cardId||data.cards[0]?.id;
  const defaultDate=entry?.date||(date.startsWith(month)?date:month+'-01');
  const initial=balances(data,{id:entry?.id,cardId:selected,date:defaultDate,amount:entry?.amount,excluded:entry?.excluded});
  const cards=data.cards.map(card=>'<option value="'+esc(card.id)+'"'+(card.id===selected?' selected':'')+'>'+esc(card.name)+'</option>').join('');
  const field=(label,name,max,required=false)=>'<label class="field">'+label+'<input name="'+name+'" maxlength="'+max+'" '+(required?'required ':'')+'value="'+esc(entry?.[name]||'')+'"></label>';
  return '<div class="modal-head"><h2>'+(entry?'사용 내역 수정':'사용 내역 추가')+'</h2>'+button('close','닫기')+'</div><form id="expenseEntryForm"><div class="modal-body expense-form">'
   +'<input type="hidden" name="id" value="'+esc(entry?.id||'')+'"><div class="expense-form-pair"><label class="field">카드 이름<select name="cardId" required>'+cards+'</select></label><label class="field">사용일자<input type="date" name="date" required value="'+esc(defaultDate)+'"></label></div>'
   +field('사용 내역 및 목적','purpose',160,true)+'<label class="field">사용 상세내역<textarea name="detail" maxlength="2000" rows="3">'+esc(entry?.detail||'')+'</textarea></label>'+field('비고','note',500)
   +'<fieldset class="expense-balance-form"><legend>금액</legend><div class="expense-balance-fields"><div><span>현재 잔여금액</span><output data-expense-current>'+ (initial?won(initial.current):'—')+'</output></div>'
   +'<label class="field">사용금액(원)<input type="number" name="amount" min="1" max="'+LIMIT+'" step="1" required value="'+esc(entry?.amount||'')+'"></label><div><span>최종 잔여금액</span><output data-expense-final aria-live="polite">'+(initial?won(initial.final):'—')+'</output></div></div>'
   +'<label class="expense-exclude-switch"><input type="checkbox" role="switch" name="excluded"'+(entry?.excluded?' checked':'')+'> 합계에서 제외</label></fieldset><label class="field">작성자<input readonly value="'+esc(entry?.author||actor)+'"></label><p id="expenseFormError" class="error" role="alert"></p></div>'
   +'<div class="modal-foot">'+(entry?button('expenseDeleteEntry','삭제','danger','data-id="'+esc(entry.id)+'"'):'')+button('close','취소')+'<button class="primary" type="submit">저장</button></div></form>';
 }
 const api={create,validate,empty,today,validMonth,monthly,render,cardForm,entryForm,updateBalances};
 if(typeof module!=='undefined')module.exports=api;else root.BoardCardExpenses=api;
})(typeof window!=='undefined'?window:globalThis);
