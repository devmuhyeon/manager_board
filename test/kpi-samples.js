/* Disposable review data. Never merge these measurements into customer JSON or shared saves. */
(function(root){
 'use strict';
 function create(C,today){
  const day=offset=>{const date=new Date(today+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);};
  const titles=['신청 화면 개선','검색 조건 정리','모바일 메뉴 개편','고객 안내 문구 개선','통계 화면 신설','운영 배너 교체','접근성 오류 조치','콘텐츠 목록 개선','공통 컴포넌트 적용','로그인 흐름 개선','관리자 화면 보완','반응형 레이아웃 개선'];
  const raw=titles.map((title,index)=>{
   const row={id:'kpi-sample-'+index,과업명:'[KPI 샘플] '+title,요청팀:'샘플 운영팀',진행상태:'진행중',완료요청일:day(index-4)};
   ['기획','디자인','퍼블'].forEach((role,part)=>{
    const open=index%(5-part)===0,status=open?index%2?'진행중':'접수':index%7===0?'운영반영완료':'완료';
    row['담당자_'+role]=['성아미','홍소영','김무현'][part];row['상태_'+role]=status;
    row['완료요청일_'+role]=open?day(index<4?-2:3+part):day(-14+index+part);
    row['작업내용_'+role]='작업시작일자: '+day(-20+index+part)+(open?'':'\n작업종료일자: '+day(-16+index+part+index%4));
   });return row;
  });
  return {rows:C.importRows(C.emptyState(),raw,today).state.projects};
 }
 const api={create};if(typeof module!=='undefined')module.exports=api;else root.BoardKpiSamples=api;
})(typeof window!=='undefined'?window:globalThis);
