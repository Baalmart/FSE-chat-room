var express = require("express");
var app = express();
//use port is 1234
var server = app.listen(1234);
var client = require("socket.io").listen(server).sockets;
//access file system
var fs = require("fs");
//sqlite as database
var sqlite3 = require("sqlite3");
//the db is named chats.db
var db = new sqlite3.Database("chats.db");
//users array to store all usernames
var users =new Array();

client.on("connection", function(socket) {

	socket.on("loginStart", function(data) {

			//create the users database if not existed
			db.serialize(function() {
				db.run("CREATE TABLE IF NOT EXISTS users (" + 
					"User TEXT NOT NULL) ");
			});

			//retrieve users from database
			var selectUsers = "SELECT * FROM users";
			db.each(selectUsers, function(err, row) {
				if (row !== undefined) {
					users[users.length] = row.User;	
				}
			}, 
			function(err, rows) {
				if (rows > 0) {
					if (users.indexOf(data) !== -1) {
						var message = "Sorry, the username already taken";
						socket.emit("logins", {accepted:false, message:message});
					}
					else{
						socket.emit("logins", {accepted:true, name:data});
						//accept the username and add it to the database
						db.serialize(function() {
								db.run("INSERT INTO users VALUES(?)", data);
						});
					}
				}
				  //if it's the first username
				else{
					socket.emit("logins", {accepted:true, name:data});
					//insert the new name in database
					db.serialize(function() {
							db.run("INSERT INTO users VALUES(?)", data);
						});
				}
			});
			

	});
	//end of login procees


	//start of chartings
	socket.on("chartStart", function(data) {
		var name = data;
		var exists = fs.existsSync("chats.db");
		if(!exists) {
			fs.openSync("chats.db", "w");
		}

		db.serialize(function() {
			db.run("CREATE TABLE IF NOT EXISTS chats (" + 
				"Timestamp TEXT NOT NULL, " + 
				"User TEXT NOT NULL, " + 
				"Message TEXT NOT NULL)");
		});

		var select_chats = "SELECT * FROM chats ORDER BY Timestamp DESC"
		var chatMsgs = []
		db.each(select_chats, function(err, row) {
			if (row !== undefined) {
				chatMsg = {
					name: row.User,
					timestamp: row.Timestamp,
					message: row.Message
				};
				chatMsgs[chatMsgs.length] = chatMsg;
			}
		}, function(err, rows) {
			if (rows > 0) {
				socket.emit("chats", chatMsgs);
			}
			client.emit("connected", name);
		});

		// Wait for post button to post arrived chat
		socket.on("post", function(data) {
			var message = data.message;
			var timestamp = data.timestamp;
			// send out new messages only
			client.emit("chats", [data]);
				db.serialize(function() {
					db.run("INSERT INTO chats VALUES(?, ?, ?)",timestamp, name, message);
				});
		});

		// Detect disconnection
		socket.on("disconnect", function(){
			users[name] = undefined;
			client.emit("left", name);
			//remove username in database
			db.serialize(function() {
					db.run("DELETE FROM users where user=?;",name);
				});
		});

	});
});

app.get("/", function(req, res) {
	res.sendFile(__dirname + "/index.html");
});
app.get("/index.html", function(req, res) {
	res.sendFile(__dirname + "/index.html");
});
app.use(express.static("."));
