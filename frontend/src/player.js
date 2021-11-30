class Pos{
    constructor(x,y){
        this.x=x;
        this.y=y;
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
        this.sw_angle = 0 * (Math.PI/180); // sword angle
        this.sw_r = 80; // sword radius
        this.hp = 100;
    }

    move(dx,dy){
        this.pos.move(dx,dy)
        this.bound()
    }

    bound(){
        if(this.x>=400)this.x=400;
        if(this.y>=400)this.y=400;
        if(this.x<=-400)this.x=-400;
        if(this.y<=-400)this.y=-400;
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

export {Player, Pos}