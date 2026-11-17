(function(root){
 'use strict';
 const defaultLevels=['조직','팀','멤버'];
 const isName=value=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=80;
 function validate(chart,teams){
  if(chart===undefined)return;
  const invalid=()=>{throw Error('조직도 구조를 확인해 주세요.');};
  if(!chart||!Array.isArray(chart.levels)||!chart.levels.length||!chart.levels.every(isName)||
    !Array.isArray(chart.nodes)||!Array.isArray(chart.hiddenMembers)||!chart.hiddenMembers.every(name=>typeof name==='string'))invalid();
  const nodes=new Map(),linkedMembers=new Set(),linkedTeams=new Set();
  for(const node of chart.nodes){
   if(!node||!isName(node.id)||nodes.has(node.id)||!isName(node.name)||(node.parent!==null&&typeof node.parent!=='string'))invalid();
   if(node.member!==undefined&&(typeof node.member!=='string'||!node.member||linkedMembers.has(node.member)))invalid();
   if(node.team!==undefined&&(!teams.includes(node.team)||linkedTeams.has(node.team)))invalid();
   if(node.member)linkedMembers.add(node.member);
   if(node.team)linkedTeams.add(node.team);
   nodes.set(node.id,node);
  }
  for(const node of nodes.values()){
   let depth=0,parent=node.parent;
   while(parent!==null){
    if(++depth>=chart.levels.length||!nodes.has(parent))invalid();
    parent=nodes.get(parent).parent;
   }
  }
 }
 function read(saved,members,teams,label){
  const chart=saved?structuredClone(saved):{levels:defaultLevels.slice(),nodes:[
   {id:'worklog',parent:null,name:'WorkLog'},
   ...teams.map(team=>({id:'team:'+team,parent:'worklog',name:label(team),team}))
  ],hiddenMembers:[]};
  const byTeam=new Map(chart.nodes.filter(node=>node.team).map(node=>[node.team,node]));
  const linked=new Set([...chart.hiddenMembers,...chart.nodes.map(node=>node.member)]);
  const byId=new Map(chart.nodes.map(node=>[node.id,node]));
  for(const person of members){
   const group=byTeam.get(person.team);
   if(!group||linked.has(person.name))continue;
   let parent=group.parent,level=1;
   while(parent!==null){level++;parent=byId.get(parent).parent;}
   if(level>=chart.levels.length)chart.levels.push(defaultLevels[level]||'레벨 '+(level+1));
   chart.nodes.push({id:'member:'+person.name,parent:group.id,name:person.name,member:person.name});
  }
  return chart;
 }
 function forest(chart,members,team){
  const byParent=new Map();
  for(const node of chart.nodes){
   if(!byParent.has(node.parent))byParent.set(node.parent,[]);
   byParent.get(node.parent).push(node);
  }
  const byName=new Map(members.map(person=>[person.name,person]));
  function branch(node,inScope){
   const person=byName.get(node.member);
   if(node.member&&(!person||(team&&person.team!==team)))return null;
   const visible=!team||node.team===team||person?.team===team||(!node.team&&inScope);
   const children=(byParent.get(node.id)||[]).map(child=>branch(child,visible)).filter(Boolean);
   return visible||children.length?{...node,person,children}:null;
  }
  return (byParent.get(null)||[]).map(node=>branch(node,false)).filter(Boolean);
 }
 function descendants(chart,id){
  const ids=new Set([id]);
  let size=0;
  while(size!==ids.size){
   size=ids.size;
   chart.nodes.forEach(node=>{if(ids.has(node.parent))ids.add(node.id);});
  }
  return ids;
 }
 function remove(chart,id){
  if(!chart.nodes.some(node=>node.id===id))throw Error('조직도 항목을 찾을 수 없습니다.');
  const ids=descendants(chart,id);
  chart.hiddenMembers=[...new Set([...chart.hiddenMembers,...chart.nodes.filter(node=>ids.has(node.id)&&node.member).map(node=>node.member)])];
  chart.nodes=chart.nodes.filter(node=>!ids.has(node.id));
 }
 function depth(chart,id){
  const byId=new Map(chart.nodes.map(node=>[node.id,node]));
  let level=-1;
  for(let parent=id;parent!==null;parent=byId.get(parent).parent)level++;
  return level;
 }
 function extendLevels(chart){
  for(const node of chart.nodes){
   const level=depth(chart,node.id);
   while(level>=chart.levels.length)chart.levels.push('레벨 '+(chart.levels.length+1));
  }
 }
 const api={validate,read,forest,descendants,remove,depth,extendLevels};
 if(typeof module!=='undefined')module.exports=api;else root.BoardOrganization=api;
})(typeof window!=='undefined'?window:globalThis);
