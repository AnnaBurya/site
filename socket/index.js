var log = require('lib/log')(module);
var config = require('config');
var connect = require('connect');
var async = require('async');
var cookie = require('cookie');
var sessionStore = require('lib/sessionStore');
var HttpError = require('error').HttpError;
var User = require('models/user').User;
var Record = require('models/record').Record;
var mongoose = require('lib/mongoose');
var moment = require('moment');
moment.locale('ru');


function loadSession(sid, callback) {
    sessionStore.load(sid, function (err, session) {
        if (arguments.length == 0) {
            return callback(null, null);
        } else {
            return callback(null, session);
        }
    });

}
function loadUser(session, callback) {

    if (!session.user) {
        log.debug("Session %s is anonymous", session.id);
        return callback(null, null);
    }

    log.debug("retrieving user ", session.user);

    User.findById(session.user, function (err, user) {
        if (err) return callback(err);

        if (!user) {
            return callback(null, null);
        }
        log.debug("user findbyId result: " + user);
        callback(null, user);
    });

}

module.exports = function (server) {
    var io = require('socket.io').listen(server);
    var username = '';
    // Send current time to all connected clients


    io.set('authorization', function (handshake, callback) {
        async.waterfall([
            function (callback) {
                handshake.cookies = cookie.parse(handshake.headers.cookie || '');
                var sidCookie = handshake.cookies[config.get('session:key')];
                var sid = connect.utils.parseSignedCookie(sidCookie, config.get('session:secret'));
                loadSession(sid, callback);
            },
            function (session, callback) {

                if (!session) {
                    callback(new HttpError(401, "No session"));
                }

                handshake.session = session;
                loadUser(session, callback);
            },
            function (user, callback) {
                if (!user) {
                    callback(new HttpError(403, "Anonymous session may not connect"));
                }

                handshake.user = user;
                username = user.username;
                callback(null);
            }

        ], function (err) {
            if (!err) {
                return callback(null, true);
            }

            if (err instanceof HttpError) {
                return callback(null, false);
            }

            callback(err);
        });

    });

    io.sockets.on('session:reload', function (sid) {
        var clients = io.sockets.clients();

        clients.forEach(function (client) {
            if (client.handshake.session.id != sid) return;

            loadSession(sid, function (err, session) {
                if (err) {
                    client.emit("error", "server error");
                    client.disconnect();
                    return;
                }

                if (!session) {
                    client.emit("logout");
                    client.disconnect();
                    return;
                }

                client.handshake.session = session;
            });

        });

    });


    io.sockets.on('connection', function (socket) {
            mongoose.connection.db.dropDatabase();

            socket.on('message', function (text, cb) {
                var date = moment();
                var record = new Record({username: username, message: text, created: date});
                record.save(function (err) {
                    if (err) {
                        return console.log(err);
                    }
                });
                socket.emit('message', username, text, date);
            });
            socket.on('disconnect', function () {
                socket.broadcast.emit('leave', username);
            });
            socket.join('timer');
            setInterval(function () {
                nowDate = moment();
                Record.find({username: username}, function (err, users) {
                    var i = 0;
                    for (user in users) {
                        var sendTime = (nowDate.diff(users[user].created));
                        if (sendTime < 1000) { // прошло менее 1 секунды
                            sendTime = 'только что';
                        }

                        var sec = Math.floor(sendTime / 1000);

                        if (sec < 60) {
                            sendTime = sec + ' сек. назад';
                        }

                        var min = Math.floor(sendTime / 60000);
                        if (min < 60) {
                            sendTime = min + ' мин. назад';
                        }
                        var hour = Math.floor(sendTime / 3600000);
                        if (hour < 24) {
                            sendTime = min + ' часов назад';
                        }
                        if (hour >= 24) {
                            // форматировать дату, с учетом того, что месяцы начинаются с 0
                            var d = users[user].created;
                            d = [
                                '0' + d.getDate(),
                                '0' + (d.getMonth() + 1),
                                '' + d.getFullYear(),
                                '0' + d.getHours(),
                                '0' + d.getMinutes()
                            ];

                            for (var i = 0; i < d.length; i++) {
                                d[i] = d[i].slice(-2);
                            }

                            sendTime = d.slice(0, 3).join('.') + ' ' + d.slice(3).join(':');
                        }
                        io.sockets.in('timer').emit("updateTime", sendTime, i);
                        i++;
                    }
                });

            }, 1000);

        }
    )
    ;


    return io;
}
;
