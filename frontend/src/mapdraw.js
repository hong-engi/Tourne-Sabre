import sword from './sword.png'
const map_size = 1200;
const center_h = map_size/2;
const center_w = map_size/2;
//todo : canvas.width,canvas.height??
function draw(player) {
    var canvas = document.getElementById('gameboard');
    if (canvas.getContext) {
        var ctx = canvas.getContext('2d');
        defaultMap(ctx)
        drawPlayer(ctx,player);
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

function drawPlayer(ctx,p){
    var circle = new Path2D();
    circle.arc(center_h, center_w, 25, 0, 2 * Math.PI);
    ctx.fillStyle='red';
    ctx.strokeStyle='black';
    ctx.lineWidth=3;
    ctx.fill(circle);
    ctx.stroke(circle);
    drawSword(ctx,p)
    drawString(ctx,p.name,center_h,center_w)
}

function drawSword(ctx,p){
    const angle = -p.sw_angle;
    var img = new Image();
    img.onload = function() {
        ctx.save();
        ctx.translate(center_w,center_h);
        ctx.rotate(angle);
        ctx.drawImage(img,p.sw_r-50,0-15,100,30);
        ctx.restore();
    };
    img.src = sword; 
}

function drawString(ctx,text,x,y){
    ctx.fillStyle='black';
    ctx.font = '15px Dosis-Bold';
    let width = ctx.measureText(text).width;
    ctx.fillText(text,x-(width/2),y+5)
}

export default draw;