const ts=require('/home/user/The-Loyalty-Loop/apps/web/node_modules/typescript');const fs=require('fs');
const files=process.argv.slice(2);const report=[];
const nameOf=n=>ts.isJsxElement(n)?n.openingElement.tagName.getText():ts.isJsxSelfClosingElement(n)?n.tagName.getText():null;
const attrs=el=>(el.attributes.properties||[]).filter(ts.isJsxAttribute);
const human=s=>s.replace(/^(form|ann|values?)\./,'').replace(/[\[\]'"]/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_.]/g,' ').trim().replace(/^./,c=>c.toUpperCase());
for(const f of files){const src=fs.readFileSync(f,'utf8');const sf=ts.createSourceFile(f,src,99,true,ts.ScriptKind.TSX);const edits=[];
 const textOf=n=>{let t='';const w=x=>{if(ts.isJsxText(x))t+=x.getText();ts.forEachChild(x,w)};w(n);return t.replace(/\s+/g,' ').trim()};
 const visit=(n,anc)=>{const tag=nameOf(n);
  if(tag&&['input','textarea','select'].includes(tag)){const el=ts.isJsxElement(n)?n.openingElement:n;const a=attrs(el);const has=k=>a.find(x=>x.name.getText()===k);
   const type=has('type')?.initializer?.getText()?.replace(/"/g,'');
   if(!['hidden','submit','button'].includes(type)&&!has('aria-label')&&!has('aria-labelledby')&&!has('id')&&!anc.includes('label')&&!a.some(x=>ts.isJsxSpreadAttribute(x))){
    let label=null;const ph=has('placeholder');if(ph&&ph.initializer&&ts.isStringLiteral(ph.initializer))label=ph.initializer.text;
    if(!label){// preceding sibling label/p text
      const parent=n.parent;if(parent&&ts.isJsxElement(parent)){const kids=parent.children.filter(k=>!ts.isJsxText(k)||k.getText().trim());const i=kids.indexOf(n);for(let j=i-1;j>=0;j--){const k=kids[j];const kt=nameOf(k);if(kt&&['label','span','p'].includes(kt)){label=textOf(k);break}if(kt)break}}}
    if(!label){const v=has('value')||has('checked');if(v&&v.initializer)label=human(v.initializer.getText().replace(/^\{|\}$/g,'').split('??')[0].trim())}
    if(label){label=label.replace(/"/g,"'").slice(0,60);edits.push([el.tagName.end,` aria-label="${label}"`]);report.push(`${f}:${sf.getLineAndCharacterOfPosition(n.getStart()).line+1} ${tag} -> ${label}`)}else report.push(`${f}: UNRESOLVED ${tag}`)}}
  ts.forEachChild(n,c=>visit(c,tag?[...anc,tag]:anc))};
 visit(sf,[]);let out=src;for(const[p,s] of edits.sort((a,b)=>b[0]-a[0]))out=out.slice(0,p)+s+out.slice(p);fs.writeFileSync(f,out)}
console.log(report.join('\n'))
