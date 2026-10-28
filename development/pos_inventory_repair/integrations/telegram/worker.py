#!/usr/bin/env python3
"""
==============================================================================
FRUIT CITY — LOCAL OUTBOUND WORKER (PYTHON STANDARD LIBRARY)
==============================================================================
الإصدار: 1.2.0 (معالجة تدقيق Codex: احترام حصص السحابة، البصمة السحابية، ومنع التعارض)

الميزات:
- استطلاع صادر فقط عبر POST Body محمي بختم زمني ورمز Nonce فريد.
- وتيرة استطلاع واعية بحصص Google Apps Script اليومية (افتراضي 60 ثانية).
- وضع التفريغ السريع (Drain Mode): عند وجود عناصر في الطابور، يستطلع فوراً
  (كل ثانيتين) حتى يفرغ الطابور تماماً، ثم يعود لوتيرة الـ 60 ثانية لتوفير الحصة.
- يمرر `cloud_checksum` و `revision` المستلمتين من السحابة مباشرة إلى السيستم
  المحلي وإلى تأكيد الـ ACK دون إعادة تشفير قد تختلف عن السحابة.
- يتعامل بأمان مع حالات رفض التأكيد القديم (STALE_REVISION / STALE_CHECKSUM).
==============================================================================
"""

import os
import sys
import time
import json
import uuid
import urllib.request
import urllib.error
from datetime import datetime

def load_dotenv(filepath=".env"):
    if not os.path.exists(filepath):
        parent_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env")
        if os.path.exists(parent_env):
            filepath = parent_env
        else:
            return
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k not in os.environ:
                    os.environ[k] = v
    except Exception:
        pass

load_dotenv()

APPS_SCRIPT_URL = os.environ.get("APPS_SCRIPT_URL", "").strip()
WORKER_SECRET_TOKEN = os.environ.get("WORKER_SECRET_TOKEN", "").strip()
LOCAL_API_URL = (os.environ.get("LOCAL_API_URL") or os.environ.get("LOCAL_SYSTEM_URL") or "http://127.0.0.1:5173/api/ingest/invoice").strip()
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL_SECONDS", "60"))

PENDING_ACKS_FILE = os.environ.get("PENDING_ACKS_FILE") or os.path.join(os.path.dirname(os.path.abspath(__file__)), ".pending_acks.json")

def get_pending_acks_path():
    return os.environ.get("PENDING_ACKS_FILE") or PENDING_ACKS_FILE

def mask_secret(s):
    if not s or len(s) < 8:
        return "[CONFIGURED]" if s else "[NOT_SET]"
    return s[:3] + "..." + s[-3:]

def load_pending_acks():
    path = get_pending_acks_path()
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def save_pending_acks(pending_map):
    path = get_pending_acks_path()
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(pending_map, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def poll_cloud_queue_post(apps_script_url, worker_token):
    if not apps_script_url or not worker_token:
        return []

    payload = {
        "action": "worker_poll",
        "worker_token": worker_token,
        "timestamp": int(time.time()),
        "nonce": uuid.uuid4().hex
    }
    payload_bytes = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        apps_script_url,
        data=payload_bytes,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "FruitCityWorker/1.2",
            "Accept": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if isinstance(data, dict) and data.get("success"):
                return data.get("items", [])
            return []
    except urllib.error.HTTPError as e:
        print(f"[{datetime.now().isoformat()}] Cloud Poll HTTP Error: {e.code}")
        return []
    except Exception as e:
        print(f"[{datetime.now().isoformat()}] Cloud Poll Network Error: {type(e).__name__}")
        return []

def post_to_local_system(local_url, worker_token, invoice_data):
    payload_bytes = json.dumps(invoice_data, ensure_ascii=False).encode("utf-8")
    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": "FruitCityWorker/1.2",
        "X-Worker-Token": worker_token
    }
    req = urllib.request.Request(local_url, data=payload_bytes, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            res_data = json.loads(resp.read().decode("utf-8"))
            return res_data
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        print(f"[{datetime.now().isoformat()}] Local System HTTP Error {e.code}: {err_msg}")
        return None
    except Exception as e:
        print(f"[{datetime.now().isoformat()}] Local System Connection Failed: {type(e).__name__} (Is Fruit City server running?)")
        return None

def acknowledge_cloud_item_post(apps_script_url, worker_token, queue_id, invoice_id, invoice_number, revision=1, cloud_checksum=""):
    payload = {
        "action": "worker_ack",
        "worker_token": worker_token,
        "timestamp": int(time.time()),
        "nonce": uuid.uuid4().hex,
        "queue_id": queue_id,
        "invoice_id": invoice_id,
        "invoice_number": invoice_number,
        "revision": revision,
        "item_checksum": cloud_checksum,
        "status": "saved"
    }
    payload_bytes = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        apps_script_url,
        data=payload_bytes,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "FruitCityWorker/1.2",
            "Accept": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("success", False)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="ignore")
        print(f"[{datetime.now().isoformat()}] Cloud Ack Rejected ({e.code}): {err_body}")
        return False
    except Exception as e:
        print(f"[{datetime.now().isoformat()}] Cloud Ack Network Error: {type(e).__name__}")
        return False

