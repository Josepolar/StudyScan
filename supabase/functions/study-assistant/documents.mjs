export async function documentText(bytes,extension,loadZip,loadPdf){
 if(bytes.length>10000000)throw Error('Use a resource smaller than 10 MB.');let text='';
 if(extension==='txt'||extension==='md')text=new TextDecoder().decode(bytes);
 else if(extension==='pdf'){const {extractText}=await loadPdf();text=(await extractText(bytes,{mergePages:true})).text;}
 else if(extension==='docx'||extension==='pptx'){
  const {unzipSync,strFromU8}=await loadZip();let expanded=0;
  const entries=unzipSync(bytes,{filter:entry=>{const selected=extension==='docx'?entry.name==='word/document.xml':/^ppt\/slides\/slide\d+\.xml$/.test(entry.name);if(!selected)return false;expanded+=entry.originalSize;if(entry.originalSize>2000000||expanded>4000000)throw Error('The document is too large. Split it into smaller lessons.');return true;}});
  text=Object.keys(entries).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(name=>strFromU8(entries[name]).replace(/<\/(?:w:p|a:p)>/g,'\n\n').replace(/<[^>]*>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'")).join('\n\n');
 }else throw Error('Use a PDF, Word, PowerPoint, TXT, or Markdown file.');
 text=text.replace(/\n{3,}/g,'\n\n').trim();if(!text)throw Error('No readable text was found. Scanned images need OCR; paste an accessible text version instead.');return {text:text.slice(0,80000),truncated:text.length>80000};
}
