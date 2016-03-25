const Promise = require('bluebird');
const path = require('path');
const needle = Promise.promisifyAll(require('needle'));
const chalk = require('chalk');
const dateformat = require('dateformat');

const low = require('lowdb');
const storage = require('lowdb/file-async');
const db = low(path.join(__dirname, 'requests.json'), { storage });
const requests = db('requests');

const requestInterval = 3000;
const maxRequestTimeout = 3000;
const tenSeconds = 10 * 1000;

const endpoints = ['application'];
// const endpoints = ['application', 'database', 'models'];
// const server = 'https://stemn.com/api/v1/health/';
const server1 = 'http://52.25.115.97/api/v1/health/';
const server2 = 'http://52.26.28.69/api/v1/health/';
const urls = endpoints.map((endpoint) => `${server1}${endpoint}`).concat(endpoints.map((endpoint) => `${server2}${endpoint}`));

const timeRequest = () => {
    const requestStart = Date.now();
    const randomUrl = urls[Math.floor(Math.random() * urls.length)];
    return needle.getAsync(randomUrl).then((response) => {
        const requestEnd = Date.now();
        const duration = requestEnd - requestStart;

        if (response.statusCode == 200) {
            return { url : randomUrl, start : requestStart, end: requestEnd, duration, body : response.body };
        } else {
            return Promise.reject({ url : randomUrl, start : requestStart, end: requestEnd, duration, message : `Bad response code: ${response.statusCode}` });
        }
    }).catch((err) => {
        const requestEnd = Date.now();
        const duration = requestEnd - requestStart;
        return Promise.reject({ url : randomUrl, start : requestStart, end: requestEnd, duration, message : err.message });
    });
}

const log = (data) => {
    const now = Date.now()
    const timestamp = dateformat(now, 'hh:MM:ss TT');
    console.log(`${chalk.yellow(timestamp)} | ${data.message} | ${data.response.url}`);

    return requests.push({ timestamp : now, response : data.response });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const checkServer = () => {
    return timeRequest()
    .then((result) => {
        if (result.duration < maxRequestTimeout) {
            log({ message : `${chalk.green('Got response:')} ${result.duration} ms`, response : result });
        } else {
            log({ message : `${chalk.red('Got response:')} ${result.duration} ms`, response : result });
        }
    })
    .catch((err) => {
        log({ message : `${chalk.red('Got error:')} ${err.message}`, response : err });
    })
    .then((result) => {
        // when requests exceed the timeout, request immediately again to see if the issue is temporally affected
        const nextRequestStartTime = result ? result.requestEnd + tenSeconds : Date.now();
        return wait(nextRequestStartTime).then(checkServer);
    });
}

checkServer();