def retry_pending_acks(apps_script_url, worker_token):
    pending = load_pending_acks()
    if not pending:
        return

    to_delete = []
    for qid, info in pending.items():
        print(f"[{datetime.now().isoformat()}] Retrying pending ACK for: {qid}...")
        acked = acknowledge_cloud_item_post(
            apps_script_url, worker_token, qid,
            info.get("invoice_id"), info.get("invoice_number"),
            info.get("revision", 1), info.get("cloud_checksum", "")
        )
        if acked:
            print(f"[{datetime.now().isoformat()}] Recovered and ACKed pending item: {qid}")
            to_delete.append(qid)

    if to_delete:
        for qid in to_delete:
            del pending[qid]
        save_pending_acks(pending)

def run_worker_cycle(apps_script_url, worker_token, local_url):
    retry_pending_acks(apps_script_url, worker_token)

    items = poll_cloud_queue_post(apps_script_url, worker_token)
    if not items:
        return 0

    print(f"[{datetime.now().isoformat()}] Found {len(items)} pending invoice(s) in cloud queue.")
    processed_count = 0

    for itm in items:
        queue_id = itm.get("queue_id") or itm.get("idempotency_key")
        revision = itm.get("revision", 1)
        cloud_checksum = itm.get("cloud_checksum", "")

        print(f"[{datetime.now().isoformat()}] Processing queue item: {queue_id} (Rev #{revision}, Checksum: {cloud_checksum})...")

        local_res = post_to_local_system(local_url, worker_token, itm)
        if not local_res or not local_res.get("success"):
            print(f"[{datetime.now().isoformat()}] Skipped ACK for {queue_id}: local commit failed or rejected.")
            continue

        if not local_res.get("verified"):
            print(f"[{datetime.now().isoformat()}] Skipped ACK for {queue_id}: SQLite readback verification failed.")
            continue

        local_rev = local_res.get("revision")
        if local_rev is None and isinstance(local_res.get("invoice"), dict):
            local_rev = local_res.get("invoice", {}).get("revision")

        # 1. Exact Revision Equality Verification
        if int(local_rev or 1) != int(revision or 1):
            print(f"[{datetime.now().isoformat()}] Skipped ACK for {queue_id}: revision mismatch (local={local_rev}, cloud={revision})")
            continue

        # 2. Echoed Cloud Checksum Verification (verify backend committed the exact cloud item)
        echoed_cloud_checksum = local_res.get("cloud_checksum")
        if cloud_checksum and echoed_cloud_checksum != cloud_checksum:
            print(f"[{datetime.now().isoformat()}] Skipped ACK for {queue_id}: cloud checksum mismatch (echoed={echoed_cloud_checksum}, expected={cloud_checksum})")
            continue

        # 3. Local Canonical Content Checksum Verification (integrity metadata required from backend)
        local_content_checksum = local_res.get("content_checksum")
        if not local_content_checksum and isinstance(local_res.get("invoice"), dict):
            local_content_checksum = local_res.get("invoice", {}).get("content_checksum")
        if not local_content_checksum:
            print(f"[{datetime.now().isoformat()}] Skipped ACK for {queue_id}: missing local content_checksum integrity metadata.")
            continue

        local_inv_id = local_res.get("invoiceId") or local_res.get("invoice", {}).get("invoice_id")
        local_inv_num = local_res.get("invoiceNumber") or local_res.get("invoice", {}).get("invoice_number")

        print(f"[{datetime.now().isoformat()}] Verified draft in local SQLite: {local_inv_num} ({local_inv_id})")

        pending_map = load_pending_acks()
        pending_map[queue_id] = {
            "invoice_id": local_inv_id,
            "invoice_number": local_inv_num,
            "revision": revision,
            "cloud_checksum": cloud_checksum,
            "saved_at": datetime.now().isoformat()
        }
        save_pending_acks(pending_map)

        acked = acknowledge_cloud_item_post(
            apps_script_url, worker_token, queue_id,
            local_inv_id, local_inv_num, revision, cloud_checksum
        )
        if acked:
            print(f"[{datetime.now().isoformat()}] Successfully ACKed item {queue_id} to cloud.")
            del pending_map[queue_id]
            save_pending_acks(pending_map)
            processed_count += 1
        else:
            print(f"[{datetime.now().isoformat()}] Warning: Local draft saved but cloud ACK temporarily failed for {queue_id}. Will retry.")

    return processed_count

