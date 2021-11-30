var mapSize = 10000;

class Pos{
    constructor(x,y){
        this.x=x;
        this.y=y;
    }

    randomPos(){
        let x = Math.random() * 2 * mapSize - mapSize;
        let y = Math.random() * 2 * mapSize - mapSize;
        return new Pos(x,y)
    }

    move(dx,dy){
        this.x+=dx;
        this.y+=dy;
    }

    movev(v){
        this.x+=v.x;
        this.y+=v.y;
    }
    
    add(x,y){
        return new Pos(this.x+x, this.y+y)
    }

    addv(v){
        return new Pos(this.x+v.x, this.y+v.y)
    }

    rot(center,angle,clockwise = true){ // center point, angle in radian
        if(clockwise)angle*=-1;
        const x = this.x - center.x
        const y = this.y - center.y
        this.x = Math.cos(angle)*x-Math.sin(angle)*y+center.x;
        this.y = Math.sin(angle)*x+Math.cos(angle)*y+center.y;
    }
}

class Player{
    constructor(name){
        this.name = name;
        this.pos = new Pos(0,0);
        this.r = 25;
        this.sw_angle = 0 * (Math.PI/180); // sword angle
        this.sw_r = 80; // sword radius
        this.sw_w = 30;
        this.sw_h = 100;
        this.hp = 100;
        this.xp = 0;
    }

    trytohit(enemy){
        let sp = this.sw_pos();
        let w = this.sw_w;
        let h = this.sw_h;
        function pos_x_line_meet(p1,p2,p){
            return (p.y-p1.y)*(p.x-p2.x)/(p1.y-p2.y)+p1.x>p.x &&
                (p.y-p1.y)*(p.y-p2.y)<0;
        }
        function line_circle_meet(p1,p2,p,r){
            let a=p2.y-p1.y,b=p1.x-p2.x,c=p1.x*(p1.y-p2.y)+p1.y*(p2.x-p1.x);
            let d = Math.abs(a*p.x+b*p.y+c)/Math.pow(a*a+b*b,0.5)
            return d<r;
        }
        let meet_cnt = 0;
        let dir = [1,1];
        for(let i=0;i<4;i++){
            let p1 = new Pos(sp.x+w*dir[0],sp.y+h*dir[1]);
            let p2 = new Pos(sp.x+w*dir[0],sp.y-h*dir[1]);
            if(pos_x_line_meet(p1,p2,enemy.pos))meet_cnt++;
            if(line_circle_meet(p1,p2,enemy.pos,enemy.r)){
                meet_cnt=1;
                break;
            }
            let tmp = dir[0];
            dir[0]=-dir[1];
            dir[1]=tmp;
        }
        return meet_cnt%2 === 1
    }

    trytoeat(item){
        const p = this.pos;
        const i = item.pos;
        return Math.pow(i.x-p.x,2)+Math.pow(i.y-p.y,2)<=Math.pow(this.r+item.r,2)
    }

    move(dx,dy){
        this.pos.move(dx,dy)
        this.bound()
    }

    bound(){
        if(this.x>=mapSize)this.x=mapSize;
        if(this.y>=mapSize)this.y=mapSize;
        if(this.x<=-mapSize)this.x=-mapSize;
        if(this.y<=-mapSize)this.y=-mapSize;
    }

    sw_rot(angle,clockwise=true){
        if(clockwise)angle*=-1;
        this.sw_angle+=angle;
        this.sw_angle%=(2*Math.PI);
    }

    sw_pos(){
        return this.pos.add(this.sw_r,0).rot(this.pos,this.sw_angle);
    }

    hp_change(dhp){
        this.hp+=dhp;
    }

    dead(){
        return (this.hp <= 0)
    }
}

function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

class Item{
    constructor(pos){
        this.pos = pos; 
        this.color = getRandomColor();
        this.xp = Math.floor(Math.random() * 16)+1;
        this.r = Math.floor(Math.random() * 3)+3;
    }

    eaten(player){
        player.xp+=this.xp;
        this.constructor(Pos.randomPos())
    }
}

export {Player, Pos, Item}