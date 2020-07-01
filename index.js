const express = require('express'); //WebApp module
const app = express();
const http = require('http').Server(app); //Express HTTP Server
const io = require('socket.io')(http, { //Socket Library
	pingInterval: 2500, //PingInterval at 2.5 seconds. Mobile clients may disconnect if this is above 5 seconds.
	maxHttpBufferSize: 16*1000000 //Max message size before disconnect in bytes
}); 
const htmlspecialchars = require ('htmlspecialchars'); //For escaping HTML characters
var isBase64 = require('is-base64'); //For checking if a string is valid base64
const md = require('markdown-it')({ //For markdown parsing
	html: false,
	breaks: false,
	linkify: true
});
//Configure markdown-it to open links in a new tab
var defaultRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {return self.renderToken(tokens, idx, options);};md.renderer.rules.link_open = function (tokens, idx, options, env, self) {var aIndex = tokens[idx].attrIndex('target');if (aIndex < 0) {tokens[idx].attrPush(['target', '_blank']);} else{tokens[idx].attrs[aIndex][1] = '_blank';}return defaultRender(tokens, idx, options, env, self);}; 

//Configurables
const maxNameLength = 32; //Maximum length of nicknames and room names etc.
const maxMessageLength = 1000; //Maximum length of chat messages

app.get('/', function(req, res) {
    res.render('index.ejs'); //Render this page as response to HTTP get
});
app.use(express.static('public')); //Include the css folder
io.sockets.on('connection', function(client) { //On connection

	function sendMessage(dst, message, type) { //Function which sends a message to the specified clients with optional text fanciness
		var isQuiet = false; //Specify whether the message should trigger a notification
		switch(type) //Specify the type of message for added decoration
		{
			case 'subtle':
				output = '<i style="color: grey;">' + message + '</i>';
				isQuiet = true;
			break;
			case 'warning':
				output = '⚠️ ' + message;
			break;
			case 'urgent':
				output = '<b style="color: red">' + message + '</b>';
			break;
			default: //If the type of message is unspecified
				output = message;
			break;
		}
		switch(dst) //Specify where the message should go
		{
			case 'client':
				client.emit('chat_message', output, isQuiet);
			break;
			case 'others':
				client.to(client.roomID).emit('chat_message', output, isQuiet);
			break;
			case 'room':
				io.in(client.roomID).emit('chat_message', output, isQuiet);
			break;
			case 'server':
				io.emit('chat_message', output, isQuiet);
			break;
			default:
				throw 'Invalid/Unspecified Destination'; //If no destination is specified, throw an exception
			break;
		}
	}
	
	function chat(message){ //Turn chat messages into a function so it can be used by commands logic (for emotes etc)
		sendMessage('room', '<strong>' + client.username + '</strong>: ' + message); //Send a message appearing to come from this client
	}
	
	function announceJoin(){ //Announce the onboarding
		sendMessage('others', client.username + ' has joined the room...', 'subtle');
	}
	function announceLeave(){ //Anounce client leaving
		sendMessage('others', client.username + ' has left the room...', 'subtle');
	}
	
	function clean(name){
		if (name === null || name === undefined || name.length > maxNameLength) //If the supplied username is null or undefined, set it to an empty string in order to avoid crashes
		{
			name = '';
		}
		else
		{
			name = name.replace(/[^a-zA-Z0-9 ]/g, ''); //Remove symbols except spaces and numbers
			name = htmlspecialchars(name); //Escape HTML
			name = name.trim(); //Remove leading and trailing whitespace
			name = name.replace(/ +(?= )/g,''); //Collapse multiple spaces down to one because trim is dopey
		}
		return name;
	}

    client.on('join', function(username,roomID) { //When credentials are recieved
        client.username = clean(username);
        if (client.username === '' || username === undefined ) //If the username is empty or just whitespace
        {
            //Kick the client
			client.emit('authenticated',false);
			console.log(client.request.connection.remoteAddress + ' was refused authentication (Invalid Username)');
            client.disconnect();
        }
		else if (roomID === undefined)
		{
			client.emit('authenticated',false);
			console.log(client.request.connection.remoteAddress + ' was refused authentication (Unspecified Room Number)');
            client.disconnect();
		}
		else {
            //Authenticate client and announce the onboarding
			client.roomID = clean(roomID); //Sanitise the room ID
			client.join(client.roomID); //Join the client to the room
			client.emit('roomChange', client.roomID); //Tell the client to update their local copy of the room ID
			client.emit('authenticated',true,client.username); //Tell the client they have authenticated
            console.log(client.username + ' (' + client.request.connection.remoteAddress + ') has connected');
			announceJoin();
        }
    });

    client.on('disconnect', function(username) { //When the client disconnects
        if (client.username === '' || client.username === undefined) //If the username was invalid, don't bother announcing to other clients
        {
            //Do nothing
        } 
		else {
            //Announce the disconnect
            console.log(client.username + ' (' + client.request.connection.remoteAddress + ') has disconnected');
			announceLeave();
        }
    })
	
	client.on('image', function(base64){ //When the client sends an image
	try{
		if (isBase64(base64, {mimeRequired: true}) === true){ //If the string is a valid piece of base64
			chat('<p><img onload="scrollDown()" class="chatImage" src="' + base64 + '" alt="[Invalid Image]" /></p>'); //Send the image and trigger the clientside scrollDown function
		}
		else{
			sendMessage('client', 'Invalid image!', 'warning'); //If the base64 is invalid, don't send the image
		}
	}
	catch{
		sendMessage('client', 'Due to a <a href="https://github.com/nodejs/node/issues/759" target="_blank">bug,</a> images larger than ~3MB are not supported!', 'warning'); //Due to a bug in V8, large regex operations can cause crashes
	}
	});

    client.on('chat_message', function(message) { //When a chat message is recieved
        if (client.username !== undefined) //Check whether the client is valid
        {
			if (message.length > maxMessageLength)
			{
				sendMessage('client', 'Message is too long!', 'warning'); //Tell the client that their empty message won't be submitted
			}
			else if (message.trim() === '') //If message is empty after a trim
			{
				sendMessage('client', 'Empty messages won\'t be submitted!', 'warning'); //Tell the client that their empty message won't be submitted
			}
			else if (message.charAt(0) === '/') //If the message begins with a slash, it's a command
			{
				message = message.split(" ") //Break the command up into words
				message[0] = message[0].toLowerCase(); //Convert the command to lowercase
				switch (message[0]) {
					//Commands List
					case '/commands':
						sendMessage('client', '<u>Commands:</u><br/>/commands - Show a list of commands<br/>/help - Show some help<br/>/join [Room Name] - Connect to the specified room. Leave room name blank to return to the main lobby<br/>/room - Show the current room name<br/>/emotes - Show a list of emoticons<br/>');
					break;
					
					//General Commands
					case '/help':
						sendMessage('client', 'Welcome to TeaChat, a simple chatroom web app, written in NodeJS. Type /commands for a list of commands.');
					break;
					case '/join':
						message[0] = ''; //Remove the /join command from the message, so the rest of the command can be used as the room name
						message = message.join(" "); //Join the command array back together as a string
						message = clean(message); //Sanitise the room name
						if (message === client.roomID){ //If the client is already in the requested room
							if (message === '') //If the room ID is unspecified
							{
								sendMessage('client', 'You are already in the main lobby', 'warning');
							}
							else
							{
								sendMessage('client', 'You are already in this room', 'warning');
							}
						}
						else
						{
							announceLeave(); 
							client.leave(client.roomID);
							client.roomID = message;
							client.join(client.roomID);
							announceJoin();
							client.emit('roomChange', client.roomID); //Tell the client to update their local copy of the room ID
							if (client.roomID === '')
							{
								sendMessage('client','You have joined the main lobby', 'subtle');
								console.log(client.username + ' has joined the main lobby');
							}
							else
							{
								sendMessage('client', 'You have joined the room: ' + client.roomID, 'subtle');
								console.log(client.username + ' has joined room: ' + client.roomID)
							}
						}
					break;
					case '/room': //Remind the client which room they are in
						if (client.roomID === '')
						{
							sendMessage('client', 'You are in the main lobby');
						}
						else
						{
							sendMessage('client', 'You are in the room: ' + client.roomID);
						}
					break;
					
					//Emotes
					case '/emotes':
						sendMessage('client', '/shrug - ¯\\_(ツ)_/¯<br/>/tableflip - (╯°□°）╯︵ ┻━┻<br/>/lenny  - ( ͡° ͜ʖ ͡°)<br>/lod - ಠ_ಠ');
					break;
					case '/lenny':
						chat('( ͡° ͜ʖ ͡°)');
					break;
					case '/shrug':
						chat('¯\\_(ツ)_/¯');
					break;
					case '/tableflip':
						chat('(╯°□°）╯︵ ┻━┻');
					break;
					case '/lod':
						chat('ಠ_ಠ');
					break;
						
					//Fallback
					default:
						sendMessage('client', 'Unknown command - Type /commands for a list of valid commands.');
					break;
				}
				
			}
			else
			{
				//Send message to all clients after stripping html tags and then linkifying the text
				chat(md.renderInline(htmlspecialchars(message)));
			}
        }
    });
});

