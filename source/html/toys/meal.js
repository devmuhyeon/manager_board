(function(root){
 'use strict';
 const catalog=typeof module!=='undefined'?require('./meal-data.js'):root.BoardMealData;
 const hash=value=>{let n=2166136261;for(const c of value)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
 // One fixed shuffled cycle: every catalog entry is recommended once before repeating.
 const cycle=catalog.restaurants.slice().sort((a,b)=>hash(a.id+'worklog-meal')-hash(b.id+'worklog-meal')||a.id.localeCompare(b.id));
 const today=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 function daily(date=today()){
  const stamp=Date.parse(date+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==date)throw Error('추천 날짜를 확인하세요.');
  return cycle[((stamp/86400000)%cycle.length+cycle.length)%cycle.length];
 }
 const search=query=>{const needle=String(query||'').trim().toLocaleLowerCase('ko');return catalog.restaurants.filter(r=>[r.name,r.address,r.category,r.area].some(v=>v.toLocaleLowerCase('ko').includes(needle)));};
 function render({esc,query=''}){
  const date=today(),r=daily(date),rows=search(query),map=row=>'https://map.naver.com/p/search/'+encodeURIComponent(row.name+' '+row.address);
  return '<div class="toy-meal-layout"><section class="toy-panel toy-meal-today"><div class="toy-panel-head"><strong>오늘의 식사추천</strong><small>'+date+'</small></div><span class="toy-badge">'+esc(r.area)+' · '+esc(r.category)+'</span><h2>'+esc(r.name)+'</h2><p>'+esc(r.address)+'</p>'+(r.phone?'<p>'+esc(r.phone)+'</p>':'')+'<a href="'+map(r)+'" target="_blank" rel="noopener noreferrer">지도에서 찾기</a><div class="toy-rules"><strong>하루에 한 곳, 함께 고르는 식사</strong><p>모든 사용자에게 오늘은 같은 식당을 추천합니다. 한국 시간 자정에 다음 추천으로 바뀝니다.</p><small>수록된 일반음식점 '+catalog.restaurants.length+'곳을 한 번씩 추천한 뒤 다시 순환합니다. 휴무일·점심 영업 여부는 방문 전에 확인해주세요.</small></div></section><section class="toy-panel"><div class="toy-panel-head"><strong>충북혁신도시 음식점</strong><small>공개 자료 기준 '+catalog.restaurants.length+'곳</small></div><form class="toy-form" data-toy-form="mealSearch"><div class="toy-inline"><input name="query" type="search" maxlength="100" value="'+esc(query)+'" placeholder="음식점, 음식 종류, 주소 검색" aria-label="음식점 검색"><button type="submit">검색</button></div></form><p class="toy-meal-count">검색 결과 '+rows.length+'곳</p><div class="toy-meal-list" role="region" aria-label="음식점 목록" tabindex="0">'+(rows.map(row=>'<article><div><strong>'+esc(row.name)+'</strong><small>'+esc(row.area+' · '+row.category)+'</small><p>'+esc(row.address)+'</p></div><a href="'+map(row)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(row.name)+' 지도 검색">지도</a></article>').join('')||'<p class="toy-empty">검색 결과가 없습니다.</p>')+'</div><details class="toy-details"><summary>음식점 자료와 기준일</summary><p>수록 범위: '+esc(catalog.scope)+'</p>'+catalog.sources.map(source=>'<p><a href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(source.title)+'</a> · '+source.asOf+' 기준</p>').join('')+'<p>공식 공개 자료에서 해당 지역의 일반음식점을 모두 수록했습니다. 이후 신규 개업·폐업은 자료 갱신 전까지 반영되지 않을 수 있습니다. 진천 자료에는 전화번호·개별 영업상태가 제공되지 않습니다.</p></details></section></div>';
 }
 const api={catalog,today,daily,search,render};if(typeof module!=='undefined')module.exports=api;else root.BoardMeals=api;
})(typeof window!=='undefined'?window:globalThis);
