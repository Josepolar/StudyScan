export const submissionTypes=['image/jpeg','image/png','application/pdf'];
export async function validateSubmissionFile(file,allowed=submissionTypes){
 if(!file||!file.size||file.size>10000000)throw Error('Choose a file between 1 byte and 10 MB.');
 const extension=file.name.split('.').pop()?.toLowerCase();
 const type={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',pdf:'application/pdf'}[extension];
 if(!type||!allowed.includes(type))throw Error('Choose one of the file formats allowed by your teacher.');
 const header=new Uint8Array(await file.slice(0,8).arrayBuffer());
 const valid=type==='application/pdf'?[37,80,68,70,45].every((b,i)=>header[i]===b):type==='image/png'?[137,80,78,71,13,10,26,10].every((b,i)=>header[i]===b):header[0]===255&&header[1]===216&&header[2]===255;
 if(!valid)throw Error('The file contents do not match its extension. Choose a valid JPEG, PNG, or PDF.');
 return {extension,type};
}
