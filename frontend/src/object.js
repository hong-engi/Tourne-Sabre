const {levelForXp, stats}=require('./gameRules');
var mapSize = 3000;
function getRandomId(){
    var letters = 'HONGENGIisworkingreallyhard'
    var id = '';
    for(let i=0;i<6;i++){
        id += letters[Math.floor(Math.random()*letters.length)]
    }
    return id;
}

function getRandomColor() {
    var letters = '6789ABCDEF';
    var color = '#';
    let i = Math.floor(Math.random()*3);
    for(let j=0;j<3;j++){
        if(j===i) color+='FF';
        else for (var k = 0; k < 2; k++) {
            color += letters[Math.floor(Math.random() * 10)];
        }
    }
    return color;
}

class Pos{
    constructor(x,y){
        this.x=x;
        this.y=y;
    }

    static randomPos(){
        let x = Math.random() * 2 * mapSize - mapSize;
        let y = Math.random() * 2 * mapSize - mapSize;
        return new Pos(x,y)
    }

    dist(v2){
        return Math.pow((this.x-v2.x)*(this.x-v2.x)+(this.y-v2.y)*(this.y-v2.y),0.5)
    }

    move(dx,dy){
        this.x+=dx;
        this.y+=dy;
    }

    movev(v){
        this.x+=v.x;
        this.y+=v.y;
    }
    
    add(x,y,i=1){
        return new Pos(this.x+x*i, this.y+y*i)
    }

    addv(v,i=1){
        return new Pos(this.x+v.x*i, this.y+v.y*i)
    }

    rot(center,angle,clockwise = true){ // center point, angle in radian
        if(clockwise)angle*=-1;
        const x = this.x - center.x
        const y = this.y - center.y
        return new Pos(Math.cos(angle)*x-Math.sin(angle)*y+center.x,Math.sin(angle)*x+Math.cos(angle)*y+center.y)
    }
}

class Player{
    constructor(name,x=0,y=0){
        this.id = getRandomId();
        this.name = name;
        this.pos = new Pos(x,y);
        this.r = 25;
        this.speed = new Pos(0,0);
        this.sw_angle = 0 * (Math.PI/180); // sword angle
        this.sw_r = 65; // sword radius
        this.sw_w = 40;
        this.sw_h = 100;
        this.sw_speed = 4 * (Math.PI/180);
        this.hp = 100;
        this.xp = 0;
        this.lv = 1;
        this.hpmax = 100;
        this.augments = [];
        this.physicsAck={seq:0,x:0,y:0,vx:0,vy:0};
        this.mode = 'pve';
        this.stealthUntil = 0;
        this.stealthOrigin = null;
        this.pveCooldownUntil = 0;
        this.pveFreeUntil = 0;
        this.bossBuffUntil = 0;
     
        this.color = getRandomColor();
    }

    static randomPlayer(){
        function randomName(){
            let alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
            let name = '';
            for(let i=0;i<10;i++)
                name+=alphabet[Math.floor(Math.random()*alphabet.length)]
            return name;
        }
        let p = new Player(randomName())
        p.pos = Pos.randomPos();
        return p;
    }

    static schemaPlayer(sch){
        let newPlayer = new Player()
        newPlayer.id = sch._id
        newPlayer.name = sch.name
        newPlayer.pos = new Pos(sch.x,sch.y)
        newPlayer.speed = new Pos(sch.vx,sch.vy)
        newPlayer.r = sch.r
        newPlayer.sw_angle = sch.sw_angle
        newPlayer.sw_r = sch.sw_r
        newPlayer.sw_w = sch.sw_w || 40
        newPlayer.sw_h = sch.sw_h
        newPlayer.sw_speed = sch.sw_speed
        newPlayer.hp = sch.hp
        newPlayer.hpmax = sch.hpmax
        newPlayer.xp = sch.xp
        newPlayer.lv = sch.lv
        newPlayer.color = sch.color
        return newPlayer
    }

    addSpeed(x,y){
        this.speed.move(x,y)
    }

    trytohit(enemy){
        if(enemy.id === this.id)return false;
        const dx = enemy.pos.x - this.pos.x, dy = enemy.pos.y - this.pos.y;
        const c = Math.cos(this.sw_angle), s = Math.sin(this.sw_angle);
        const x = c * dx - s * dy, y = s * dx + c * dy;
        const nx = Math.max(-this.sw_w/2, Math.min(this.sw_w/2, x));
        const center = -this.r - this.sw_r;
        const ny = Math.max(center-this.sw_h/2, Math.min(center+this.sw_h/2, y));
        return (x-nx)**2 + (y-ny)**2 <= enemy.r**2;
    }

    trytoeat(item){
        const p = this.pos;
        const i = item.pos;
        return Math.pow(i.x-p.x,2)+Math.pow(i.y-p.y,2)<=Math.pow(this.r+item.r,2)
    }

    accel(){
        this.speed.move(-this.speed.x/15,-this.speed.y/15)
    }

    move(dt=1/30){
        const step=dt*30;
        this.pos.move(this.speed.x*step,this.speed.y*step);
        const damping=Math.pow(14/15,step);
        this.speed.x*=damping; this.speed.y*=damping;
        this.bound();
    }

    bound(){
        const limit=mapSize-this.r;
        this.pos.x=Math.max(-limit,Math.min(limit,this.pos.x));
        this.pos.y=Math.max(-limit,Math.min(limit,this.pos.y));
    }

    sw_rot(angle,clockwise=true){
        if(clockwise)angle*=-1;
        this.sw_angle+=angle;
        this.sw_angle%=(2*Math.PI);
    }

    sw_pos(){
        let p = this.pos.add(0,-this.r-this.sw_r)
        return p.rot(this.pos,this.sw_angle);
    }

    damage(dhp){
        this.hp=Math.max(0,this.hp-dhp)
    }

    dead(){
        return (this.hp <= 0)
    }

    xpup(xp){
        this.xp+=xp;
        const next=levelForXp(this.xp);
        if (next>this.lv) {
            this.lv=next;
            const max=stats(this.lv,this.augments).hpmax;
            this.hp+=Math.max(0,max-this.hpmax);
            this.hpmax=max;
        }
        this.r=25;
    }

}



class Item{
    constructor(pos){
        this.init(pos)
        this.id = getRandomId();
    }

    init(pos){
        this.pos = pos; 
        this.color = getRandomColor();
        this.xp = Math.floor(Math.random() * 16)+1;
        this.r = Math.floor(Math.random() * 10)+3;
    }

    static schemaItem(sch){
        let newItem = new Item()
        newItem.id = sch._id
        newItem.pos = new Pos(sch.x,sch.y)
        newItem.color = sch.color
        newItem.xp = sch.xp
        newItem.r = sch.r
        return newItem
    }

    static randomItem(){
        return new Item(Pos.randomPos())
    }

    eaten(player){
        player.xpup(this.xp)
        this.init(Pos.randomPos())
    }
}

export {Player, Pos, Item}