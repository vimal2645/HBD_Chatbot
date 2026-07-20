"""Live chat flow tester - tests the actual handle_chat_query function."""
import sys, asyncio, json
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Import pydantic model
from pydantic import BaseModel
from typing import Optional, Dict, Any

class SearchRequest(BaseModel):
    query: str
    session: Optional[Dict[str, Any]] = None
    language: Optional[str] = "en"
    session_id: Optional[str] = None

from chat_router import handle_chat_query

async def test_flow():
    session = {"type": "GUEST", "phone": None}
    
    print("=" * 60)
    print("TEST 1: Greeting")
    resp = await handle_chat_query(SearchRequest(query="hi", session=session), None, None, "en")
    print("type:", resp.get("type"))
    print("data:", str(resp.get("data", ""))[:100])
    print("suggestions:", [s.get("title") for s in resp.get("suggestions", [])])
    print("search_metadata:", resp.get("search_metadata"))
    print()

    print("=" * 60)
    print("TEST 2: Business Listings")
    resp = await handle_chat_query(SearchRequest(query="explore business listings", session=session), None, None, "en")
    print("type:", resp.get("type"))
    print("data:", str(resp.get("data", ""))[:100])
    print("suggestions:", [s.get("title") for s in resp.get("suggestions", [])][:5])
    print("search_metadata:", resp.get("search_metadata"))
    print()

    print("=" * 60)
    print("TEST 3: Direct search (Cafes in Surat)")
    resp = await handle_chat_query(SearchRequest(query="best cafes in surat", session=session), None, None, "en")
    print("type:", resp.get("type"))
    print("data count:", len(resp.get("data", [])) if isinstance(resp.get("data"), list) else resp.get("data", "")[:80])
    print("intro:", str(resp.get("intro", ""))[:120])
    print("suggestions:", [s.get("title") for s in resp.get("suggestions", [])][:5])
    print("search_metadata:", resp.get("search_metadata"))
    print()

    print("=" * 60)
    print("TEST 4: Products flow")
    resp = await handle_chat_query(SearchRequest(query="explore products", session=session), None, None, "en")
    print("type:", resp.get("type"))
    print("data:", str(resp.get("data", ""))[:100])
    print("suggestions:", [s.get("title") for s in resp.get("suggestions", [])][:5])
    print("search_metadata:", resp.get("search_metadata"))
    print()

    print("=" * 60)
    print("TEST 5: Product search (Smartphones)")
    resp = await handle_chat_query(SearchRequest(query="smartphones", session=session), None, None, "en")
    print("type:", resp.get("type"))
    print("data count:", len(resp.get("data", [])) if isinstance(resp.get("data"), list) else str(resp.get("data", ""))[:80])
    print("search_metadata:", resp.get("search_metadata"))
    print()

asyncio.run(test_flow())
