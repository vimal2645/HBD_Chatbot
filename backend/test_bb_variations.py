import urllib.request
import ssl

def test_url_variations():
    sku_id = 40169958
    slug = "the-bakers-dozen-lavash-100-wholewheat-100-g"
    
    variations = [
        f"https://www.bigbasket.com/media/uploads/p/m/{sku_id}_1.jpg",
        f"https://www.bigbasket.com/media/uploads/p/m/{sku_id}.jpg",
        f"https://www.bigbasket.com/media/uploads/p/l/{sku_id}_1.jpg",
        f"https://www.bigbasket.com/media/uploads/p/l/{sku_id}.jpg",
        f"https://www.bigbasket.com/media/uploads/p/xxl/{sku_id}_1.jpg",
        f"https://www.bigbasket.com/media/uploads/p/xxl/{sku_id}.jpg",
        f"https://www.bigbasket.com/media/uploads/p/s/{sku_id}_1.jpg",
        f"https://www.bigbasket.com/media/uploads/p/s/{sku_id}.jpg",
    ]
    
    context = ssl._create_unverified_context()
    
    for url in variations:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        try:
            with urllib.request.urlopen(req, context=context) as response:
                print(f"SUCCESS: {url} -> HTTP Status: {response.getcode()}")
                return
        except Exception as e:
            print(f"FAILED: {url} -> {e}")

if __name__ == "__main__":
    test_url_variations()
