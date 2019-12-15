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

app.get('/users',(request,response)=>{
    var usersCards = [];
    for(var i =0; i < 6; i++){
        usersCards.push(whitecards[Math.floor(Math.random() * whitecards.length)])
    }
    collection = {
        'black' : blackcard,
        'white' : usersCards
    }
    response.json(collection);
});

var numUsers=0;
var lobbies=[{
    id : "",
    users : []
}]; 

io.on('connection', function (socket) {

    // allows users to connect once
    var addedUser = false;

    // listen fo player answers
    socket.on('answer', function(card){
        console.log(card)
    });

    // adds user to the lobby by listening for emissions from client
    socket.on('add user', function (username) {

        // checks if user was added
        if (addedUser) {
            console.log(socket.username + " is already in lobby.");
            return;
        }
        // checks if lobby is full
        if(numUsers == 4){
            console.log("Lobby is full.")
            return;
        }
        
        // store the username in the socket session for this client
        socket.username = username;
        numUsers++;
        addedUser = true;

        // adds user to the lobby
        lobbies[0]["users"].push(socket)
        lobbies[0]["id"] = 0

        console.log(numUsers)
        console.log(socket.username)

        // randomly chooses an initial selector from the players
        if (numUsers == 4){
            // gets the initial black card
            newCard();

            // randomly selects a user to be the selector
            var selector = lobbies[0]['users'][Math.floor(Math.random() * lobbies[0]['users'].length)];
            console.log(selector.username);
            selector.emit("selector");

            // notifies the other clients that they are players
            for(var i = 0; i < lobbies[0]['users'].length; i++){
                if(lobbies[0]['users'][i] == selector){
                    continue;
                }
                else{
                    lobbies[0]['users'][i].emit("players", selector.username);
                }
            }
        }
    });
});