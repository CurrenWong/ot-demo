#!/usr/bin/env node

// 加载ot算法模块
var ot = require('@curren/ot');
// express服务
var express = require('express');
// 日志模块
var morgan = require('morgan');
// 静态服务器
var serveStatic = require('serve-static');
// 错误处理
var errorhandler = require('errorhandler');
// 网络通信
var socketIO = require('socket.io');
// 文件路径
var path = require('path');
// http服务
var http = require('http');
// 会话管理
var session = require('express-session');
// 会话保持、登陆管理
var passport = require('passport');
// 会话持久化
var Sequelize = require("sequelize");
// initalize sequelize with session store
var SequelizeStore = require("connect-session-sequelize")(session.Store);

// 获取express
var app = express();
// 创建服务
var appServer = http.createServer(app);
// ------Router------
// 开启日志
app.use(morgan('combined'));
// 将根目录下的访问请求转发到public，返回index.html
app.use('/', serveStatic(path.join(__dirname, './public')));
// 将对static目录的请求转发到public，返回css和js等文件
app.use('/static', serveStatic(path.join(__dirname, './public')));
// 登陆页面
app.use('/login', serveStatic(path.join(__dirname, './public/login.html')));
// 注册页面
app.use('/register', serveStatic(path.join(__dirname, './public/register.html')));
// 忘记密码
app.use('/forgot-password', serveStatic(path.join(__dirname, './public/forgot-password.html')));
// -------------------

// ------注册功能-------
// 用户表
var users = [];
// 用户注册
app.all('/register', (req, res) => {
    var user = {
        realName: req.query.realName,
        nickname: req.query.nickname,
        email: req.query.email,
        username: req.query.username,
        password: req.query.password,
        gender: req.query.gender,
        identity: req.query.identity,
        collegeId: req.query.collegeId
    };
    // 若邮箱未被注册
    if (users[user.email] === undefined) {
        users[user.email] = user;
        res.sendStatus(200);
    } else {
        // 若已被注册
        res.sendStatus(417);
    }
});

// 开发环境下，显示更加全面的错误信息
if (process.env.NODE_ENV === 'development') {
    app.use(errorhandler());
}


// 会话持久化

// create database, ensure 'sqlite3' in your package.json
var sequelize = new Sequelize({
    dialect: "sqlite",
    storage: "./session.sqlite",
    logging: console.log
});
// 会话保持数据库
var myStore = new SequelizeStore({
    db: sequelize,
});
// 创建会话
var sess = {
    secret: 'keyboard cat',
    cookie: {},
    store: myStore,
    resave: false, // we support the touch method so per the express-session docs this should be set to false
    proxy: true, // if you do SSL outside of node.
    saveUninitialized: true, // always create session to ensure the origin
};
app.use(session(sess));
// 创建数据库
myStore.sync();

// 测试保存会话
myStore.set(123, 456);

// 测试连接
try {
    sequelize.authenticate();
    console.log('Connection has been established successfully.');
} catch (error) {
    console.error('Unable to connect to the database:', error);
}

// passport
app.use(passport.initialize());
app.use(passport.session());

// 监听端口
var io = socketIO.listen(appServer);

// 文本框的默认内容
var str = "# This is a Markdown heading\n\n" +
    "1. un\n" +
    "2. deux\n" +
    "3. trois\n\n" +
    "Lorem *ipsum* dolor **sit** amet.\n\n" +
    "    $ touch test.txt";

// 调用ot接口
var socketIOServer = new ot.EditorSocketIOServer(str, [], 'demo', function (socket, cb) {
    cb(!!socket.mayEdit);
});

// 建立TCP连接时触发connection事件
io.sockets.on('connection', function (socket) {
    socketIOServer.addClient(socket);
    // 登陆
    socket.on('login', function (obj) {
        // 若用户名错误，则报错
        if (typeof obj.name !== 'string') {
            console.error('obj.name is not a string');
            return;
        }
        // 用户名正确，登陆成功，可以编辑
        socket.mayEdit = true;
        // 存储用户名
        socketIOServer.setName(socket, obj.name);
        // 返回登陆消息
        socket.emit('logged_in', {});
    });
});

// 若指定端口PORT，则端口为PORT，否则端口为3000
var port = process.env.PORT || 3000;
// 建立监听时输出
appServer.listen(port, function () {
    console.log("Listening on port " + port);
});
// 异常处理
process.on('uncaughtException', function (exc) {
    console.error(exc);
});
