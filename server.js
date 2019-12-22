// Resources Used : https://codeburst.io/the-only-nodejs-introduction-youll-ever-need-d969a47ef219
let blackcards = [];
let whitecards;
let blackcard;

// parses a locally stored json file and stores it into arrays
var getJson = () => {
    const fs = require('fs');

    let rawdata = fs.readFileSync('./output.json');
    let cards = JSON.parse(rawdata);
    for(var i = 0; i < cards.blackCards.length; i++){
        blackcards.push([cards.blackCards[i].text, cards.blackCards[i].pick]);
    }
    whitecards=cards.whiteCards;
}

getJson();

var newCard = () => {
    blackcard = blackcards[Math.floor(Math.random() * blackcards.length)]
}

// creates an http server that displays hello world
var express = require('express');
var app = express();
var http = require('http');

//setting the port.
app.set('port', process.env.PORT || 3000);

var server = http.createServer(app).listen(app.get('port'), function(){
    console.log("Express server listening on port " + app.get('port'));
});

var io = require('socket.io')(server);

// sets the folder with css to static so it can be used
app.use(express.static('public'));

//Adding routes
app.get('/',(request,response)=>{
    response.sendFile(__dirname + '/index.html');
});

app.get('/users/:count',(request, response)=>{
    var usersCards = [];
    var totCard = request.params.count;
    for(var i = 0; i < totCard; i++){
        usersCards.push(whitecards[Math.floor(Math.random() * whitecards.length)])
    }

    collection = {
        'black' : blackcard,
        'white' : usersCards
    }
    response.json(collection);
});

var numUsers=0;
// var lobbies={
//     id : "",
//     users : [],
//     scores : []
// }; 
var lobbies = {};

io.on('connection', function (socket) {
    // allows users to connect once
    socket.addedUser = false;

    function newRoundUsers(prevSelector, gameId){
        var usernames = [];
        var selector;
        // gets names of users
        for(var i = 0; i < lobbies[gameId].users.length; i++){
            usernames.push(lobbies[gameId].users[i].username)
        }

        // randomly selects a user to be the selector
        if(prevSelector == undefined){
            selector = lobbies[gameId].users[Math.floor(Math.random() * lobbies[gameId].users.length)];
        }
        else{
            var ind = usernames.indexOf(prevSelector);
            if(ind == usernames.length-1){
                ind = 0;
            }
            else{
                ind++;
            }
            selector = lobbies[gameId].users[ind];
        }
        selector.emit("selector", {
            "players" : usernames,
            "scores" : lobbies[gameId].scores
        });

        // notifies the other clients that they are players
        for(var i = 0; i < lobbies[gameId].users.length; i++){
            if(lobbies[gameId].users[i] == selector){
                continue;
            }
            else{
                lobbies[gameId].users[i].emit("players", {
                        'selector' : selector.username,
                        'players' : usernames,
                        'scores' : lobbies[gameId].scores
                    }
                );
            }
        }
    }

    socket.on("create game", function(username){
        var gameId = (Math.random()+1).toString(36).slice(2, 18);

        lobbies[gameId] = {
            'host' : username,
            'users' : [],
            'scores' : []
        };

        // store the username in the socket session for this client
        socket.username = username;
        socket.addedUser = true;

        // adds user to the lobby
        lobbies[gameId]["users"].push(socket)
        lobbies[gameId]["scores"].push(0)

        io.emit('game created', {
            'username' : socket.username,
            'gameid' : gameId
        });
        socket.emit("host", gameId);
    });

    socket.on("leave", function(gameId){
        for(var i = 0; i < lobbies[gameId].users.length; i++){
            if(lobbies[gameId].users[i] == socket){
                if(socket.username == lobbies[gameId].host){
                    for(var i = 0; i < lobbies[gameId].users.length; i++){
                        lobbies[gameId].users[i].addedUser = false;
                    }
                    delete lobbies[gameId];
                    io.emit("kick everyone", gameId);
                }
                else{
                    lobbies[gameId].users[i].addedUser = false;
                    lobbies[gameId].users.splice(i,i);
                    lobbies[gameId].scores.splice(i,i);
                    io.emit("left", socket.username);
                    console.log(socket.username + " is leaving");
                }
                break;
            }
        }
    });

    socket.on("list games", function(){
        var games = [];
        var hosts = [];
        for (var key in lobbies) {
            games.push(key);
            hosts.push(lobbies[key].host);
        }
        socket.emit('list', {
            'games' : games,
            "hosts" : hosts
        });
    });

    socket.on('round winner', function(winner){
        for(var i = 0; i < lobbies[winner.gameId]['users'].length; i++){
            if(winner.winner == lobbies[winner.gameId]['users'][i].username){
                lobbies[winner.gameId]['scores'][i] += 100;
            }
        }
        io.emit('round over', {
            'winner' : winner.winner,
            'scores' : lobbies[winner.gameId]['scores']
        });
        setTimeout(function(){ 
            newCard();
            newRoundUsers(socket.username, winner.gameId); 
        }, 2000);
    });

    // listen of player answers
    socket.on('answer', function(card){
        io.emit("selected answers", {
                                'cards' : card,
                                'user' : socket.username
                            }
        );
    });


    // adds user to the lobby by listening for emissions from client
    socket.on('add user', function (data) {
        // checks if user was added
        if (socket.addedUser) {
            console.log(socket.username + " is already in lobby.");
            return;
        }
        // checks if lobby is full
        if(lobbies[data.gameId].users.length == 2){
            console.log("Lobby is full.")
            return;
        }
        
        // store the username in the socket session for this client
        socket.username = data.username;
        socket.addedUser = true;

        // adds user to the lobby
        lobbies[data.gameId]["users"].push(socket)
        lobbies[data.gameId]["scores"].push(0)

        // randomly chooses an initial selector from the players
        if (lobbies[data.gameId].users.length == 2){
            // gets random question card
            newCard();

            // selects the players and selector
            newRoundUsers(undefined, data.gameId);
        }
    });
});