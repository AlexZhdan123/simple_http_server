let fs = require('fs');
let net = require('net');
let parser = require('./parser.js');
let mime = require('mime');
let errTemplates = require('./errorPages/errorTemplates');

const PORT = 8124;

let server = net.createServer().listen(PORT);

server.on('listening', () => {
   console.log('server listening on port: ' + PORT);
});

server.on('error', (err) => {
    console.log(err);
});

server.on('connection', (socket) => {
    socket.setTimeout(20*1000);
    let body =[];
    console.log('connected new client:', socket.address());

    socket.on('data', (data) => {
        body.push(data);
        //check http request end
        if (data.includes(Buffer.from('13,10,13,10').slice(data.length - 4, data.length))) {
            let reqString = Buffer.concat(body).toString();
            let req;
            try {
                req = new parser.Request(reqString);
            } catch (e) {
                console.log(e);
                processWithErrorPage(socket, e.message == 'BRQ' ? 400 : 500);
                return;
            }
            processRequest(req, socket);
        }
    });

    socket.on('close', () => console.log('connection closed'));
    socket.on('error', (err) => console.log(err));
    socket.on('timeout', () => {
        console.log('Socket timeout');
        socket.end();
    });
});


function processRequest(req, socket) {
    if (req.method != 'GET') {
        processWithErrorPage(socket, 405);
    } else {
        console.log('requested resource : '+ req.uri);
        //ignore default browser request for fav.ico
        if(req.uri === '/favicon.ico') {
            socket.end();
            return;
        }
        let filePath = '.' + req.uri;
        fs.stat(filePath, (err, stats) => {
            if(err) {
                console.log(err);
                processWithErrorPage(socket, err.code == 'ENOENT' ? 404 : 500);
                return;
            }
            processFile(filePath, stats, socket);
        });
    }
}

function processFile(filePath, stats, socket) {
    if(stats.isDirectory()) {
        processWithErrorPage(socket, 404);
        return;
    }

    let readStream = fs.createReadStream(filePath);

    readStream.on('open', () => {
        let contentType = mime.getType(filePath);
        let headers = {
            status: 200,
            statusCode: 'OK',
            contentType: contentType,
            contentLength: stats.size
        };

        let resp = new parser.Response(headers);
        socket.write(resp.toString());
    });

    readStream.on('data', (chunk) => {
        socket.write(Buffer.from(chunk), socketWriteCallback(readStream, socket));
    });

    readStream.on('end', () => {
        socket.end();
    });

    readStream.on('error', (err) => {
        console.log(err);
        processWithErrorPage(socket, err.code == 'ENOENT' ? 404 : 500);
    });
}

function processWithErrorPage(socket, errorCode) {

    let errorTemplate = errTemplates[errorCode];
    if(errorTemplate === undefined) {
        errorTemplate = errTemplates[500];
    }

    let contentType = mime.getType(errorTemplate.pagePath);

    fs.readFile(errorTemplate.pagePath, (err, fileData) => {
        if (err) throw err;
        let resp = new parser.Response({
            status: errorTemplate.code,
            statusCode: errorTemplate.msg,
            contentType: contentType,
            contentLength: fileData.length
        });
        socket.write(resp.toString());
        socket.write(Buffer.from(fileData));
        socket.end();
    });
}

function socketWriteCallback(stream, socket) {
    if(socket.destroyed) {
        console.log('close stream');
        stream.close();
    }
}