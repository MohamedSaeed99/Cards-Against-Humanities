let sent = false;
let socket = io();
let selector = false;
let cardsPicked = [];
let gameId;
let picks;
let winner;

const btn = document.querySelector('button.connect_btn');

btn.addEventListener('click', setGame);

// adds user to a lobby
function setGame(e){
    var type = $(".mdc-text-field__input").val();
    if($.trim(type) == '' || type =='undefined'){
        $("#username-helper-text").empty();
        $("#username-helper-text").append(`<i class="material-icons">
                                            error_outline
                                        </i>` + `Invalid User`
                                        );
    }
    else{
        socket.emit('username used', {
        'username' : type,
        'gameId' : gameId
        });
    }
}

// lets user know if username was valid
socket.on("user status", function(status){
    if(status.status == true){
        socket.emit('add user', {
        'username' : status.user,
        'gameId' : gameId
        });
        $(".connect").hide();
        $("#username-helper-text").hide()
    }
    else{
        $("#username-helper-text").empty();
        $("#username-helper-text").append(`<i class="material-icons">
                                            error_outline
                                        </i>` + `Username Exists`
                                        );
    }
})

// sets the game up
socket.on('players', function (data) {
    $(".selector").text("Selector: " + data.selector);
    selector = false;
    $(".choose_btn").attr("disabled", true);
    $(".disp_winner").hide();
    getData();
    displayUsers(data.players, data.scores);
});

// updates players when someone leaves
socket.on('update player', function (data) {
    $(".selector").text("Selector: " + data.selector);
    selector = false;
    $(".disp_winner").hide();
    $(".choose_btn").attr("disabled", true);
    displayUsers(data.players, data.scores);
});

// updates selector when the previous selector leaves
socket.on('update selecor', function (data) {
    $(".selector").text("Selector: YOU");
    selector = true;
    $(".disp_winner").hide();
    $(".choose_btn").removeAttr("disabled");
    displayUsers(data.players, data.scores);
});

// sets the game for the selector
socket.on('selector', function (data) {
    $(".selector").text("Selector: YOU");
    selector = true;
    $(".disp_winner").hide();
    $(".choose_btn").removeAttr("disabled");
    getData();
    displayUsers(data.players, data.scores);
});

// selects the winning card for the players and sets everything for next round
socket.on("round over", function(data){ 
    $(".ans").each(function(){
        if($(this).find("p.player").text() == data.winner){
            $(this).removeClass("unselected").addClass("selected");
        }
    });

    $(".user_info").each(function(){
        if($(this).find(".name").text() == data.winner+":"){
            $(this).find(".score").text("Winner");
        }
    })

    setTimeout(function(){ 
        $(".group").remove();
        cardsPicked = [];
        sent = false;
    }, 2000);
});

// displays winner of the game
socket.on("game winner", function(user){
    $(".disp_winner").show();
    $(".winner").text(user + " IS THE WINNER");
});

// adds the lobby created to the menu selection
socket.on('game created', function(data){
    var list =`<li class="mdc-list-item">
                <span class="mdc-list-item__text">${data.username}</span>
                <span class="mdc-list-item__text count">${data.tot}</span>
                <p class='gameId'>${data.gameid}</p>
                </li>`
    $(".mdc-list").append(list);
});

// creates the cards of the answers selected by users
socket.on("selected answers", function(data){
    var newGroup = document.createElement("div"); 
    var att = document.createAttribute("class");   
    att.value = "group";                           
    newGroup.setAttributeNode(att);  
    for(var i = 0; i < data.cards.length; i++){
        var newCard = `<div class="mdc-card mdc-card__primary-action ans unselected">
                    <p class="content">${data.cards[i]}</p>
                    <p class='player'>${data.user}</p>
                    </div>`
        newGroup.innerHTML += newCard;
    }
    $(".answers").append(newGroup);
});

// displays the users in the lobby
function displayUsers(users, scores){
    $(".user_info").remove()
    for(var i= 0; i < users.length; i++){
        var playerInfo = `<div class="user_info">
                            <p class="name">${users[i]}:</p>
                            <p class="score">${scores[i]}</p>
                        </div>`

        $("#lobby_info").append(playerInfo);  
    }
}

// gets card information from the server
function getData(){
    var url = '/users/'+(6-$(".white").length).toString()
    $.ajax({
        url : url,
        method : 'GET',
        success : function(data){
        fillCards(data.white);
        setBlackCard(data.black);
        $(".game").css("display", "block");
        $(".connect").hide();
        $(".lobbies").hide();
        },
        error: function(err){
        console.log('Failed');
        }
    });
} 

