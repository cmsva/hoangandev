async function test(label, url) {
  console.log("\n=== " + label + " ===");
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
        "accept": "application/json",
        "referer": "https://whois.inet.vn/",
        "origin": "https://whois.inet.vn",
      },
    });
    clearTimeout(t);
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Body:");
    console.log(text);
  } catch (e) {
    console.log("ERROR:", e.message);
  }
}

(async () => {
  await test("cmstdev.vn (registered)", "https://whois.inet.vn/api/whois/domainspecify/cmstdev.vn");
  await test("vnpt.vn (registered VN)", "https://whois.inet.vn/api/whois/domainspecify/vnpt.vn");
  await test("google.com", "https://whois.inet.vn/api/whois/domainspecify/google.com");
  await test("nope-12345-test.vn (not exist)", "https://whois.inet.vn/api/whois/domainspecify/nope-12345-test-abc.vn");
  await test("nope-12345-test.com (not exist intl)", "https://whois.inet.vn/api/whois/domainspecify/nope-12345-test-abc.com");
})();
