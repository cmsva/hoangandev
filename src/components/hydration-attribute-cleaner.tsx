/**
 * Cleans browser-extension injected attributes (BitDefender's bis_skin_checked,
 * Grammarly's data-new-gr-c-s-check-loaded / data-gr-ext-installed, etc.)
 * before React hydrates so the SSR/CSR diff is clean.
 *
 * IMPORTANT: We render a raw <script> (not next/script) directly in <head>
 * via dangerouslySetInnerHTML so it runs synchronously during HTML parse —
 * before <body> content is laid out and before extensions add attributes.
 * This is the only reliable way on Next 16 + Turbopack.
 */
const cleanupScript = `(function(){
  var attrs = ["bis_skin_checked","bis_register","data-new-gr-c-s-check-loaded","data-gr-ext-installed","cz-shortcut-listen"];
  function clean(root){
    if(!root||root.nodeType!==1)return;
    for(var i=0;i<attrs.length;i++)root.removeAttribute(attrs[i]);
    if(!root.querySelectorAll)return;
    var sel = attrs.map(function(a){return "["+a+"]"}).join(",");
    var nodes = root.querySelectorAll(sel);
    for(var n=0;n<nodes.length;n++){
      for(var a=0;a<attrs.length;a++)nodes[n].removeAttribute(attrs[a]);
    }
  }
  function start(){
    clean(document.documentElement);
    if(typeof MutationObserver==="undefined")return;
    var obs=new MutationObserver(function(muts){
      for(var i=0;i<muts.length;i++){
        var m=muts[i];
        if(m.type==="attributes")clean(m.target);
        for(var n=0;n<m.addedNodes.length;n++)clean(m.addedNodes[n]);
      }
    });
    obs.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:attrs});
    window.addEventListener("load",function(){setTimeout(function(){obs.disconnect();clean(document.documentElement);},1500);});
  }
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",start,{once:true});
  } else {
    start();
  }
})();`

export function HydrationAttributeCleaner() {
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: cleanupScript }} />
}
