import requests
import json
import sqlite3
import time
import os
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

BASE_URL = "http://127.0.0.1:5000"
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "google_map_data.db")

def run_tests():
    print("🤖 Starting Chatbot End-to-End Integration Tests...")

    # Verify backend health first
    try:
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        print("✅ Backend Health Check Passed.")
    except Exception as e:
        print(f"❌ Backend is offline: {e}")
        sys.exit(1)

    # ---------------------------------------------------------
    # TEST 1: Session CRUD & Memory APIs for Registered Users
    # ---------------------------------------------------------
    print("\n--- Test 1: Chat Session CRUD ---")
    user_id = "test_user_999@example.com"
    session_id = None
    
    try:
        # Create chat session
        r = requests.post(f"{BASE_URL}/api/chats", json={"user_id": user_id, "title": "Initial Title"})
        assert r.status_code == 200
        res = r.json()
        assert res["success"] is True
        session_id = res["session_id"]
        assert session_id is not None
        print(f"✅ Session Created: {session_id}")

        # List chat sessions
        r = requests.get(f"{BASE_URL}/api/chats", params={"user_id": user_id})
        assert r.status_code == 200
        lst = r.json()
        session_item = next((s for s in lst if s["session_id"] == session_id), None)
        assert session_item is not None, f"Created session {session_id} not found in list"
        assert session_item["title"] == "Initial Title"
        print("✅ Session Listed successfully.")

        # Rename chat session
        r = requests.put(f"{BASE_URL}/api/chats/{session_id}", json={"title": "Renamed Title"}, params={"user_id": user_id})
        assert r.status_code == 200
        r_json = r.json()
        assert r_json["success"] is True
        
        # Verify rename
        r = requests.get(f"{BASE_URL}/api/chats", params={"user_id": user_id})
        lst = r.json()
        session_item = next((s for s in lst if s["session_id"] == session_id), None)
        assert session_item is not None
        assert session_item["title"] == "Renamed Title"
        print("✅ Session Renamed successfully.")

        # Pin chat session
        r = requests.put(f"{BASE_URL}/api/chats/{session_id}/pin", json={"is_pinned": True}, params={"user_id": user_id})
        assert r.status_code == 200
        r_json = r.json()
        assert r_json["success"] is True
        
        # Verify pin
        r = requests.get(f"{BASE_URL}/api/chats", params={"user_id": user_id})
        lst = r.json()
        session_item = next((s for s in lst if s["session_id"] == session_id), None)
        assert session_item is not None
        assert session_item["is_pinned"] is True
        print("✅ Session Pinned successfully.")

    except Exception as e:
        import traceback
        print("❌ Test 1 Failed:")
        traceback.print_exc()
        sys.exit(1)

    # ---------------------------------------------------------
    # TEST 2: Guest User Session Creation & Merging
    # ---------------------------------------------------------
    print("\n--- Test 2: Guest Chat Merging on Login ---")
    guest_uuid = "guest_test_uuid_12345"
    registered_uuid = "registered_member_555@example.com"
    guest_session_id = None

    try:
        # Clean old records if any
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("DELETE FROM chat_sessions WHERE user_id IN (?, ?)", (guest_uuid, registered_uuid))
        conn.commit()
        conn.close()

        # 1. Create a session as a Guest
        r = requests.post(f"{BASE_URL}/api/chats", json={"user_id": guest_uuid, "title": "New Chat"})
        assert r.status_code == 200
        res = r.json()
        assert res["success"] is True
        guest_session_id = res["session_id"]
        print(f"✅ Guest Session Created: {guest_session_id}")

        # 2. Add message to the guest session (verifies DB foreign key passes successfully for guests)
        r = requests.post(f"{BASE_URL}/api/query", json={
            "query": "Hi, I am looking for a store",
            "session_id": guest_session_id,
            "language": "en"
        })
        assert r.status_code == 200
        print("✅ Guest Chat Message saved to Database without IntegrityErrors.")

        # 3. Trigger /api/chats/sync to merge guest chats into registered account
        r = requests.post(f"{BASE_URL}/api/chats/sync", json={
            "guest_user_id": guest_uuid,
            "user_id": registered_uuid
        })
        assert r.status_code == 200
        res = r.json()
        assert res["success"] is True
        print("✅ /api/chats/sync call succeeded.")

        # 4. List sessions for the registered account and verify the guest session has been merged
        r = requests.get(f"{BASE_URL}/api/chats", params={"user_id": registered_uuid})
        assert r.status_code == 200
        lst = r.json()
        assert len(lst) >= 1
        assert lst[0]["session_id"] == guest_session_id
        assert lst[0]["title"] == "Hi, I am looking for a store"  # Title auto-updates based on first user message!
        print(f"✅ Guest Session successfully merged. New Title: '{lst[0]['title']}'")

    except Exception as e:
        import traceback
        print("❌ Test 2 Failed:")
        traceback.print_exc()
        sys.exit(1)

    # ---------------------------------------------------------
    # TEST 3: Stateful Search, Pagination, and Filters
    # ---------------------------------------------------------
    print("\n--- Test 3: Stateful Search, Pagination, & Filters ---")
    session_id_search = None
    
    try:
        # Create search session
        r = requests.post(f"{BASE_URL}/api/chats", json={"user_id": registered_uuid, "title": "Search Session"})
        session_id_search = r.json()["session_id"]

        # 1. Initial Search: "interior designer in ahmednagar"
        start_time = time.time()
        r = requests.post(f"{BASE_URL}/api/query", json={
            "query": "interior designer in ahmednagar",
            "session_id": session_id_search,
            "language": "en"
        })
        elapsed = time.time() - start_time
        assert r.status_code == 200
        res = r.json()
        assert res["type"] == "database"
        assert len(res["data"]) > 0
        assert elapsed < 5.0  # Verify local database search times
        print(f"✅ Initial search succeeded. Latency: {elapsed*1000:.2f}ms (Sub-second Fast Search Path)")

        # Save initial business name to compare pagination
        first_biz_name = res["data"][0]["business_name"]

        # 2. Stateful Follow-up: "Show Next 10 Results"
        r = requests.post(f"{BASE_URL}/api/query", json={
            "query": "Show Next 10 Results",
            "session_id": session_id_search,
            "language": "en"
        })
        assert r.status_code == 200
        res_next = r.json()
        assert res_next["type"] == "database"
        # If there are next results, verify they are different from page 0
        if len(res_next["data"]) > 0:
            next_biz_name = res_next["data"][0]["business_name"]
            assert first_biz_name != next_biz_name
            print("✅ Stateful Pagination: 'Show Next 10 Results' successfully adjusted offset and fetched new results.")
        else:
            print("ℹ️ Next page has 0 results (expected if DB has < 11 matching businesses).")

        # 3. Stateful Filter: "Filter by Rating: 4.0+"
        r = requests.post(f"{BASE_URL}/api/query", json={
            "query": "Filter by Rating: 4.0",
            "session_id": session_id_search,
            "language": "en"
        })
        assert r.status_code == 200
        res_filter = r.json()
        assert res_filter["type"] == "database"
        for biz in res_filter["data"]:
            rating = biz.get("ratings")
            if rating:
                assert float(rating) >= 4.0
        print("✅ Stateful Filter: 'Filter by Rating: 4.0+' successfully filtered results to >= 4.0 stars.")

    except Exception as e:
        import traceback
        print("❌ Test 3 Failed:")
        traceback.print_exc()
        sys.exit(1)

    # ---------------------------------------------------------
    # Clean up created sessions
    # ---------------------------------------------------------
    print("\n--- Cleaning Up Test Data ---")
    try:
        for sid in [session_id, guest_session_id, session_id_search]:
            if sid:
                requests.delete(f"{BASE_URL}/api/chats/{sid}", params={"user_id": registered_uuid})
        print("✅ Clean up completed.")
    except Exception as e:
        print(f"⚠️ Clean up encountered error: {e}")

    print("\n🎉 ALL CHATBOT END-TO-END INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉")

if __name__ == "__main__":
    run_tests()