//Create the server
const server = http.listen(8080, function() {
    console.log('Listening on *:8080');
});

//Announce the server shutdown when CTRL+C is pressed
process.on('SIGINT', function() {
	console.log('Server Closing');
	io.emit('chat_message','<b style="color: red">⚠️ SERVER IS SHUTTING DOWN</b>');
	process.exit();
});

//Command Line Interface
var stdin = process.openStdin();
stdin.addListener("data", function(command) {
		var words = command.toString() //Convert the raw stdin stream into a string
		words = words.replace(/\r?\n|\r/g, ""); //Get rid of the newline weirdness created by stdin
		words = words.split(" "); //Break the command down into words
		switch(words[0]) //Get the first word of the command
		{
			//Commands List
			case 'help':
				console.log('*Commands List*\nhelp - Show a list of commands\nsay [message] - Say a message to the server\nrooms - Show a list of rooms\nrefresh - Refresh all connected clients');
			break;
			
			//General Commands
			case 'say':
				words[0] = '';
				words = words.join(" ");
				io.emit('chat_message','<b style="color: red">[SERVER]: ' + words + '</b>');
			break;
			case 'rooms':
				console.log(Object.keys(io.sockets.adapter.rooms));
			break;
			case 'refresh':
				console.log('Announcing the refresh');
				io.emit('chat_message','<b style="color: red">⚠️ The server has issued a refresh. Your browser will refresh in a few seconds.</b>');
				setTimeout(function(){io.emit('refresh'); console.log('Clients have been refreshed')}, 3000);
			break;
			
			//Fallback
			default:
				console.log('Unknown command - Type help for a list of valid commands.');
			break;
		}
});