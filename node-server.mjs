import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { counter } from './utils/tools.mjs';

createServer((req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream;charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
    });
    const counterStream = Readable.from(counter(3));
    counterStream.on('end', () => {
        console.log('stream end');
        res.end();
    });
    counterStream.pipe(res);
    req.on('close', () => {
        console.log('close');
        res.end();
    });
}).listen(process.env.PORT || 3000);
