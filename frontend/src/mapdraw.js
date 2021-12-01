import sword from './sword.png'
import {map} from './map.js'
import {Player, Item} from './object.js'
const map_size = 1200;
const center_h = map_size/2;
const center_w = map_size/2;

var img = new Image();
img.src = sword; 

//todo : canvas.width,canvas.height??
function draw(ctx,player) {
    defaultMap(ctx)
    for(let i=0;i<map.length;i++){
        if(map[i] instanceof Item){
            if(map[i].pos.dist(player.pos)<400-map[i].r)
                drawItem(ctx,player,map[i])
        }
    }
    for(let i=0;i<map.length;i++){
        if(map[i] instanceof Player){
            if(map[i].pos.dist(player.pos)<400-map[i].r)
                drawPlayer(ctx,player,map[i])
        }
    }
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
function drawItem(ctx,me,i){
    var circle = new Path2D();
    let dpos = i.pos.addv(me.pos,-1), x=center_w+dpos.x, y=center_h+dpos.y;
    circle.arc(x, y, i.r, 0, 2 * Math.PI);
    ctx.fillStyle=i.color;
    ctx.strokeStyle='black';
    ctx.lineWidth=0.5;
    ctx.fill(circle);
    ctx.stroke(circle);
}

function drawPlayer(ctx,me,p){
    var circle = new Path2D();
    let dpos = p.pos.addv(me.pos,-1), x=center_w+dpos.x, y=center_h+dpos.y;
    circle.arc(x, y, p.r, 0, 2 * Math.PI);
    ctx.fillStyle=p.color;
    if(me === p)ctx.fillStyle='red';
    ctx.strokeStyle='black';
    ctx.lineWidth=1;
    ctx.fill(circle);
    ctx.stroke(circle);
    drawSword(ctx,me,p)
    drawString(ctx,me,p,center_h,center_w)
}

function drawSword(ctx,me,p){
    const angle = -p.sw_angle;
    let dpos = p.pos.addv(me.pos,-1), x=center_w+dpos.x, y=center_h+dpos.y;
    const r = p.sw_r,w=p.sw_w,h=p.sw_h;
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(angle);
    ctx.drawImage(img,-w/2,-r-h/2,w,h);
    ctx.restore();
}

function drawString(ctx,me,p){
    let dpos = p.pos.addv(me.pos,-1), x=center_w+dpos.x, y=center_h+dpos.y;
    ctx.fillStyle='black';
    if(me === p)ctx.fillStyle='white';
    ctx.font = '15px Dosis-Bold';
    let text = p.name
    let width = ctx.measureText(text).width;
    ctx.fillText(text,x-(width/2),y+5)
}

export default draw;