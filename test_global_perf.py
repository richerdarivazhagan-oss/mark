import asyncio
import time
import httpx

API_BASE = "http://localhost:8001/api"

async def measure_single_api(client, path, headers):
    t0 = time.time()
    try:
        res = await client.get(f"{API_BASE}{path}", headers=headers)
        dur = time.time() - t0
        return path, res.status_code, dur
    except Exception as e:
        return path, 500, time.time() - t0

async def benchmark_role(username: str, role: str, paths: list[str]):
    print(f"\n--- BENCHMARKING ROLE: {role.upper()} ({username}) ---")
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        t0 = time.time()
        r = await client.post(f"{API_BASE}/auth/login", json={"username": username, "password": "password123", "role": role})
        login_dur = time.time() - t0

        data = r.json()
        token = data.get("access_token") or data.get("data", {}).get("token")
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Markup-Key": f"MARKUP-{role.upper()}-2026" if role != 'hod' else "MARKUP-HOD-2026"
        }
        print(f"Login Time: {login_dur:.3f}s")

        results = await asyncio.gather(*[measure_single_api(client, path, headers) for path in paths])
        results.sort(key=lambda x: x[2], reverse=True)
        print(f"{'Endpoint':<40} | {'Status':<7} | {'Duration (s)'}")
        print("-" * 62)
        for path, status, dur in results:
            print(f"{path:<40} | {status:<7} | {dur:.4f}s")

async def main():
    hod_paths = [
        "/faculty/students/search",
        "/hod/faculty-monitoring",
        "/hod/all-classes",
        "/admin/departments",
        "/admin/subjects",
        "/circulars/",
        "/hod/corrections",
        "/hod/leaves",
        "/hod/od/recommended",
        "/hod/substitutions",
        "/notifications/?unreadOnly=false",
        "/bonafide/",
        "/day-orders/",
    ]
    await benchmark_role("FAC-HOD-01", "hod", hod_paths)

if __name__ == "__main__":
    asyncio.run(main())
