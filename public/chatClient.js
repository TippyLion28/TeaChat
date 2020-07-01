/* Variables */
var username = prompt('Please enter a nickname'); //Ask for a nickname (This is done before making a connection to avoid timeouts)
var focused = true;  //Whether document is focused (Set via event Listener)
var newMessages = 0; //Number of new messages since the window was last focused
const originalTitle = document.title; //Keep the original page title
var allowReconnect = false; //Whether the client should attempt to reconnect on connection loss
var roomID = ''; //Remember the room ID so we can re-join the correct room in case of a disconnection
var autoScroll = true; //Whether to automatically scroll to the bottom of the page when a new message comes through
var messageHistory = []; //Stores all past messages
var messageFuture = []; //Used to temporarily store messages as the user shuffles through message history

/*Functions*/
function unFocus() { //When the window goes out of focus
	focused = false;
}
function focus(){ //When the window comes into focus
	focused = true;
	reJoin(); //This will reconnect us if we lost connection while the window was unfocused. Useful for mobile clients.
	newMessages = 0;
	document.title = originalTitle;
}

function scrollDown(){ //Create function for scrolling to the bottom of the page
	if (autoScroll === true){
		window.scrollTo(0,document.body.scrollHeight);
	}
}

window.onscroll = function(e) { //Whenever the page is scrolled
	if (this.oldScroll > this.scrollY && $(document).height() > $(window).height()){ //If the user scrolled up and there is a scrollbar on screen
		autoScroll = false; //Disable auto scrolling
	}
	else if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight){ //If the user scrolls to the bottom of the chat
		autoScroll = true; //Enable autoscrolling again
	}
	this.oldScroll = this.scrollY;
};

function join(){ // Create a function for submitting the nickname and room ID
	server.emit('join', username, roomID);
}

function showLoader(bool){ //Create a function for hiding and showing the loader
	if (bool === false)
	{
		$("#loader").hide();
	}
	else
	{
		$("#loader").show();
	}
}

function sendFile() {
	const file = document.getElementById('selectedFile').files[0]; //Grab the file
	const reader = new FileReader(); //Create a new file reader
	
	reader.addEventListener("load", function () { //When file is read by the file reader
		server.emit('image',reader.result); //Send base64 image to the server
		autoScroll = true; //Make sure the page can scroll down once the photo picker window has closed
	}, false);

	if (file) { //If file is set
		reader.readAsDataURL(file); //Send file to the file reader
	}
}

/*Socket Code*/
var server = io.connect(window.location.host, { //Specify the connection paramaters (window.location.host gets the hostname of the server)
	reconnection:false //Do not reconnect automatically, we will handle this manually
});

join(); //Once the variables and paramaters are initialised, join the server

server.on('authenticated', function(authed,authUsername) //When server has sent an authentication reply and sanitised username
{
	if (authed === true) //If the server has told us we are authenticated
	{
		if (allowReconnect === false){ //If this is the first time authenticating
			username = authUsername; //Set the local username to the server sanitised username
			$('#messages').append($('<li>').html('🟢 Welcome to the chat, ' + username + '! Type /help for information!'));
			allowReconnect = true; //The server has allowed us to connect once, therefore we should be able to re-connect using these credentials
		}
		else if (allowReconnect === true){
			$('#messages li:last-child').remove(); //Remove the disconnect message
			$('#messages').append($('<li style="color: grey; font-style:italic;">').html('You have been reconnected to the chat')); //Tell the user we reconnected
		}
		$("#submitTxt").attr("disabled", false); //Enable buttons
		$("#submitImage").attr("disabled", false);
	}
	else if (authed === false) //If we didn't get auth (The server will terminate the connection at this point)
	{
		allowReconnect = false; //The server didn't authenticate us using these credentials, no point trying again
	}
	scrollDown();
	showLoader(false);
});

server.on('roomChange', function(room) //When the server tells us we switched rooms
{
	roomID = room; //Save the current room ID in case we need it for reconnecting
});

$('form').submit(function(e){ //Submit a chat message to the server
	e.preventDefault(); //Prevents page reloading
	server.emit('chat_message', $('#txt').val()); //Send the message to the server
	if ($('#txt').val() !== '' && $('#txt').val() != messageHistory[messageHistory.length -1]){ //If the message isn't empty and isn't the same as the previous message
		messageHistory.push($('#txt').val()); //Store the message to the history
	}
	$('#txt').val(''); //Empty the text box
	autoScroll = true; //Re-enable auto scrolling
	return false;
});

server.on('chat_message', function(msg, isQuiet){ // Append recieved messages to the list
	$('#messages').append($('<li>').html(msg));
	scrollDown();
	if (focused === false && (isQuiet == false || isQuiet === undefined)){ //If the page isn't focused and the message isn't quiet, add a message counter to the HTML title
		newMessages++;
		document.title = '(' + newMessages + ') ' + originalTitle;
	}
});

server.on('disconnect', function(){ //Detect connection loss
	$("#submitTxt").attr("disabled", true); //Disable buttons
	$("#submitImage").attr("disabled", true);
	if (allowReconnect === true)
	{
		$('#messages').append($('<li onclick="reJoin()" style="cursor: pointer;">').html('⚠️ Connection Lost - Click this message to try again'));
		document.title = '(Disconnected) ' + originalTitle;
	}
	else
	{
		$('#messages').append($('<li onclick="location.reload();" style="cursor: pointer;">').html('⚠️ Server refused connection - Click this message to retry'));
	}
	scrollDown();
});

server.on('refresh', function(){ //When the server tells us to refresh
	window.setTimeout(function(){location.reload()}, 1000);
});

function reJoin(){ //Create function to rejoin and check connectivity
var count = 0; //Start retry counter at zero
if (server.connected === false && allowReconnect === true && focused === true){
	showLoader(true); //Show a loading spinner
	server.open(); //Attempt to open the connection
	function checkConnectivity() {
		if (count >= 5) //Check connection this many times
		{
			//Stop checking and hide the loading spinner
			showLoader(false);
		}
		else if(server.connected === false) {
			count = count+1;
			window.setTimeout(checkConnectivity, 1000); //Check the flag every second
		} 
		else if (server.connected === true) { //If the we managed to connect
			join();
		}
	}
	checkConnectivity(); //Check for connectivity
	}
}

/*Events*/
window.onresize = function(event) { //When the keyboard is opened on mobile, scroll down
	scrollDown();
};

document.onkeydown = function(event) {
	//Message history works by storing all past messages in an array. When cycling through previous messages using the arrow keys, the messages are shuffled between two arrays, messageHistory and messageFuture. When the user begins modifying or submits one of their previous messages, the two arrays are then concatenated back into messageHistory.
    if (event.keyCode == '38') { // up arrow
		$('#txt').val(messageHistory[messageHistory.length -1]); //Put the previous message into the text box
		if (messageHistory.length != 0){ //If the history is not empty
			messageFuture.push(messageHistory.pop()); //Shuffle the messages as the user cycles through old messages
		}
    }
    else if (event.keyCode == '40') { //down arrow
		if (messageFuture.length != 0){ //If the message future is not empty
			messageHistory.push(messageFuture.pop()); //Shuffle the messages as the user cycles through the next messages
		}
		$('#txt').val(messageFuture[messageFuture.length -1]); //Put the next message into the text box
    }
	else { //If the user presses any other key, assume the message has been sent or modified
		messageHistory = messageHistory.concat(messageFuture.reverse()); //Join all of the messages back into the first array
		messageFuture = []; //Empty the second array
	}
}

window.addEventListener('blur', unFocus); //When window is unfocused
window.addEventListener('focus', focus); //When window is focused