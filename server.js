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

var lobbies = {};

io.on('connection', function (socket) {
    // allows users to connect once
    socket.addedUser = false;

    function newRoundUsers(gameId, update = false){
        var usernames = [];

        // gets names of users
        for(var i = 0; i < lobbies[gameId].users.length; i++){
            usernames.push(lobbies[gameId].users[i].username)
        }

        if(update == true){
            lobbies[gameId].selector.emit("update selecor", {
                "players" : usernames,
                "scores" : lobbies[gameId].scores
            });
        }
        else{
            lobbies[gameId].selector.emit("selector", {
                "players" : usernames,
                "scores" : lobbies[gameId].scores
            });
        }

        // notifies the other clients that they are players
        for(var i = 0; i < lobbies[gameId].users.length; i++){
            if(lobbies[gameId].users[i] == lobbies[gameId].selector){
                continue;
            }
            else{
                if(update == true){
                    lobbies[gameId].users[i].emit("update player", {
                        'selector' : lobbies[gameId].selector.username,
                        'players' : usernames,
                        'scores' : lobbies[gameId].scores
                        }
                    );
                }
                else {
                    lobbies[gameId].users[i].emit("players", {
                            'selector' : lobbies[gameId].selector.username,
                            'players' : usernames,
                            'scores' : lobbies[gameId].scores
                        }
                    );
                }
            }
        }
    }

    socket.on("create game", function(username){
        var gameId = (Math.random()+1).toString(36).slice(2, 18);

        lobbies[gameId] = {
            'host' : username,
            'users' : [],
            'scores' : [],
            'selector' : socket
        };

        // store the username in the socket session for this client
        socket.username = username;
        socket.addedUser = true;

        // adds user to the lobby
        lobbies[gameId]["users"].push(socket)
        lobbies[gameId]["scores"].push(0)

        io.emit('game created', {
            'username' : socket.username,
            'gameid' : gameId,
            'tot' : lobbies[gameId]["users"].length
        });
        socket.emit("host", gameId);
    });


    // selects the next selector if previous selector left
    function getNewSelector(gameId){
        var ind;
        for(var i = 0; i < lobbies[gameId].users.length; i++){
            if(lobbies[gameId].users[i].username == lobbies[gameId].selector.username){
                if(i == lobbies[gameId].users.length-1){
                    ind = 0;
                }
                else{
                    ind = i + 1;
                }
                lobbies[gameId].selector = lobbies[gameId].users[ind];
                break;
            }
        }
    }

    socket.on("leave", function(gameId){
        try{
            for(var i = 0; i < lobbies[gameId].users.length; i++){
                if(lobbies[gameId].users[i] == socket){
                    if(socket.username == lobbies[gameId].host){
                        for(var j = 0; j < lobbies[gameId].users.length; j++){
                            lobbies[gameId].users[j].addedUser = false;
                            lobbies[gameId].users[j].emit("kick everyone", gameId);
                        }
                        delete lobbies[gameId];
                        io.emit("remove lobby", gameId);
                    }
                    else{

                        lobbies[gameId].users[i].addedUser = false;

                        // if the selector left then it selects the next one
                        // if(socket.username == lobbies[gameId].selector.username){
                        //     getNewSelector(gameId);
                        //     newRoundUsers(gameId, true);
                        // }

                        // removes the score and player from lobby
                        lobbies[gameId].users.splice(i,i);
                        lobbies[gameId].scores.splice(i,i);

                        // notifies player in that lobby that a player has left
                        for(var j = 0; j < lobbies[gameId].users.length; j++){
                            lobbies[gameId].users[j].emit("lobby user left", socket.username);
                        }

                        // lets all other players know that the lobby has a spot open
                        io.emit("left", gameId);
                        console.log(socket.username + " is leaving");
                    }
                    break;
                }
            }
        }catch(e){
            console.log(e.message);
        }
    
    });

    socket.on("list games", function(){
        var games = [];
        var hosts = [];
        var numUsers = [];
        for (var key in lobbies) {
            games.push(key);
            hosts.push(lobbies[key].host);
            numUsers.push(lobbies[key].users.length)
        }
        socket.emit('list', {
            'games' : games,
            "hosts" : hosts,
            "tot" : numUsers
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
            getNewSelector(winner.gameId); 
            newRoundUsers(winner.gameId)
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
        if(lobbies[data.gameId].users.length == 4){
            console.log("Lobby is full.")
            return;
        }
        
        // store the username in the socket session for this client
        socket.username = data.username;
        socket.addedUser = true;

        console.log("addnig to obby", socket.username)

        // adds user to the lobby
        lobbies[data.gameId].users.push(socket)
        lobbies[data.gameId].scores.push(0)

        io.emit("user added", {
            "game" : data.gameId,
            "tot" : lobbies[data.gameId]["users"].length
        });
        console.log(lobbies[data.gameId].scores)

        // randomly chooses an initial selector from the players
        if (lobbies[data.gameId].users.length == 4){
            // gets random question card
            newCard();

            // selects the players and selector
            newRoundUsers(data.gameId);
        }
    });
});