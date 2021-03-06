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
        if(j==i) color+='FF';
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
        if(enemy.id == this.id)return;
        let sp = this.sw_pos();
        function pos_x_line_meet(p1,p2,p){
            return ((p.y-p1.y)*(p.x-p2.x)/(p1.y-p2.y)+p1.x>p.x) &&
                ((p.y-p1.y)*(p.y-p2.y)<0);
        }
        function dist(p1,p){
            return Math.pow(Math.pow(p1.x-p.x,2)+Math.pow(p1.y-p.y,2),0.5)
        }
        function point_circle_meet(p1,p,r){
            return dist(p1,p)<r
        }
        function angleof3p(pr,p,pl){
            let prp = dist(pr,p)
            let plp = dist(pl,p)
            let prl = dist(pr,pl)
            return Math.acos((prp*prp+plp*plp+prl*prl)/(2*prp*plp))
        }
        function line_circle_meet(p1,p2,p,r){
            let a=p2.y-p1.y,b=p1.x-p2.x,c=p1.x*(p1.y-p2.y)+p1.y*(p2.x-p1.x);
            let d = Math.abs(a*p.x+b*p.y+c)/Math.pow(a*a+b*b,0.5)
            if(d<r){
                return angleof3p(p,p1,p2)<Math.PI/2 && angleof3p(p,p2,p1)<Math.PI/2
            }
        }
        let meet_cnt = 0;
        let w = this.sw_w/2;
        let h = this.sw_h/2;
        let alpha = Math.atan(w/h)
        let beta = this.sw_angle-alpha
        let r = Math.pow(w*w+h*h,0.5)
        var dir = [new Pos(0,-r).rot(new Pos(0,0),beta),
            new Pos(0,-r).rot(new Pos(0,0),beta+2*alpha)]
        for(let i=0;i<4;i++){
            let p1 = sp.addv(dir[0]);
            let p2 = sp.addv(dir[1]);
            if(pos_x_line_meet(p1,p2,enemy.pos)){
                meet_cnt++;
            }
            if(point_circle_meet(p1,enemy.pos,enemy.r) || 
                line_circle_meet(p1,p2,enemy.pos,enemy.r)){
                meet_cnt=1;
                break;
            }
            let tmp = dir[0];
            dir[0] = new Pos(0,0).addv(dir[1],-1);
            dir[1]=tmp;
        }
        return meet_cnt%2 === 1
    }

    trytoeat(item){
        const p = this.pos;
        const i = item.pos;
        return Math.pow(i.x-p.x,2)+Math.pow(i.y-p.y,2)<=Math.pow(this.r+item.r,2)
    }

    accel(){
        this.speed.move(-this.speed.x/15,-this.speed.y/15)
    }

    move(dx,dy){
        this.pos.movev(this.speed)
        this.accel()
        this.bound()
    }

    bound(){
        if(this.pos.x>=mapSize)this.pos.x=mapSize+(this.pos.x-mapSize)/1.3;
        if(this.pos.y>=mapSize)this.pos.y=mapSize+(this.pos.y-mapSize)/1.3;
        if(this.pos.x<=-mapSize)this.pos.x=-mapSize+(this.pos.x+mapSize)/1.3;
        if(this.pos.y<=-mapSize)this.pos.y=-mapSize+(this.pos.y+mapSize)/1.3;
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
        this.r = Math.pow(25*25+this.xp,0.5)
        if(Math.pow(this.xp/50,0.5)>this.lv)this.lvup()
    }

    lvup(){
        this.lv+=1
        this.hpmax+=25
        this.hp+=25
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

module.exports.Item = Item