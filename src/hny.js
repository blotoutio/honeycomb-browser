import { HoneycombWebSDK } from "@honeycombio/opentelemetry-web";
import { trace } from "@opentelemetry/api";

function initializeTracing(
  params /* { apiKey: string, serviceName: string, debug: boolean } */
) {
  if (!params) {
    params = {};
  }

  if (!params.apiKey) {
    throw new Error(
      "Usage: initializeTracing({ apiKey: 'honeycomb api key', serviceName: 'name of this service' })"
    );
  }
  if (!params.serviceName) {
    console.log(
      "No service name provided to initializeTracing. Defaulting to unknown_service"
    );
    params.serviceName = "unknown_service";
  }

  const sdk = new HoneycombWebSDK({
    localVisualizations: params.debug,
    ...params,
  });
  sdk.start();

  sendInitialPing();

  instrumentGlobalErrors();
}

function instrumentGlobalErrors() {
  const tracer = trace.getTracer("errors");
  window.addEventListener("error", (e) => {
    const span = tracer.startSpan("Error on page");
    span.setAttributes({
      error: true,
      "error.message": e.message,
      "error.stack": e.error?.stack,
      "error.filename": e.filename,
      "error.line_number": e.lineno,
      "error.column_number": e.colno,
    });
    span.end();
  });
}

function sendInitialPing() {
  const tracer = trace.getTracer("pageLoad")
  const span = tracer.startSpan("Load");
  span.setAttributes({
    "page.url": window.location.href,
    "page.referrer": document.referrer,
    "page.title": document.title,
  });
  span.end();
}

function setAttributes(attributes) {
  const span = trace.getActiveSpan();
  span && span.setAttributes(attributes); // maybe there is no active span, nbd
}

function inSpan(tracerName, spanName, fn) {
  if (fn === undefined) {
    console.log("USAGE: inSpan(tracerName, spanName, () => { ... })");
  }
  return trace.getTracer(tracerName).startActiveSpan(spanName, (span) => {
    try {
      return fn();
    } catch (err) {
      span.setStatus({
        code: 2, //SpanStatusCode.ERROR,
        message: err.message,
      });
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
}

async function inSpanAsync(tracerName, spanName, fn) {
  if (fn === undefined) {
    console.log(
      "USAGE: inSpanAsync(tracerName, spanName, async () => { ... })"
    );
  }
  return trace.getTracer(tracerName).startActiveSpan(spanName, async (span) => {
    try {
      return await fn();
    } catch (err) {
      span.setStatus({
        code: 2, // trace.SpanStatusCode.ERROR,
        message: err.message,
      });
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
}

async function recordException(err) {
  const span = trace.getActiveSpan();
  span.setStatus({
    code: 2, // SpanStatusCode.ERROR,
    message: err.message,
  });
  span.recordException(err);
}

async function addSpanEvent(message, attributes) {
  const span = trace.getActiveSpan();
  span.addEvent(message, attributes);
}

/* I'm exporting 'trace' here, but I have a feeling some of the functionality on it is stripped off.
 * getActiveSpan() was missing, when I tried to use that outside of this project, while this project was not
 * using it.
 * Someday, don't export 'trace' because it is a lie. Or do, but document which parts of TraceAPI are gonna be on it.
 */
export const Hny = {
  initializeTracing,
  setAttributes,
  inSpan,
  inSpanAsync,
  recordException,
  addSpanEvent,
};
// Now for the REAL export
window.Hny = Hny;
