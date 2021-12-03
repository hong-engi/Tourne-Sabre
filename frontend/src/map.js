import axios from "axios";
import {Item} from "./object.js"

class mapConstructor{
    constructor(){
        this.itemList=[];
        this.playerList=[];
    }

    test(){
        axios.post('api/map/test')
        console.log('test success')
    }

    deleteAll(){
        axios.delete('api/map/all')
        console.log('deleted All')
    }

    getItems(){
        axios.get(`/api/map/item`)
        .then(response => {
            this.itemList = response.data;
        })
    }
    getPlayers(){
        axios.get(`/api/map/player`)
        .then(response => {
            this.playerList = response.data;
        })
    }

    ate(item){
        axios.delete(`/api/map/item/${item.id}/ate`)
            .then(() => axios.get('/api/map/item'))
            .then(response => {
                this.itemList = response.data;
        });
    };

    kill(player){
        axios.delete(`/api/map/player/${player.id}/kill`)
            .then(() => axios.get('/api/map/player'))
            .then(response => {
                this.playerList = response.data;
        });
    };

    addPlayer(player){
        axios.post(`/api/map/player/add`,player)
            .then(() => axios.get('/api/map/player'))
            .then(response => {
                this.playerList = response.data;
        });
    };

    addItem(num = 5){
        for(let i=0;i<num;i++){
            let item = Item.randomItem()
            axios.post(`/api/map/item/add`,item)
            .then(() => axios.get('/api/map/item'))
            .then(response => {
                this.itemList = response.data;
            });
        }
    }

    damage(player,dmg){
        axios.put(`/api/map/player/${player.id}/damage`,dmg)
            .then(() => axios.get('/api/map/player'))
            .then(response => {
                this.playerList = response.data;
        });
    }

    playerUpdate(player){
        axios.post(`/api/map/player/update`,player)
        .then(() => axios.get('/api/map/player'))
        .then(response => {
            this.playerList = response.data;
        });
    }
};

var map = new mapConstructor()

export {map}