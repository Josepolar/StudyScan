import * as study from '../app/api/study/route';
import * as files from '../app/api/files/route';
export async function handle(request:Request){const path=new URL(request.url).pathname;const routes=path==='/api/study'?study:path==='/api/files'?files:null;if(!routes)return new Response('Not found',{status:404});if(request.method==='GET')return routes.GET(request as never);if(request.method==='POST')return routes.POST(request);return new Response('Method not allowed',{status:405});}
