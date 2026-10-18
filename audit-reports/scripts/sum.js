const r=require(process.argv[2]);const m={};for(const x of r)for(const i of x.issues){const k=i.t+" "+(i.tag||"")+" "+(i.text||"")+" "+(i.cr||"")+(i.sw||"");(m[k]=m[k]||[]).push(x.w+x.r)}
for(const [k,v] of Object.entries(m).sort((a,b)=>b[1].length-a[1].length).slice(0,70))console.log(v.length,k.slice(0,170),"|",[...new Set(v)].slice(0,4).join(","))
