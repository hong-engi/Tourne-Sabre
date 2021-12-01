import sword from './sword.png'
const map_size = 1200;
const center_h = map_size/2;
const center_w = map_size/2;

var img = new Image();
img.src = sword; 

//todo : canvas.width,canvas.height??
function draw(ctx,player,n) {
    defaultMap(ctx)
    drawPlayer(ctx,player,n);
    player.sw_rot(1*(2*Math.PI/180))
}

function defaultMap(ctx){
    var circle = new Path2D();
    circle.arc(center_h, center_w, 400, 0, 2 * Math.PI);
    ctx.fillStyle='white';
    ctx.strokeStyle='gray';
    ctx.lineWidth=5;
    ctx.fill(circle);
    ctx.stroke(circle);
}

function drawPlayer(ctx,p,n){
    var circle = new Path2D();
    circle.arc(center_h, center_w, p.r, 0, 2 * Math.PI);
    ctx.fillStyle='red';
    ctx.strokeStyle='black';
    ctx.lineWidth=1;
    ctx.fill(circle);
    ctx.stroke(circle);
    drawSword(ctx,p,n)
    //drawSword(ctx,p);
    drawString(ctx,p.name,center_h,center_w)
}

function drawSword(ctx,p,n){
    const angle = -p.sw_angle;
    const r = p.sw_r,w=p.sw_w,h=p.sw_h;
    ctx.save();
    ctx.translate(center_w,center_h);
    ctx.rotate(angle);
    ctx.drawImage(img,0-w/2,-r-h/2,w,h);
    //ctx.fillRect(0-w/2,-r-h/2,w,h);
    ctx.restore();
}

function drawString(ctx,text,x,y){
    ctx.fillStyle='black';
    ctx.font = '15px Dosis-Bold';
    let width = ctx.measureText(text).width;
    ctx.fillText(text,x-(width/2),y+5)
}

export default draw;