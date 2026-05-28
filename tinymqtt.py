import argparse
import asyncio
import json
import random
import threading
import time

import paho.mqtt.client as mqtt
from amqtt.broker import Broker


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 1883
DEFAULT_TOPIC = "v1/devices/me/telemetry"


broker_config = {
    "listeners": {
        "default": {
            "type": "tcp",
            "bind": f"0.0.0.0:{DEFAULT_PORT}",
        }
    },
    "plugins": {
        "amqtt.plugins.authentication.AnonymousAuthPlugin": {
            "allow_anonymous": True,
        },
        "amqtt.plugins.sys.broker.BrokerSysPlugin": {
            "sys_interval": 10,
        },
    },
}


def build_sensor_payload() -> str:
    payload = {
        "temperature": round(random.uniform(24.0, 32.0), 2),
        "humidity": round(random.uniform(45.0, 75.0), 2),
    }
    return json.dumps(payload, separators=(",", ":"))


def start_broker() -> None:
    async def broker_coro() -> None:
        broker = Broker(broker_config)
        await broker.start()
        print(f"MQTT broker started on 0.0.0.0:{DEFAULT_PORT}")

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(broker_coro())
    loop.run_forever()


def run_subscriber(host: str, port: int, topic: str) -> None:
    def on_connect(client, userdata, flags, rc):
        if rc == 0:
            print(f"Subscriber connected to {host}:{port}")
            client.subscribe(topic, qos=0)
            print(f"Subscribed to {topic}")
        else:
            print(f"Subscriber connection failed with rc={rc}")

    def on_message(client, userdata, msg):
        print(f"Received {msg.topic}: {msg.payload.decode('utf-8', errors='replace')}")

    client = mqtt.Client("PythonSubscriber")
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(host, port)
    client.loop_forever()


def publish_payload(host: str, port: int, topic: str, payload: str) -> None:
    client = mqtt.Client("PythonPublisher")
    client.connect(host, port)
    client.loop_start()
    result = client.publish(topic, payload, qos=0)
    result.wait_for_publish()
    client.loop_stop()
    client.disconnect()

    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        print(f"Published {topic}: {payload}")
    else:
        raise RuntimeError(f"Publish failed with rc={result.rc}")


def run_publisher(host: str, port: int, topic: str, payload: str | None, interval: float) -> None:
    while True:
        publish_payload(host, port, topic, payload or build_sensor_payload())
        if interval <= 0:
            return
        time.sleep(interval)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a tiny MQTT broker and publish telemetry data.")
    parser.add_argument("--host", default=DEFAULT_HOST, help="MQTT broker host for the client connection.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="MQTT broker port.")
    parser.add_argument("--topic", default=DEFAULT_TOPIC, help="Topic to publish and subscribe to.")
    parser.add_argument("--payload", help="Payload to publish. Defaults to generated temperature/humidity JSON.")
    parser.add_argument("--interval", type=float, default=5.0, help="Seconds between publishes. Use 0 to publish once.")
    parser.add_argument("--no-local-broker", action="store_true", help="Publish to an existing broker instead of starting one.")
    parser.add_argument("--no-subscriber", action="store_true", help="Do not start the local subscriber printer.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if not args.no_local_broker:
        broker_thread = threading.Thread(target=start_broker, daemon=True)
        broker_thread.start()
        time.sleep(2)

    if not args.no_subscriber:
        subscriber_thread = threading.Thread(
            target=run_subscriber,
            args=(args.host, args.port, args.topic),
            daemon=True,
        )
        subscriber_thread.start()
        time.sleep(1)

    run_publisher(args.host, args.port, args.topic, args.payload, args.interval)


if __name__ == "__main__":
    main()
