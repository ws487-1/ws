(function(){
 function enhance(){
  const scope=document.querySelector('.home-scope');
  if(scope&&!scope.dataset.enhanced){
   scope.dataset.enhanced='1';const hi=document.createElement('span');hi.className='scope-highlight';hi.setAttribute('aria-hidden','true');scope.prepend(hi);
   const move=()=>{const a=scope.querySelector('a.on');if(a){hi.style.width=a.offsetWidth+'px';hi.style.transform=`translateX(${a.offsetLeft}px)`;}};
   move();requestAnimationFrame(()=>scope.classList.add('ready'));
   scope.addEventListener('click',()=>requestAnimationFrame(move));document.fonts.ready.then(move);
  }
  document.querySelectorAll('.tile:has(a.tile-open)').forEach(t=>{
   t.classList.add('expandable-tile');
  });
 }
 new MutationObserver(enhance).observe(document.querySelector('main')||document.body,{subtree:true,childList:true});enhance();
})();
