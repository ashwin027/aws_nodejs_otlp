import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import {
  PeriodicExportingMetricReader
} from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { AWSXRayIdGenerator } from '@opentelemetry/id-generator-aws-xray';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { AWSXRayPropagator } from '@opentelemetry/propagator-aws-xray';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';

const _resource = Resource.default().merge(new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: "js-sample-app",
}));

const _traceExporter = new OTLPTraceExporter();
const _spanProcessor = new BatchSpanProcessor(_traceExporter);

const _tracerConfig = {
  idGenerator: new AWSXRayIdGenerator(),
}
const _metricReader = new PeriodicExportingMetricReader({
  exporter: new OTLPMetricExporter(),
  exportIntervalMillis: 1000
});

const convertToXRayTraceIdFormat = (traceId: string) => {
  return `1-${traceId.substring(0, 8)}-${traceId.substring(8)}`
}


const sdk = new NodeSDK({
  textMapPropagator: new AWSXRayPropagator(),
  metricReader: _metricReader,
  instrumentations: [
    new HttpInstrumentation(),
    new AwsInstrumentation({
      suppressInternalInstrumentation: true
    }),
    new WinstonInstrumentation({
      // Optional hook to insert additional context to log metadata.
      // Called after trace context is injected to metadata.
      logHook: (span, record) => {
        if (typeof record.trace_id === 'string' && typeof record.span_id === 'string') {
          record.aws_xray_trace_id = `${convertToXRayTraceIdFormat(record.trace_id)}@${record.span_id}`
        }
      },
    }),
  ],
  resource: _resource,
  spanProcessor: _spanProcessor,
  traceExporter: _traceExporter,
});
sdk.configureTracerProvider(_tracerConfig, _spanProcessor);

sdk.start();

// gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing and Metrics terminated'))
    .catch((error) => console.log('Error terminating tracing and metrics', error))
    .finally(() => process.exit(0));
});