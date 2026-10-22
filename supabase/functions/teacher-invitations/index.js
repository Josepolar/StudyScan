import {createHandler} from './handler.mjs';
Deno.serve(createHandler({env:name=>Deno.env.get(name),fetch,
 sendMail:async(message,config)=>{
  const {default:nodemailer}=await import('npm:nodemailer@10.2.0');
  const transport=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:config.gmail,pass:config.password},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:12000,disableFileAccess:true,disableUrlAccess:true});
  try{const result=await transport.sendMail(message);if(!result.accepted?.some(email=>email.toLowerCase()===message.to.toLowerCase()))throw Error('Gmail did not accept the recipient.');}finally{transport.close();}
 }
}));
