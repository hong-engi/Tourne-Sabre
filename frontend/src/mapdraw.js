import sword from './sword.png'
import {map} from './map.js'
import {Pos, Player, Item} from './object.js'
const canvas_size = 1000;
const center_h = canvas_size/2;
const center_w = canvas_size/2;

var img = new Image();
img.src = sword; 

//todo : canvas.width,canvas.height??
function draw(ctx,me) {

    let playerList = []
    ctx.fillStyle='white'
    ctx.fillRect(0,0,canvas_size,canvas_size);
    if(me!=null){
        for(let i=0;i<map.itemList.length;i++){
            let item = Item.schemaItem(map.itemList[i])
            if(me.pos.dist(item.pos)<550){
                drawItem(ctx,me,item)
            }
        }

        for(let i=0;i<map.playerList.length;i++){
            let player = Player.schemaPlayer(map.playerList[i])
            if(me.pos.dist(player.pos)<550){
                playerList.push(player)
            }
        }
        for(let i=0;i<playerList.length;i++){   
            if(me.id == playerList[i].id) {me=playerList[i]}
            drawPlayer(ctx,me,playerList[i])
            drawSword(ctx,me,playerList[i])
        }

        /*
        ctx.fillStyle = 'purple'
        let sp = me.sw_pos()
        var circle = new Path2D();
        circle.arc(center_w+sp.x-me.pos.x, center_h+sp.y-me.pos.y, 3, 0, 2 * Math.PI);
        circle.arc(center_w-me.pos.x, center_h-me.pos.y, 3, 0, 2 * Math.PI);
        ctx.fill(circle);
        */
        /*
        let w = me.sw_w/2;
        let h = me.sw_h/2;
        let alpha = Math.atan(w/h)
        let beta = me.sw_angle-alpha
        let r = Math.pow(w*w+h*h,0.5)
        var dir = [new Pos(0,-r).rot(new Pos(0,0),beta),
            new Pos(0,-r).rot(new Pos(0,0),beta+2*alpha)]
        for(let i=0;i<4;i++){
            let xx = new Path2D();
            let p1 = sp.addv(dir[0]);
            ctx.fillStyle = 'blue'
            xx.arc(center_w+p1.x-me.pos.x, center_h+p1.y-me.pos.y, 3, 0, 2 * Math.PI);
            ctx.fill(xx);
            let tmp = dir[0];
            dir[0] = new Pos(0,0).addv(dir[1],-1);
            dir[1] = tmp;
        }
        */
    }
    defaultMap(ctx)

    if(me!=null){
        ctx.font = '20px Dosis-Bold';
        ctx.fillStyle = 'green'
        let text = '('+String(Math.round(me.pos.x))+','+String(Math.round(me.pos.y))+')'
        ctx.fillText(text,100,200)
    }
}

function defaultMap(ctx){
    ctx.StrokeStyle='black'
    ctx.fillStyle='black'
    ctx.beginPath()
    ctx.moveTo(0, 0);
    ctx.lineTo(canvas_size, 0);
    ctx.lineTo(canvas_size,canvas_size);
    ctx.lineTo(0, canvas_size);
    ctx.lineTo(0,0);
    ctx.closePath();
    ctx.arc(center_w,center_h,400,0,Math.PI*2,true);
    ctx.closePath();
    ctx.fill();
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
    if(me.id == p.id){p=me}
    var circle = new Path2D();
    let dpos = p.pos.addv(me.pos,-1), x=center_w+dpos.x, y=center_h+dpos.y;
    circle.arc(x, y, p.r, 0, 2 * Math.PI);
    ctx.fillStyle=p.color;
    if(me.id == p.id)ctx.fillStyle='red';
    ctx.strokeStyle='black';
    ctx.lineWidth=1;
    ctx.fill(circle);
    ctx.stroke(circle);
    drawSword(ctx,me,p)
    drawString(ctx,me,p)
    drawHealthbar(ctx,me,p)
}

function drawHealthbar(ctx,me,p){
    let dpos = p.pos.addv(me.pos,-1), x=center_w+dpos.x, y=center_h+dpos.y;
    ctx.strokeStyle = '#77FF77'
    ctx.fillStyle = '#77FF77'
    ctx.lineWidth=2;
    ctx.fillRect(x-p.r,y+p.r+3,2*p.r*p.hp/p.hpmax,10)
    ctx.strokeStyle = '#77FF77'
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(x-p.r,y+p.r+3,2*p.r,10)
}

function drawSword(ctx,me,p){
    const angle = -p.sw_angle;
    let dpos = p.pos.addv(me.pos,-1), x=center_w+dpos.x, y=center_h+dpos.y;
    const r = p.r+p.sw_r,w=p.sw_w,h=p.sw_h;
    ctx.save();
        ctx.translate(x,y);
        ctx.rotate(angle);
        ctx.drawImage(img,-w/2,-r-h/2,w,h);
    ctx.restore();
}

function drawString(ctx,me,p){
    let dpos = p.pos.addv(me.pos,-1), x=center_w+dpos.x, y=center_h+dpos.y;
    ctx.fillStyle='black';
    if(me.id == p.id)ctx.fillStyle='white';
    ctx.font = String(p.r*15/25)+'px Dosis-Bold';
    let text = p.name
    let width = ctx.measureText(text).width;
    ctx.fillText(text,x-(width/2),y+(p.r*5/25))

    ctx.font = String(Math.max(10,p.r*10/25))+'px Dosis-ExtraBold';
    text = String(p.lv)+' lv'
    width = ctx.measureText(text).width;
    ctx.fillText(text,x-(width/2),y+(p.r*18/25))

}

export default draw;