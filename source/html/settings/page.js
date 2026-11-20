(function(root){
 'use strict';
  function settings(context){
    const {state,Icons,button,connectionCards}=context;return `<div class="settings-grid"><section class="card settings-card"><h2>원본과 저장 폴더</h2><p>원본 기준 폴더는 Z:\\고용24 디자인파트 요청관리\\디자인파트요청관리\\입니다. 요청관리 JSON의 정확한 위치는 직접 선택합니다. 원본의 프로젝트 자료와 팀관리 JSON도 변경하지 않습니다.</p>${connectionCards()}<div class="actions">${button('refreshAll','최신 자료 새로고침')}${button('reload','저장된 통합관리 파일 다시 읽기')}</div><p>최근 가져오기: ${state.importedAt?new Date(state.importedAt).toLocaleString('ko-KR'):'아직 없음'}</p></section><section class="card settings-card"><h2>저장 및 백업</h2><p>과업·인원·메모 변경사항은 현재 브라우저에 임시 저장됩니다. 내용 저장을 누르면 선택한 Y 폴더의 <strong>save/</strong> 아래 기능별 JSON에 반영합니다.</p><div class="actions">${button('save','내용 저장','primary')}${button('backup',Icons.arrow('download')+' 통합관리 JSON 내려받기')}${button('restore','통합관리 JSON 복원')}</div><p>다른 사용자가 먼저 저장하면 덮어쓰기를 중단합니다. 동시 저장 이력이 갈라지면 양쪽 자료를 보존하고 복구 전까지 추가 저장을 차단합니다. 작업 전 새로고침을 권장합니다.</p></section></div>`;}
  function preferences(context){
    const {button,showDialog}=context;
    showDialog('<div class="modal-head"><h2>설정</h2>'+button('close','닫기')+'</div><div class="modal-body"><div class="actions">'+
      button('avatarSettings','내 캐릭터 선택')+button('forgetLogin','저장된 로그인 정보 지우기')+
      button('page','데이터 연결','','data-page="settings"')+'</div></div>');
  }
 const api={settings,preferences};if(typeof module!=='undefined')module.exports=api;else (root.BoardFeaturePages??={})['settings']=api;
})(typeof window!=='undefined'?window:globalThis);
