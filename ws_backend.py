import asyncio
import json
import websockets

import uuid

peers = {}


async def handler(websocket):
    peer_uuid = None

    print(f'Client connected: {websocket.remote_address}')
    async for message in websocket:
        try:
            data = json.loads(message)

            print(message)
            message_type = data.get("type")

            if message_type == "get_peers":
                peers_list = list(peers.keys())
                await websocket.send(json.dumps({"type": "peer_list", "peers": peers_list}))

            elif message_type == "register":
                peer_uuid = str(uuid.uuid4())
                peers[peer_uuid] = websocket
                print(f'Client: {websocket.remote_address} uuid: {peer_uuid}')
                await websocket.send(json.dumps({"type": "registered", "uuid": peer_uuid}))
                for peer in peers.values():
                    await peer.send(json.dumps({"type": "peer_list", "peers": list(peers.keys())}))

            elif message_type in {"offer", "answer"}:
                target_peer = data.get("target")
                if target_peer and target_peer in peers:
                    await peers[target_peer].send(message)
                else:
                    print(f"Ziel-Peer {target_peer} nicht gefunden")

            elif message_type == "disconnect":
                if peer_uuid in peers:
                    del peers[peer_uuid]
                for peer in peers.values():
                    await peer.send(json.dumps({"type": "peer_list", "peers": list(peers.keys())}))

            elif message_type == "game_event":
                target_peer = data.get("target")
                await peers[target_peer].send(message)
            else:
                print(f"Unbekannter Nachrichtentyp: {message_type}")

        except json.JSONDecodeError as e:
            print(f"Fehler beim Dekodieren der Nachricht: {e}")
        except Exception as e:
            print(f"Fehler beim Verarbeiten der Nachricht: {e}")

    print(f'Client disconnected: {websocket.remote_address}')
    del peers[peer_uuid]

    # for peer in peers.values():
    #    await peer.send(json.dumps({"type": "peer_list", "peers": list(peers.keys())}))


start_server = websockets.serve(handler, "localhost", 8765)
# start_server = websockets.serve(handler, "192.168.178.76", 8765)
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
