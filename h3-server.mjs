import {
    createApp,
    eventHandler,
    createRouter,
    toNodeListener,
    sendStream,
    setResponseHeader
} from 'h3';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { counter } from './utils/tools.mjs';

const app = createApp();

const router = createRouter()
    .get(
        '/',
        eventHandler(() => 'Hello World!')
    )
    .get(
        '/sse',
        eventHandler(async (event) => {
            setResponseHeader(
                event,
                'Content-Type',
                'text/event-stream;charset=utf-8'
            );
            setResponseHeader(event, 'Cache-Control', 'no-cache');
            setResponseHeader(event, 'Connection', 'keep-alive');
            setResponseHeader(event, 'Transfer-Encoding', 'chunked');
            return new Promise((resolve, reject) => {
                const counterStream = Readable.from(counter(10));
                sendStream(event, counterStream);
                counterStream.on('end', () => {
                    console.log('counterStream end');
                    resolve();
                });
                counterStream.on('error', (e) => {
                    console.log('counterStream error');
                    reject(e);
                });
                event.node.req.on('close', () => {
                  console.log('connection closed');
                    resolve();
                });
            });
        })
    );

app.use(router);
createServer(toNodeListener(app)).listen(process.env.PORT || 3000);
