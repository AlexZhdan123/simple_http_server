'use strict';

const util = require('util');

const CRLF = '\r\n';
const LF = '\n';

function Request(data) {

    this.parseData = function (data) {
        if (typeof data == 'number' || typeof data == 'boolean') throw new Error('BRQ');
        if (data === null || data === undefined) return;

        let request = data.toString('utf-8');
        let array = request.split(/ |\r\n/);

        if(array.length < 3) throw new Error('BRQ');

        this.method = array[0];
        this.uri = array[1].split('?')[0];
    };

    this.parseData(data);
}

function Response(headers) {
    this.buildResponse = function () {
        this.status = headers.status;
        this.statusCode = headers.statusCode;
        this.contentType = headers.contentType;
        this.contentLength = headers.contentLength;
    };
    this.buildResponse();
}


Response.prototype.toString = function() {
    let objStr = 'HTTP/1.1 '+ this.status + ' ' + this.statusCode;
    for (let prop in this) {
        if(this.hasOwnProperty(prop) && typeof this[prop] != 'function'
            && prop != 'status' && prop != 'statusCode'
            && this[prop] !== undefined) {
            objStr += `${LF}` + prop + ': ' + this[prop];
        }
    }
    return objStr += `${CRLF}${CRLF}`;
};

exports.Request = Request;
exports.Response = Response;