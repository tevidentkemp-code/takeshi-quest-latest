
(()=>{try{
  const qs=new URLSearchParams(location.search||'');
  if(qs.has('mobile') || qs.get('mobile')==='1'){ document.documentElement.classList.add('force-mobile'); }
}catch(_){}})();
