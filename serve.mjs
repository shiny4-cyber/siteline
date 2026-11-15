// Zero-dependency static server for game/ and screenshots/ (local play and capture only).
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {extname,join,normalize} from 'node:path';
const ROOT=new URL('./game/',import.meta.url).pathname;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.txt':'text/plain'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    let path=decodeURIComponent(url.pathname);
    if(path==='/')path='/index.html';
    const file=normalize(join(ROOT,path));
    if(!file.startsWith(normalize(ROOT))){res.writeHead(403).end('forbidden');return;}
    const info=await stat(file);
    if(!info.isFile()){res.writeHead(404).end('not found');return;}
    const body=await readFile(file);
    res.writeHead(200,{'content-type':TYPES[extname(file)]||'application/octet-stream','cache-control':'no-store'});
    res.end(body);
  }catch{res.writeHead(404).end('not found');}
});
const port=Number(process.env.PORT||0);
server.listen(port,'127.0.0.1',()=>{
  const {port:p}=server.address();
  console.log(`siteline serving http://127.0.0.1:${p}/`);
  if(process.env.OPEN==='1')console.log('open that URL in a desktop browser');
});