def resolve_worker_token():
    token = os.environ.get("WORKER_SECRET_TOKEN", "").strip()
    if token:
        return token
    script_url = os.environ.get("APPS_SCRIPT_URL", "").strip()
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not bot_token:
        candidate_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "chatgpt_sync", ".env")
        if os.path.exists(candidate_env):
            try:
                with open(candidate_env, "r", encoding="utf-8") as ef:
                    for eline in ef:
                        if eline.startswith("TELEGRAM_BOT_TOKEN=") or eline.startswith("TELEGRAM_TOKEN="):
                            bot_token = eline.split("=", 1)[1].strip().strip("'\"")
                            break
            except Exception:
                pass
    if bot_token:
        import hashlib, hmac
        return hmac.new(b"fruit_city_bridge_v1", (bot_token + script_url).encode("utf-8"), hashlib.sha256).hexdigest()
    return ""

def main():
    worker_token = resolve_worker_token()

    print("=" * 65)
    print("FRUIT CITY — TELEGRAM INTAKE LOCAL OUTBOUND WORKER v1.2.0")
    print(f"Apps Script URL: {mask_secret(APPS_SCRIPT_URL)}")
    print(f"Local System Endpoint: {LOCAL_API_URL}")
    print(f"Default Poll Interval: {POLL_INTERVAL}s (Quota-Aware with Rapid Drain)")
    print(f"Worker Token: {mask_secret(worker_token)}")
    print("=" * 65)

    if not APPS_SCRIPT_URL or not worker_token:
        print("ERROR: APPS_SCRIPT_URL or WORKER_SECRET_TOKEN is not configured.")
        print("Please configure them in your .env or environment variables.")
        sys.exit(1)

    run_once = "--once" in sys.argv or os.environ.get("RUN_ONCE") == "1"

    if run_once:
        print(f"[{datetime.now().isoformat()}] Running single test cycle...")
        processed = run_worker_cycle(APPS_SCRIPT_URL, worker_token, LOCAL_API_URL)
        print(f"[{datetime.now().isoformat()}] Single cycle completed. Processed: {processed}")
        return

    print(f"[{datetime.now().isoformat()}] Worker loop started. Press Ctrl+C to stop.")
    consecutive_network_errors = 0

    while True:
        try:
            processed = run_worker_cycle(APPS_SCRIPT_URL, worker_token, LOCAL_API_URL)
            consecutive_network_errors = 0
            # وضع التفريغ السريع: إذا عولجت عناصر، تحقق مجدداً بعد ثانيتين فقط
            if processed > 0:
                time.sleep(2)
            else:
                time.sleep(POLL_INTERVAL)
        except KeyboardInterrupt:
            print(f"\n[{datetime.now().isoformat()}] Worker stopped by owner.")
            break
        except Exception as e:
            consecutive_network_errors += 1
            print(f"[{datetime.now().isoformat()}] Unexpected error in worker loop: {e}")
            if consecutive_network_errors >= 5:
                print(f"[{datetime.now().isoformat()}] Backing off for 30s due to repeated errors...")
                time.sleep(30)
            else:
                time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()
