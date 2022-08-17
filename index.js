'use strict';
var http = require('http');
var express = require("express");
const app = express();
var moment = require('moment');
require('moment-timezone'); 
moment.tz.setDefault("Asia/Seoul");
const server = http.createServer(app);
const io = require('socket.io')(server);
var port = process.env.PORT || 3000;

server.listen(port, function() {
  console.log('서버를 %s 포트에서 실행합니다.', port);
});

// DB 연결
var mysql = require('mysql');
const pool = mysql.createPool({
  connectionLimit: 100,
  host: 'DB 아이피 masking 처리',
  user: 'skorea6',
  password: 'DB 비밀번호 masking 처리',
  database: 'live_education'
});


function random_string(length){
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

var lastchat_sql = 'SELECT room, user_id, user_nick, created_time, ipaddress, message, user_token FROM chatlog WHERE room = ? AND log_type = ? ORDER BY id desc limit ?';

io.set('transports', ['websocket']);
io.on('connection', socket => {
	
    socket.emit('connection', {
        type : 'connected'
    });
	
    socket.on('connection', data => {
		
		pool.getConnection(function(err2,conn){

			if(!err2){
				
				var connection_room = data.room;
				var connection_user_secret = data.user_secret;
				var connection_user_ipaddress = socket.handshake.headers["x-forwarded-for"];
				
				var connection_user_utoken = random_string(24);
				var connection_user_nick = "";
				var connection_user_id = "";
				
				
				// 마지막 채팅 불러오기
				conn.query(lastchat_sql, [connection_room, "message", 7], function(err, lrows, fields){
					
					if(err){
						console.log("[Error] DB 조회 실패 9086");
					}else {
						var lastchat_list = [];
						
						if(lrows != ""){
							lrows.forEach(function(item) {
								lastchat_list.push({
									type : '1',
									name: item.user_nick,
									message: item.message,
									utoken: item.user_token,
									id: item.user_id
								});
							});
						}
						
						if(connection_user_secret == null || connection_user_secret == ""){
							socket.emit('입퇴장', {
								type : '5',
								message : `<span style="color:grey;">게스트님이 채팅방에 접속하셨습니다.`,
								lastchat: lastchat_list
							});
						
						}else{
				
							// 시크릿값 확인 후 유저 NICK 지정
							var member_ck_sql = 'SELECT * FROM members WHERE secret = ?';
							conn.query(member_ck_sql, connection_user_secret, function(err, rows1, fields){
								if(err){
									console.log("[Error] DB 조회 실패 9009");
								}else {
									if(rows1 != ""){
										connection_user_id = rows1[0].member_id;
										connection_user_nick = rows1[0].nick;
										
										// 올바른 채팅방 번호인지 확인
										var sql = 'SELECT id FROM live_broadcast WHERE id = ?';
										var params = [connection_room];
										conn.query(sql, params, function(err, livetvRow, fields){
											if(err){
												console.log("[Error] 잘못된 채팅방 접속 8000");
											}else {
												socket.join(connection_room);
												socket.room = connection_room;
												
												// 내가 처음 접속
												socket.emit('입퇴장', {
													type : '5',
													nick : connection_user_nick,
													message : `<span style="color:grey;">${connection_user_nick}님이 채팅방에 접속하셨습니다.`,
													utoken : connection_user_utoken,
													myself: true,
													id: connection_user_id,
													lastchat: lastchat_list
												});
												
												// 시간
												var dt = moment().toDate();
												
												// DB 참여자 목록 업데이트 (ENTER)
												var sql = 'INSERT INTO chatuser (room, user_id, user_nick, user_socket, user_token, created_time, ipaddress) values (?, ?, ?, ?, ?, ?, ?)';
												var params = [connection_room, connection_user_id, connection_user_nick, socket.id, connection_user_utoken, dt, connection_user_ipaddress];
												conn.query(sql, params, function(err, rows, fields){
													if(err){
														console.log("[Error] 로그 DB 조회 실패 9013");
													}
												});

											}
										});
										
									}else{
										console.log("[Error] 로그 DB 조회 실패 8415");
									}
									
								}
							});
							
						}
						
						conn.release();
					}
				});
			}
			
		});
    });

	// 일반 채팅 전송 (USER/ADMIN)
    socket.on('user', data => {
		pool.getConnection(function(err2,conn){
			if(!err2){
		
				var user_nick = '';
				var user_message = data.message;
				var room = socket.room;
				
				if(room != null) {
					var user_id = '';
					var user_token = '';
					var user_socket = '';
					var user_ipaddress = '';
					
					var sql = 'SELECT * FROM chatuser WHERE user_socket = ?';
					var params = [socket.id];
					conn.query(sql, params, function(err, item, fields){
						if(err){
							conn.release();
							console.log("[Error] 찾을 수 없는 유저가 채팅을 쳤습니다.");
						}else {
							if(item[0] != "" && item[0] != null){
								user_nick = item[0].user_nick;
								user_id = item[0].user_id;
								user_token = item[0].user_token;
								user_socket = item[0].user_socket;
								user_ipaddress = item[0].ipaddress;
										
								if(user_token != ''){
									// 120글자 이하로만 전송 가능
									if(user_message.length < 121){
										var dt = moment().toDate();
										
										// DB 로그 저장 (MESSAGE)
										var sql = 'INSERT INTO chatlog (room, log_type, user_id, user_nick, message, user_socket, user_token, created_time, ipaddress) values (?, ?, ?, ?, ?, ?, ?, ?, ?)';
										var params = [room, 'message', user_id, user_nick, user_message, user_socket, user_token, dt, user_ipaddress];
										conn.query(sql, params, function(err, rows, fields){
											if(err){
												conn.release();
												console.log("[Error] 로그 DB 조회 실패 9025");
											}
										});
										
										// 소켓 내보내기 (Broadcast)
										var send_udata = {type: '1', name: user_nick, message: user_message, utoken: user_token, id: user_id};
										
										socket.emit('message', send_udata);
										socket.broadcast.to(room).emit('message', send_udata);
									}else{
										socket.emit('전송에러', {msg: "120글자 이하로만 채팅을 보낼 수 있습니다."});
									}
								}
								
							}
							conn.release();
						}
						
					});
				}
				
			}
			
        });
    });
	
	// 유저가 직접 연결 해제 (USER)
	socket.on('disconnect', function() {
		pool.getConnection(function(err2,conn){
			if(!err2){
				var sql = 'DELETE FROM chatuser WHERE user_socket = ?';
				conn.query(sql, socket.id, function(err, rows, fields){
					if(err){
						conn.release();
						console.log("[Error] 로그 DB 조회 실패 9049");
					}else{
						conn.release();
					}
				});
			}
			
		});
	});

});