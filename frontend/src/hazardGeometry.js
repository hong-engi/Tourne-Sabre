// Shared (browser + backend) geometry for telegraphed enemy hazards. Keep it
// plain CommonJS without spread or for...of: the production build and the
// Node server both load it.
function angleDiff(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
// Current radius of an expanding/closing ring, `elapsed` ms after it armed.
function ringRadius(h,elapsed,duration){
  var t=Math.max(0,Math.min(1,elapsed/Math.max(1,duration)));
  return h.from+(h.to-h.from)*t;
}
// Does a circle (x, y, r) overlap hazard h? For rings pass the ring radius.
function hazardTouches(h,x,y,r,radius){
  var dx=x-h.x,dy=y-h.y;
  if (h.kind==='circle') return Math.hypot(dx,dy)<h.r+r;
  if (h.kind==='line') {
    var c=Math.cos(h.angle),s=Math.sin(h.angle),u=dx*c+dy*s,v=-dx*s+dy*c;
    return u>=-r&&u<=h.length+r&&Math.abs(v)<=h.width/2+r;
  }
  var d=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
  if (h.kind==='cone') return d<=h.length+r&&(d<r||Math.abs(angleDiff(a,h.angle))<=h.spread/2+Math.asin(Math.min(1,r/Math.max(d,1))));
  if (h.kind==='ring') {
    if (Math.abs(d-radius)>h.band/2+r) return false;
    var gaps=h.gapCount||1;
    for (var g=0;g<gaps;g++) {
      if (Math.abs(angleDiff(a,h.gapAngle+g*(Math.PI*2/gaps)))<=h.gapSize/2) return false;
    }
    return true;
  }
  return false;
}
// Movement effects on the local player from armed hazards: frost slows (the
// strongest one only, never stacking), magnets pull, wind pushes. Returns a
// speed multiplier and a velocity push in units per second.
function hazardForces(list,x,y,r){
  var slow=1,px=0,py=0,pulled=false;
  for (var i=0;i<list.length;i++) {
    var h=list[i];
    if (!h.effect||h.armIn>0||h.left<0||!hazardTouches(h,x,y,r,0)) continue;
    if (h.effect==='slow') slow=Math.min(slow,h.force||.7);
    else if (h.effect==='pull'&&!pulled) {
      // Multiple magnets never add up.
      var dx=h.x-x,dy=h.y-y,d=Math.hypot(dx,dy)||1;pulled=true;
      px+=dx/d*(h.force||150);py+=dy/d*(h.force||150);
    } else if (h.effect==='wind') {px+=Math.cos(h.angle)*(h.force||200);py+=Math.sin(h.angle)*(h.force||200);}
  }
  return {slow:slow,px:px,py:py};
}
module.exports={angleDiff:angleDiff,ringRadius:ringRadius,hazardTouches:hazardTouches,hazardForces:hazardForces};
