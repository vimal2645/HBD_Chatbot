"""Comprehensive live chat flow tester - tests the handle_chat_query function."""
import sys, asyncio, json
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from pydantic import BaseModel
from typing import Optional, Dict, Any
from chat_router import handle_chat_query

class SearchRequest(BaseModel):
    query: str
    session: Optional[Dict[str, Any]] = None
    language: Optional[str] = "en"
    session_id: Optional[str] = None

# Custom mock for session state in tests
mock_db = {}
def mock_save_message(session_id, role, content):
    if session_id not in mock_db:
        mock_db[session_id] = []
    # simulate the DB save behavior where the last message is what gets retrieved
    mock_db[session_id].append({"role": role, "content": content})

def mock_get_last_metadata(session_id):
    if session_id not in mock_db: return None
    # reverse search for last assistant message
    for msg in reversed(mock_db[session_id]):
        if msg["role"] == "assistant":
            try:
                data = json.loads(msg["content"])
                if isinstance(data, dict):
                    msg_type = data.get("type", "")
                    meta = data.get("search_metadata")
                    if meta and msg_type in ("database", "database_products", "flow_step", "faq", "blinkit_product_card"):
                        return meta
            except Exception:
                continue
    return None

import chat_router
chat_router._save_chat_message_internal = mock_save_message
chat_router._get_last_search_metadata_internal = mock_get_last_metadata
chat_router._get_recent_history_internal = lambda sid, limit=10: []

async def test_scenario(name, query, session_id):
    print("=" * 70)
    print(f"SCENARIO: {name}")
    print(f"Query: '{query}'")
    session = {"type": "GUEST", "phone": None}
    
    # Run the query
    resp = await handle_chat_query(SearchRequest(query=query, session=session, session_id=session_id), None, None, "en")
    
    print("Response Type:", resp.get("type"))
    data = resp.get("data")
    if isinstance(data, list):
        print(f"Data Count: {len(data)}")
        if data:
            print(f"First Item: {data[0].get('business_name') or data[0].get('product_name')}")
    else:
        print("Data Snippet:", str(data)[:100])
        
    intro = resp.get("intro")
    if intro: print("Intro Snippet:", intro[:100].replace('\n', ' '))
    
    suggs = [s.get("title") for s in resp.get("suggestions", [])]
    print("Suggestions:", suggs[:5])
    
    print("Search Metadata:", resp.get("search_metadata"))
    print("=" * 70)
    print()

async def run_all():
    sid = "test_session_123"
    
    print("\n--- BUSINESS FLOW ---")
    await test_scenario("1. Greeting", "hello", sid)
    await test_scenario("2. Click Business", "explore business listings", sid)
    await test_scenario("3. Click City", "Surat", sid)
    await test_scenario("4. Click Category", "best restaurants in surat", sid)
    await test_scenario("5. Refine (Top Rated)", "⭐ Top Rated Restaurants", sid)
    await test_scenario("6. Next Page", "Show Next 10 Results", sid)
    
    print("\n--- PRODUCT FLOW ---")
    await test_scenario("7. Switch to Products", "explore products", sid)
    await test_scenario("8. Type Product", "running shoes", sid)
    await test_scenario("9. Unknown Product", "asdasdqwe", sid)
    
    print("\n--- EDGE CASES ---")
    await test_scenario("10. Comparison", "compare cafe piano vs some other place", sid)
    await test_scenario("11. My Business (No Auth)", "show my business", sid)
    await test_scenario("12. Garbage Query", "sdkfljsdlkfjls", sid)
    await test_scenario("13. Direct City+Cat", "hospitals in pune", sid)

    print("\n--- BLINKIT guided PRODUCT FLOW ---")
    await test_scenario("14. Blinkit Entry", "Blinkit", sid)
    # The categories are dynamic, but 'Atta, Rice & Dal' is a standard sample category in the DB
    await test_scenario("15. Select Category", "Atta, Rice & Dal", sid)
    await test_scenario("16. Select Subcategory", "Rajma Chhole Others", sid)

    print("\n--- BIGBASKET guided PRODUCT FLOW ---")
    await test_scenario("17. BigBasket Entry", "BigBasket", sid)
    # 'Bakery, Cakes & Dairy' is a standard category in the DB
    await test_scenario("18. Select BigBasket Category", "Bakery, Cakes & Dairy", sid)
    await test_scenario("19. Select BigBasket Subcategory", "bakery-snacks", sid)

asyncio.run(run_all())
