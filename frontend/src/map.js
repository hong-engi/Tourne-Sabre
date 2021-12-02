import { Player,Item } from "./object";
import axios from "axios";

//나중에 데이터베이스로 이전
const map = () => {
    var itemList;
    var playerList;
    const getItems = () => {
        axios.get(`/api/item`)
        .then(response => {
            itemList = response.data;
        })
    }
    const getPlayers = () => {
        axios.get(`/api/player`)
        .then(response => {
            playerList = response.data;
        })
    }

    const ate = (item) => {
        axios.delete(`/api/item/${item._id}/ate`)
            .then(() => axios.get('/api/item'))
            .then(response => {
            itemList = response.data;
        });
    };

    const kill = (player) => {
        axios.delete(`/api/player/${player._id}/kill`)
            .then(() => axios.get('/api/kill'))
            .then(response => {
            playerList = response.data;
        });
    };

    const damage = (player) => {
    }



};
// for(let i=0;i<40;i++)
//     map.push(Player.randomPlayer())
// for(let i=0;i<1000;i++)
//     map.push(Item.randomItem())

export {map}