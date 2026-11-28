// Prepare existing Fixer sprites on the actual UI pixel grid. Source PNGs
// stay intact; rebuilding the outline after sizing keeps it one CSS pixel.
export const OUTLINE_COLOR = [11,18,32];
const isInk=(r,g,b)=>r<=28&&g<=30&&b<=64;

export function normalizeIconOutline(source,width,height,size=40){
  const colored=new Uint8Array(width*height);
  let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x,p=i*4;
    if(source[p+3]&&!isInk(source[p],source[p+1],source[p+2])){
      colored[i]=1;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
  }
  const data=new Uint8ClampedArray(size*size*4);
  if(right<left)return {data,width:size,height:size};
  // Two empty pixels outside a one-pixel outline, on every display grid.
  const content=size-6,scale=Math.min(content/(right-left+1),content/(bottom-top+1));
  const w=Math.max(1,Math.round((right-left+1)*scale)),h=Math.max(1,Math.round((bottom-top+1)*scale));
  const ox=Math.floor((size-w)/2),oy=Math.floor((size-h)/2);
  const body=new Uint8Array(size*size),original=new Uint8Array(size*size);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const sx=left+Math.min(right-left,Math.floor((x+.5)*(right-left+1)/w));
    const sy=top+Math.min(bottom-top,Math.floor((y+.5)*(bottom-top+1)/h));
    const si=sy*width+sx,p=si*4,i=(oy+y)*size+ox+x,d=i*4;
    if(!source[p+3])continue;
    original[i]=1;body[i]=colored[si];
    const ink=isInk(source[p],source[p+1],source[p+2]);
    data[d]=ink?OUTLINE_COLOR[0]:source[p];data[d+1]=ink?OUTLINE_COLOR[1]:source[p+1];data[d+2]=ink?OUTLINE_COLOR[2]:source[p+2];
  }
  // Preserve enclosed dark details (ghost faces, sword seams). Genuine
  // transparent holes keep their original alpha, including circular arrows.
  const exterior=new Uint8Array(size*size),queue=[0];exterior[0]=1;
  for(let q=0;q<queue.length;q++){
    const i=queue[q],x=i%size,y=Math.floor(i/size);
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
      const nx=x+dx,ny=y+dy,n=ny*size+nx;
      if(nx>=0&&ny>=0&&nx<size&&ny<size&&!body[n]&&!exterior[n]){exterior[n]=1;queue.push(n);}
    }
  }
  for(let i=0;i<body.length;i++)if(original[i]&&!exterior[i])body[i]=1;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=y*size+x,p=i*4;
    if(body[i]){data[p+3]=255;continue;}
    let edge=false;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const nx=x+dx,ny=y+dy;
      if(nx>=0&&ny>=0&&nx<size&&ny<size&&body[ny*size+nx])edge=true;
    }
    if(edge){data.set(OUTLINE_COLOR,p);data[p+3]=255;}
    else data.fill(0,p,p+4);
  }
  return {data,width:size,height:size};
}

const prepared=new Map();
export function prepareIcon(src,size){
  const key=`${src}:${size}`;
  if(prepared.has(key))return prepared.get(key);
  const pending=new Promise(resolve=>{
    const image=new Image();
    image.onload=()=>{
      const canvas=document.createElement('canvas');
      canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const ctx=canvas.getContext('2d');
      if(!ctx){resolve(src);return;}
      ctx.drawImage(image,0,0);
      const normalized=normalizeIconOutline(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,size);
      canvas.width=size;canvas.height=size;
      const pixels=ctx.createImageData(size,size);pixels.data.set(normalized.data);
      ctx.putImageData(pixels,0,0);
      resolve(canvas.toDataURL());
    };
    image.onerror=()=>{prepared.delete(key);resolve(src);};
    image.src=src;
  });
  prepared.set(key,pending);
  return pending;
}
