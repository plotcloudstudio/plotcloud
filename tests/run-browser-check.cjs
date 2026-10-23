// Preserve the check's exit status and expose useful failure details through the Checks API.
const {spawn}=require('node:child_process');
const script=process.argv[2];
if(!script){console.error('A browser check path is required.');process.exit(2)}
let tail='';
const child=spawn(process.execPath,[script],{stdio:['ignore','pipe','pipe']});
function capture(chunk,stream){stream.write(chunk);tail=(tail+chunk.toString()).slice(-9000)}
child.stdout.on('data',data=>capture(data,process.stdout));child.stderr.on('data',data=>capture(data,process.stderr));
child.on('error',error=>{console.error(error.message);process.exitCode=1});
child.on('close',code=>{
 if(code!==0&&process.env.GITHUB_ACTIONS){const message=(script+'\n'+tail).replace(/\u001b\[[0-9;]*m/g,'').replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A');console.error('::error title=Browser check failed::'+message)}
 process.exitCode=code===0?0:code||1;
});
