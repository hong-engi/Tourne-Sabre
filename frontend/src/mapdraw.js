import sword from './sword.png'
const canvas_size = 1000;
const center_h = canvas_size/2;
const center_w = canvas_size/2;

var img = new Image();
img.src = sword; 

function draw(ctx, { me, players, items }) {
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas_size, canvas_size)
    if (me) {
        for (const item of items) {
            const dx = item.pos.x - me.pos.x
            const dy = item.pos.y - me.pos.y
            if (dx * dx + dy * dy < 550 * 550) drawItem(ctx, me, item)
        }

        drawPlayer(ctx, me, me)
        drawSword(ctx, me, me)
        for (const player of players) {
            drawPlayer(ctx, me, player)
            drawSword(ctx, me, player)
        }
    }
    defaultMap(ctx)

    if (me) {
        ctx.font = '20px Dosis-Bold'
        ctx.fillStyle = 'green'
        ctx.fillText('(' + Math.round(me.pos.x) + ',' + Math.round(me.pos.y) + ')', 100, 200)
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
    if(me.pos.dist(p.pos)>400+p.r){
        let dpos = p.pos.addv(me.pos,-1), x=dpos.x, y=dpos.y;
        let angle = Math.atan(y/x)
        if(x<0)angle+=Math.PI
        ctx.fillStyle=p.color;
        ctx.strokeStyle='black';
        ctx.lineWidth=1;
        ctx.save();
            ctx.beginPath()
            ctx.translate(center_w,center_h);
            ctx.rotate(angle);
            ctx.moveTo(400, 0);
            ctx.lineTo(380,-20);
            ctx.lineTo(380, 20);
            ctx.lineTo(400,0);
            ctx.closePath();
            ctx.fill()
        ctx.restore();
    }
    else{
        const circle = new Path2D();
        let dpos = p.pos.addv(me.pos,-1), x=center_w+dpos.x, y=center_h+dpos.y;
        circle.arc(x, y, p.r, 0, 2 * Math.PI);
        ctx.fillStyle=p.color;
        if(me.id === p.id)ctx.fillStyle='red';
        ctx.strokeStyle='black';
        ctx.lineWidth=1;
        ctx.fill(circle);
        ctx.stroke(circle);
        drawString(ctx,me,p)
        drawHealthbar(ctx,me,p)
    }
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
    if(me.pos.dist(p.pos)>400+p.r+p.sw_r)return
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
    if(me.id === p.id)ctx.fillStyle='white';
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