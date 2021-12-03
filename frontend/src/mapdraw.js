import sword from './sword.png'
import {map} from './map.js'
import {Pos, Player, Item} from './object.js'
const canvas_size = 1200;
const center_h = canvas_size/2;
const center_w = canvas_size/2;

var img = new Image();
img.src = sword; 

//todo : canvas.width,canvas.height??
function draw(ctx,player) {
    ctx.StrokeStyle='black'
    ctx.fillStyle='black'
    ctx.fillRect(0,0,canvas_size,canvas_size);
    defaultMap(ctx)

    for(let i=0;i<map.itemList.length;i++){
        let item = Item.schemaItem(map.itemList[i])
        if(player.pos.dist(item.pos)<400-item.r){
            drawItem(ctx,player,item)
        }
    }

    for(let i=0;i<map.playerList.length;i++){
        let player2 = Player.schemaPlayer(map.playerList[i])
        if(player.pos.dist(player2.pos)<400-player2.r){
            drawPlayer(ctx,player,player2)
        }
    }
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
    if(me.id == p.id){x=center_w;y=center_h;}
    circle.arc(x, y, p.r, 0, 2 * Math.PI);
    ctx.fillStyle=p.color;
    if(me.id == p.id)ctx.fillStyle='red';
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
    if(me.id == p.id){x=center_w;y=center_h;}
    const r = p.sw_r,w=p.sw_w,h=p.sw_h;
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(angle);
    ctx.drawImage(img,-w/2,-r-h/2,w,h);
    ctx.restore();
}

function drawString(ctx,me,p){
    let dpos = p.pos.addv(me.pos,-1), x=center_w+dpos.x, y=center_h+dpos.y;
    if(me.id == p.id){x=center_w;y=center_h;}
    ctx.fillStyle='black';
    if(me.id == p.id)ctx.fillStyle='white';
    ctx.font = '15px Dosis-Bold';
    let text = p.name
    let width = ctx.measureText(text).width;
    ctx.fillText(text,x-(width/2),y+5)
}

export default draw;