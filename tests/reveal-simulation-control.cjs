// Test the same native disclosure/focus path used to access an offscreen setting.
module.exports=async function reveal(frame,selector){const el=frame.locator(selector);await el.evaluate(el=>{for(let parent=el.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;el.focus({preventScroll:true});});await el.waitFor({state:'visible'});return el;};
