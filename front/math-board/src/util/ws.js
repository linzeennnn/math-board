export function createWS(url) {
  let ws = null;
  let listeners = new Set();

  function connect() {
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log("ws open");
    };

    ws.onmessage = (e) => {
      listeners.forEach(fn => fn(e));
    };

    ws.onclose = () => {
      console.log("ws closed, retry...");
      setTimeout(connect, 2000);
    };
  }

  connect();

  return {
    send(msg) {
      if (ws && ws.readyState === 1) {
        ws.send(msg);
      }
    },

    onMessage(fn) {
      listeners.add(fn);
    },

    close() {
      ws?.close();
    },

    get socket() {
      return ws;
    }
  };
}

export function getWSUrl(path = "/ws") {
  const protocol = window.location.protocol === "https:"
    ? "wss:"
    : "ws:";

  return `${protocol}//${window.location.host}${path}`;
}
