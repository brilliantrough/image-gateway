#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.local"
ENV_FILE="$RUNTIME_DIR/image-gateway-3100.env"
PID_FILE="$RUNTIME_DIR/image-gateway-3100.pid"
LOG_FILE="$RUNTIME_DIR/image-gateway-3100.log"

mkdir -p "$RUNTIME_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  echo "Copy deploy/local-3100.env.example to $ENV_FILE and edit it first."
  exit 1
fi

load_env() {
  set -a
  source "$ENV_FILE"
  set +a
}

current_port() {
  load_env
  echo "${PORT:-3100}"
}

is_running() {
  [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

port_owner_pid() {
  local port
  port="$(current_port)"
  ss -ltnp 2>/dev/null | awk -v target=":${port}" '
    $4 ~ target {
      if (match($0, /pid=[0-9]+/)) {
        print substr($0, RSTART + 4, RLENGTH - 4)
        exit
      }
    }
  '
}

stop_process() {
  if is_running; then
    local pid
    pid="$(cat "$PID_FILE")"
    kill "$pid"
    for _ in $(seq 1 50); do
      if ! kill -0 "$pid" 2>/dev/null; then
        break
      fi
      sleep 0.2
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid"
    fi
  fi
  rm -f "$PID_FILE"
}

start_process() {
  if is_running; then
    echo "image-gateway is already running on PID $(cat "$PID_FILE")"
    return
  fi

  load_env
  local port
  local owner_pid
  port="${PORT:-3100}"
  owner_pid="$(port_owner_pid || true)"

  if [[ -n "${owner_pid:-}" ]]; then
    echo "Port $port is already in use by PID $owner_pid"
    echo "Stop that process first, or free the port before starting this managed instance."
    exit 1
  fi

  cd "$ROOT_DIR"
  : >"$LOG_FILE"
  setsid -f bash -lc "
    cd '$ROOT_DIR'
    set -a
    source '$ENV_FILE'
    set +a
    echo \$$ > '$PID_FILE'
    exec node dist/server.js >> '$LOG_FILE' 2>&1 < /dev/null
  "
  sleep 1

  if ! is_running; then
    echo "Failed to start image-gateway. See $LOG_FILE"
    exit 1
  fi

  echo "image-gateway started on http://127.0.0.1:${PORT:-3100}"
  echo "PID: $(cat "$PID_FILE")"
  echo "Log: $LOG_FILE"
}

build_app() {
  cd "$ROOT_DIR"
  npm run build
}

case "${1:-}" in
  start)
    start_process
    ;;
  stop)
    stop_process
    echo "image-gateway stopped"
    ;;
  restart)
    stop_process
    build_app
    start_process
    ;;
  rebuild)
    build_app
    ;;
  status)
    if is_running; then
      load_env
      echo "running"
      echo "PID: $(cat "$PID_FILE")"
      echo "URL: http://127.0.0.1:${PORT:-3100}"
      echo "Log: $LOG_FILE"
    else
      owner_pid="$(port_owner_pid || true)"
      if [[ -n "${owner_pid:-}" ]]; then
        echo "stopped (managed process not running)"
        echo "Port $(current_port) is occupied by PID $owner_pid"
      else
        echo "stopped"
      fi
      exit 1
    fi
    ;;
  logs)
    touch "$LOG_FILE"
    tail -n 80 "$LOG_FILE"
    ;;
  *)
    echo "Usage: bash deploy/local-3100.sh {start|stop|restart|rebuild|status|logs}"
    exit 1
    ;;
esac
