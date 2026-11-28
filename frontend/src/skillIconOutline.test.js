import {normalizeIconOutline,OUTLINE_COLOR} from './skillIconOutline';

function rectangle(border,color=[12,15,48]){
  const width=4+border*2,data=new Uint8ClampedArray(width*width*4);
  for(let y=0;y<width;y++)for(let x=0;x<width;x++){
    const inside=x>=border&&y>=border&&x<width-border&&y<width-border;
    data.set([...(inside?[70,210,140]:color),255],(y*width+x)*4);
  }
  return {data,width};
}
const pixel=(image,x,y)=>Array.from(image.data.slice((y*image.width+x)*4,(y*image.width+x)*4+4));

test('different source outline widths and ink colors yield the same one-pixel display outline',()=>{
  const thin=rectangle(1),thick=rectangle(3,[22,20,60]);
  const a=normalizeIconOutline(thin.data,thin.width,thin.width);
  const b=normalizeIconOutline(thick.data,thick.width,thick.width);
  expect(a.data).toEqual(b.data);
  expect(pixel(a,1,20)[3]).toBe(0);
  expect(pixel(a,2,20)).toEqual([...OUTLINE_COLOR,255]);
  expect(pixel(a,3,20)).toEqual([70,210,140,255]);
  expect(pixel(a,37,20)).toEqual([...OUTLINE_COLOR,255]);
  expect(pixel(a,38,20)[3]).toBe(0);
});

test.each([32,40])('outline stays one pixel when prepared for a %ipx UI slot',size=>{
  const source=rectangle(2),image=normalizeIconOutline(source.data,source.width,source.width,size);
  expect(image.width).toBe(size);
  const middle=Math.floor(size/2);
  expect(pixel(image,1,middle)[3]).toBe(0);
  expect(pixel(image,2,middle)).toEqual([...OUTLINE_COLOR,255]);
  expect(pixel(image,3,middle)).toEqual([70,210,140,255]);
  expect(new Set(Array.from(image.data).filter((_,i)=>i%4===3))).toEqual(new Set([0,255]));
});

test('preserves enclosed dark faces but keeps genuine transparent holes open',()=>{
  const source=rectangle(1);
  // Four center pixels become a face. A transparent hole through the face
  // remains transparent even though surrounded by the colored silhouette.
  for(const [x,y] of [[2,2],[3,2],[2,3],[3,3]])source.data.set([12,15,48,255],(y*source.width+x)*4);
  const dark=normalizeIconOutline(source.data,source.width,source.width);
  expect(pixel(dark,20,20)).toEqual([...OUTLINE_COLOR,255]);
  for(const [x,y] of [[2,2],[3,2],[2,3],[3,3]])source.data[(y*source.width+x)*4+3]=0;
  const hole=normalizeIconOutline(source.data,source.width,source.width);
  expect(pixel(hole,20,20)[3]).toBe(0);
});

test('dark violet material stays colored and an empty source stays empty',()=>{
  const purple=new Uint8ClampedArray([67,30,94,255]);
  const image=normalizeIconOutline(purple,1,1);
  expect(pixel(image,20,20)).toEqual([67,30,94,255]);
  expect(normalizeIconOutline(new Uint8ClampedArray(16),2,2).data.every(v=>v===0)).toBe(true);
});