// sets up the card for the black card
var setBlackCard = (data) => {
    $(".mdc-card.black").find("p.content").text(data[0]);
    picks = data[1];
}

// fills the cards given to users
var fillCards = (data) => {
    for(var i = 0; i < data.length; i++){
        var newCard = `<div class="mdc-card mdc-card__primary-action white">
                        <p class="content">${data[i]}</p>
                    </div>`
        $(".cards").append(newCard);
    }
}

// sets the gameid of the host of lobby
socket.on("host", function(id){
    gameId = id
});

// removes everyone when the host leaves
socket.on("kick everyone", function(){
    $(".white").remove();
    $(".user_info").remove();
    $(".game").hide();
    $(".lobbies").show();
    $(".connect").show();
    $(".connect_btn").attr("disabled", true);
    gameId = undefined;
});

// removes the lobby from the selection list
socket.on("remove lobby", function(gameId){
    $("li.mdc-list-item").each(function(){
        if($(this).find(".gameId").text() == gameId){
        console.log(gameId);
        $(this).remove();
        }
    });
});

// notifies the current lobby that a user has left
socket.on("lobby user left", function(user){
    var found;
    $(".user_info").each(function(){
        if($(this).find(".name").text() == user+":"){
            $(this).find(".score").text("Left");
            found = this;
        }
    });
    setTimeout(function(){ 
        $(found).remove();
    }, 1000);
});

// updates the number of users in the lobby when someone leaves
socket.on("left", function(game){
    $(".mdc-list-item").each(function(){
        if($(this).find(".gameId").text() == game){
            $(this).find(".count").text($(this).find(".count").text() - 1)
        }
    });
});

// updates the number of users in the lobby when someone joins
socket.on("user added", function(data){
    $(".mdc-list-item").each(function(){
        if($(this).find(".gameId").text() == data.game){
            $(this).find(".count").text(data.tot)
        }
    });
});

// kicks player when refreshing page
window.onbeforeunload = function(event){
    socket.emit("leave", gameId);
    gameId = undefined;
    return undefined;
};

// kicks player when closing the tab
window.addEventListener('beforeunload', function () {
    socket.emit("leave", gameId);
    gameId = undefined;
    return undefined;
});

// sets event handlers on the cards
$(document).ready(function(){

    // list the lobbies available for player coming into the game
    socket.emit("list games");
    socket.on('list', function(data){
        for(var i = 0; i < data.games.length; i++){
            var list =`<li class="mdc-list-item">
                    <span class="mdc-list-item__text">${data.hosts[i]}</span>
                    <span class="mdc-list-item__text count">${data.tot[i]}</span>
                    <p class='gameId'>${data.games[i]}</p>
                    </li>`
            $(".mdc-list").append(list);
        }
    });

    // selects the cards players selected and sends it to server
    $("body").on("click", ".mdc-card.white", function(){
        if(picks > 0 && selector == false){
            console.log('selected ' + picks.toString());
            console.log($(this).find(".content").text())
            cardsPicked.push($(this).find(".content").text())
            $(this).remove();
            picks--;
        }
        if(picks == 0 && selector == false && sent == false){
            console.log(cardsPicked)
            socket.emit('answer', cardsPicked);
            sent = true;
        }
    });

    // removes player from lobby when clicking leave
    $(".leave_btn").on("click", function(){
        socket.emit("leave", gameId);
        $(".white").remove();
        $(".user_info").remove();
        $(".game").hide();
        $(".lobbies").show();
        $(".connect").show();
        $(".connect_btn").attr("disabled", true);
    });

    // listens for lobby clicks
    $("body").on("click", ".mdc-list-item", function(){
        $('.mdc-list-item.selected').removeClass('selected');
        $(this).addClass('selected');
        $(".connect_btn").removeAttr("disabled");
        gameId = $(this).find(".gameId").text()
    });

    // selects the answer cards
    $("body").on("click", ".group", function(){
        if(selector == true){
            $('.ans.selected').removeClass('selected').addClass('unselected');
            $(this).find(".ans").removeClass('unselected').addClass('selected');

            winner = $(this).find(".player").first().text();
        }
    });

    $(".choose_btn").on("click", function(){
        socket.emit("round winner", {
        "winner" : winner,
        "gameId" : gameId
        });
    });

    $(".create_btn").on("click", function(){
        var type = $(".mdc-text-field__input").val();
        socket.emit('create game', type);
        $(".connect").hide();
    });
});