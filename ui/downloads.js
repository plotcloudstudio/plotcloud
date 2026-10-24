// Local, browser-native exports. No external account or retired host API required.
(()=>{
  window.PlotCloudDownloads={async save({filename,data}){
    if(!filename||data==null)throw new Error('Missing export filename or data.');
    const blob=data instanceof Blob?data:new Blob([data]);
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=String(filename).replace(/[\\/]/g,'_');
    document.body.appendChild(a);
    try{a.click();}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  }};
})();
