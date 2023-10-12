/*app.ts*/
import express, { Express } from 'express';
import { updateApiRequestsMetric, updateLatencyTime, updateTotalBytesSent } from './request-metrics';
import { createLogger, format, transports } from 'winston'
import WinstonCloudWatch from 'winston-cloudwatch';

const PORT: number = parseInt(process.env.PORT || '8080');
const app: Express = express();

const logger = createLogger({
  level: 'info',
  format: format.json(),
  defaultMeta: { service: 'sample-app' },
  transports: [
    new transports.Console(),
    new WinstonCloudWatch({
      level: 'info',
      logGroupName: '/metrics/otel',
      logStreamName: 'otel-using-node',
      awsRegion: 'us-east-2',
      jsonMessage: true
    }),],
});

function getRandomNumber(min: number, max: number) {
  return Math.floor(Math.random() * (max - min) + min);
}

function updateMetrics(res: any, apiName: any, requestStartTime: any) {
  updateTotalBytesSent(res._contentLength + mimicPayLoadSize(), apiName, res.statusCode);
  updateLatencyTime(new Date().getMilliseconds() - requestStartTime, apiName, res.statusCode);
  updateApiRequestsMetric();
}

function mimicPayLoadSize() {
  return Math.random() * 1000;
}

app.use((req: any, res: any, next) => {
  next();
  updateMetrics(res, req.url, new Date().getMilliseconds());
});

app.get('/rolldice', (req, res) => {
  logger.info('Rolldice request received');
  res.send(getRandomNumber(1, 6).toString());
  logger.info('Rolldice response generated received');
});

app.listen(PORT, () => {
  console.log(`Listening for requests on http://localhost:${PORT}`);
});
