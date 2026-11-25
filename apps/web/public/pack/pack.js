function cp(btn){
  const box=btn.parentElement.cloneNode(true);
  box.querySelectorAll('button,h4').forEach(n=>n.remove());
  const text=box.innerText.trim();
  (navigator.clipboard?navigator.clipboard.writeText(text):Promise.reject()).then(()=>{btn.textContent='Copied';setTimeout(()=>btn.textContent='Copy',1500)}).catch(()=>{btn.textContent='Select text'});
}
document.querySelectorAll('.copy > button').forEach(b=>b.addEventListener('click',()=>cp(b)));
const pb=document.getElementById('print-btn'); if(pb) pb.addEventListener('click',()=>window.print());
