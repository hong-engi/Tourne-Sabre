import axios from "axios";
import {Item} from "./object.js"

const sitetxt = 'http://localhost:8080/'

class mapConstructor{
    constructor(){
        this.itemList=[];
        this.playerList=[];
    }

    test(){
        axios.post(sitetxt+'map/test')
        console.log('test success')
    }

    deleteAll(){
        axios.delete(sitetxt+'map/all')
        console.log('deleted All')
    }

    getItems(){
        axios.get(sitetxt+`map/item`)
        .then(response => {
            this.itemList = response.data;
        })
    }
    getPlayers(){
        axios.get(sitetxt+`map/player`)
        .then(response => {
            this.playerList = response.data;
        })
    }

    kill(player){
        axios.delete(sitetxt+`map/player/${player.id}/kill`)
            .then(() => axios.get(sitetxt+'map/player'))
            .then(response => {
                this.playerList = response.data;
        });
    };

    addPlayer(player){
        axios.post(sitetxt+`map/player/add`,player)
            .then(() => axios.get(sitetxt+'map/player'))
            .then(response => {
                this.playerList = response.data;
        });
    };

    deletePlayer(player){
        axios.post(sitetxt+`map/${player.id}/delete`)
            .then(() => axios.get(sitetxt+'map/player'))
            .then(response => {
                this.playerList = response.data;
        });
    };

    addItem(num = 5){
        for(let i=0;i<num;i++){
            let item = Item.randomItem()
            axios.post(sitetxt+`map/item/add`,item)
            .then(() => axios.get(sitetxt+'map/item'))
            .then(response => {
                this.itemList = response.data;
            });
        }
    }

    damage(player,dmg){
        axios.put(sitetxt+`map/player/${player.id}/damage`,{dmg:dmg})
            .then(() => axios.get(sitetxt+'map/player'))
            .then(response => {
                this.playerList = response.data;
        });
    }

    playerUpdate(player){
        axios.post(sitetxt+`map/player/update`,player)
        .then(() => axios.get(sitetxt+'map/player'))
        .then(response => {
            this.playerList = response.data;
        });
    }

    playerUpdateBack(player){
        axios.get(sitetxt+`map/player/${player.id}`)
        .then((found) => {if(found && player)player.hp = found.data.hp})
    }

    ate(item){
        axios.post(sitetxt+`map/item/ate`,item)
            .then(() => axios.get(sitetxt+'map/item'))
            .then(response => {
                this.itemList = response.data;
        });
    };
};

var map = new mapConstructor()

export {map}