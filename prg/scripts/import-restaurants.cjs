/* Build the offline catalog from the official Eumseong CSV; exclude all other regions. */
const fs=require('node:fs'),path=require('node:path');
function csv(file){
 const raw=new TextDecoder('euc-kr').decode(fs.readFileSync(file)).replace(/^\uFEFF/,'').replace(/\r\r\n/g,'\n').replace(/\r\n/g,'\n');
 const rows=[];let row=[],value='',quoted=false;
 for(let i=0;i<raw.length;i++){const c=raw[i];if(c==='"'){if(quoted&&raw[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c==='\n')){row.push(value.trim());value='';if(c==='\n'){if(row.some(Boolean))rows.push(row);row=[];}}else value+=c;}
 if(value||row.length){row.push(value.trim());rows.push(row);}const header=rows.shift();return rows.map(row=>Object.fromEntries(header.map((key,i)=>[key,row[i]||''])));
}
const [eumseong]=process.argv.slice(2);if(!eumseong)throw Error('Usage: node import-restaurants.cjs eumseong.csv');
const sourceRows=[...csv(eumseong).filter(r=>r.상세영업상태명==='영업'&&/맹동면 (두성리|동성리)(?:\s|$)/.test(r.소재지전체주소)).map(r=>({name:r.사업장명,category:r.업태구분명,address:r.도로명전체주소||r.소재지전체주소,lot:r.소재지전체주소,phone:r.전화번호,area:'음성',asOf:r.데이터기준일자}))];
const unique=new Map();for(const row of sourceRows){const key=row.name+'|'+row.address;if(!unique.has(key))unique.set(key,row);}
const restaurants=[...unique.values()].sort((a,b)=>a.name.localeCompare(b.name,'ko')||a.address.localeCompare(b.address,'ko')).map((r,i)=>({id:'restaurant-'+(i+1),...r}));
const data={version:'2026-11-20',scope:'음성군 맹동면 두성리·동성리',sources:[{title:'음성군 충북혁신도시 일반음식점현황',url:'https://www.data.go.kr/data/15118972/fileData.do',asOf:'2026-01-09'}],restaurants};
const output=path.resolve(__dirname,'../../source/html/toys/meal-data.js');fs.writeFileSync(output,'/* Official open data; source dates and scope are included in the catalog. */\n(function(root){const data='+JSON.stringify(data)+';if(typeof module!==\'undefined\')module.exports=data;else root.BoardMealData=data;})(typeof window!==\'undefined\'?window:globalThis);\n');
console.log(JSON.stringify({count:restaurants.length,areas:Object.fromEntries(['음성'].map(area=>[area,restaurants.filter(r=>r.area===area).length])),output}));
