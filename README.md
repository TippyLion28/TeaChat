# TeaChat
A simple chatroom web app, written in NodeJS.

## Requirements

To run TeaChat, you will only need Node.js and npm installed in your environement.

### Node
- #### Node installation on Windows

  Just go to the official [Node.js website](https://nodejs.org/) and download the installer.

- #### Node installation on Ubuntu

  You can install nodejs and npm easily with apt install, just run the following commands.

      $ sudo apt install nodejs
      $ sudo apt install npm

- #### Other Operating Systems
  You can find more information about the installation on the official [Node.js website](https://nodejs.org/) and the official [NPM website](https://npmjs.org/).

If the installation was successful, you should be able to run the following commands.

    $ node --version
    v8.11.3

    $ npm --version
    6.1.0

If you need to update `npm`:

    $ npm install npm -g

## Starting the TeaChat Server
To start the server, `cd` into the `TeaChat/` directory and run `node index.js`.

## TODO
- Make the text cursor jump to the end of the text box as the user cycles through past messages with the arrow keys
- Detect when the user has modified the text box or submitted the message in order to reset the message history
- Add small icons/images/stickers that can be summoned using commands
- Unify the server-side code for joining the server and joining a new room
- Check mime types on images before broadcasting it to the room
- Add compression to image base64 send/recieve
- Admin/Moderator logon (with ban/kick permissions etc.)
- Use an external config file for changing things like port numbers and max lengths
- Add kick/ban functionality to the CLI
- Show a list of all other clients in the room on the client side
- UI redesign
- Dark/Light mode (command?)
- Show when chat participants are typing
- Desktop Notifications
- Rate limiting
- Allow the CLI to 'join' a room and view chat messages
- Whisper
- `/changeNick` command (and announce the name change to chat participants)
- MOTD
- Auto-detect connection loss
- Protect against clientside fiddling (recieving messages without being properly authenticated)
- Stop the address bar from collapsing on mobile
- Encryption (https/wss)
- Call scrollDown() whenever list is appended to rather than for every socket event
- Fix the sticky chat bar (make the buttons scale nicely on desktop/mobile)
### Games
- Quizzes
- Rock, Paper, Scissors
### Bots
- Google bot
- Translator bot
